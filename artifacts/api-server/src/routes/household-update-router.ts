import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { GetMeResponse, UpdateHouseholdBody } from "@workspace/api-zod";
import { deriveHouseholdSettingsAccess } from "@workspace/care-domain";

export interface HouseholdUpdateRouterDependencies {
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  ensureUserAndHousehold: (userId: string) => Promise<{ householdId: string }>;
  getHouseholdMemberAuthz: (
    householdId: string,
    userId: string,
  ) => Promise<{ role?: string | null } | null | undefined>;
  rejectMismatchedHouseholdRequestScope: (
    req: Request,
    res: Response,
    householdId: string,
  ) => boolean;
  updateHouseholdName: (householdId: string, name: string) => Promise<void>;
  buildMe: (userId: string, householdId: string) => Promise<unknown>;
}

export function createHouseholdUpdateRouter(
  dependencies: HouseholdUpdateRouterDependencies,
) {
  const router = Router();

  router.patch(
    "/household",
    dependencies.requireAuth,
    async (req, res): Promise<void> => {
      const userId = dependencies.getUserId(req);
      const rawBody: unknown = req.body;
      const normalizedBody =
        typeof rawBody === "object" &&
        rawBody !== null &&
        "name" in rawBody &&
        typeof rawBody.name === "string"
          ? { ...rawBody, name: rawBody.name.trim() }
          : rawBody;
      const parsed = UpdateHouseholdBody.safeParse(normalizedBody);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const { householdId } = await dependencies.ensureUserAndHousehold(userId);
      if (
        dependencies.rejectMismatchedHouseholdRequestScope(
          req,
          res,
          householdId,
        )
      ) {
        return;
      }

      const actor = await dependencies.getHouseholdMemberAuthz(
        householdId,
        userId,
      );
      const access = deriveHouseholdSettingsAccess(actor?.role);
      if (!access.allowed) {
        res.status(403).json({ error: access.reason });
        return;
      }

      await dependencies.updateHouseholdName(householdId, parsed.data.name);
      res.json(
        GetMeResponse.parse(await dependencies.buildMe(userId, householdId)),
      );
    },
  );

  return router;
}
