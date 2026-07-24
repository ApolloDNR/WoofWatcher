import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  GetCareStateResponse,
  PutCareStateBody,
} from "@workspace/api-zod";
import { normalizeCareEntryHouseholdScope } from "../lib/care-entry-query.ts";

type QueryOperator = (...args: any[]) => any;
type SqlTag = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => unknown;

export interface CareStateRouterDependencies {
  db: any;
  careStateTable: any;
  queryOps: {
    and: QueryOperator;
    eq: QueryOperator;
    sql: SqlTag;
  };
  requireAuth: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void;
  getUserId: (req: Request) => string;
  getActiveHouseholdId: (userId: string) => Promise<string>;
}

export function createCareStateRouter(
  dependencies: CareStateRouterDependencies,
): IRouter {
  const router: IRouter = Router();
  const {
    db,
    careStateTable,
    queryOps,
    requireAuth,
    getUserId,
    getActiveHouseholdId,
  } = dependencies;
  const { and, eq, sql } = queryOps;

  router.get("/care-state", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const scope = normalizeCareEntryHouseholdScope(req.query);
    if (!scope.ok) {
      res.status(scope.status).json({ error: scope.error });
      return;
    }
    const householdId = await getActiveHouseholdId(userId);
    if (scope.householdId !== householdId) {
      res.status(412).json({
        error:
          "Active household changed before care-state access. Restart in the current household.",
        currentHouseholdId: householdId,
      });
      return;
    }
    const [row] = await db
      .select()
      .from(careStateTable)
      .where(eq(careStateTable.householdId, householdId));
    if (!row) {
      res.status(404).json({ error: "Care state not found" });
      return;
    }
    res.json(
      GetCareStateResponse.parse({
        householdId,
        version: row.version,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        doc: row.doc,
      }),
    );
  });

  router.put("/care-state", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const parsed = PutCareStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const scope = normalizeCareEntryHouseholdScope(req.query);
    if (!scope.ok) {
      res.status(scope.status).json({ error: scope.error });
      return;
    }
    const householdId = await getActiveHouseholdId(userId);
    if (scope.householdId !== householdId) {
      res.status(412).json({
        error:
          "Active household changed before care-state access. Restart in the current household.",
        currentHouseholdId: householdId,
      });
      return;
    }

    // The version check and increment happen in one SQL statement. A
    // household-scoped writer can claim an expected version only once.
    const [updated] = await db
      .update(careStateTable)
      .set({
        doc: parsed.data.doc,
        version: sql`${careStateTable.version} + 1`,
        updatedBy: userId,
      })
      .where(
        and(
          eq(careStateTable.householdId, householdId),
          eq(careStateTable.version, parsed.data.version),
        ),
      )
      .returning();

    if (!updated) {
      const [current] = await db
        .select()
        .from(careStateTable)
        .where(eq(careStateTable.householdId, householdId));
      if (!current) {
        res.status(404).json({ error: "Care state not found" });
        return;
      }
      res.status(409).json(
        GetCareStateResponse.parse({
          householdId,
          version: current.version,
          updatedAt: current.updatedAt,
          updatedBy: current.updatedBy,
          doc: current.doc,
        }),
      );
      return;
    }

    res.json(
      GetCareStateResponse.parse({
        householdId,
        version: updated.version,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy,
        doc: updated.doc,
      }),
    );
  });

  return router;
}
