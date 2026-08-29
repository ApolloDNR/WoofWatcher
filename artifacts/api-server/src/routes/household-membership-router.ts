import {
  Router,
  type IRouter,
  type Request,
  type RequestHandler,
} from "express";
import {
  ActivateHouseholdBody,
  ActivateHouseholdResponse,
  ListMyHouseholdMembershipsResponse,
} from "@workspace/api-zod";

import {
  HouseholdMembershipActivationError,
  type SwitchableHouseholdMembership,
} from "../lib/household-membership-activation.ts";
import {
  HouseholdAuthoritySnapshotError,
  type ExactHouseholdSnapshot,
} from "../lib/household-me-snapshot.ts";
import { parseExpectedHouseholdCapability } from "./household-capability.ts";

export interface HouseholdMembershipRouteDependencies {
  requireAuth: RequestHandler;
  getUserId(req: Request): string;
  listMemberships(input: {
    userId: string;
    expectedSourceHouseholdId: string;
  }): Promise<{
    activeHouseholdId: string;
    memberships: SwitchableHouseholdMembership[];
  }>;
  activateMembership(input: {
    userId: string;
    expectedSourceHouseholdId: string;
    targetHouseholdId: string;
  }): Promise<{ householdId: string; me: ExactHouseholdSnapshot }>;
}

function sendMembershipError(
  error: unknown,
  res: Parameters<typeof parseExpectedHouseholdCapability>[1],
): boolean {
  if (error instanceof HouseholdMembershipActivationError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  if (error instanceof HouseholdAuthoritySnapshotError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export function createHouseholdMembershipRouter(
  dependencies: HouseholdMembershipRouteDependencies,
): IRouter {
  const router: IRouter = Router();

  router.get(
    "/household/memberships",
    dependencies.requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;

      try {
        const result = await dependencies.listMemberships({
          userId: dependencies.getUserId(req),
          expectedSourceHouseholdId: capability.expectedHouseholdId,
        });
        res.json(ListMyHouseholdMembershipsResponse.parse(result));
      } catch (error) {
        if (sendMembershipError(error, res)) return;
        throw error;
      }
    },
  );

  router.post(
    "/household/activate",
    dependencies.requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;

      const parsed = ActivateHouseholdBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      try {
        const activated = await dependencies.activateMembership({
          userId: dependencies.getUserId(req),
          expectedSourceHouseholdId: capability.expectedHouseholdId,
          targetHouseholdId: parsed.data.householdId,
        });
        res.json(ActivateHouseholdResponse.parse(activated.me));
      } catch (error) {
        if (sendMembershipError(error, res)) return;
        throw error;
      }
    },
  );

  return router;
}
