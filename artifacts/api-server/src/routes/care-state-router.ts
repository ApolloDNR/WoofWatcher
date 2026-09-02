import { assertCareStateWriteAllowed } from "../lib/care-state-authorization.ts";

type RouteHandler = (...args: any[]) => unknown;

interface RouterLike {
  get(path: string, ...handlers: RouteHandler[]): unknown;
  put(path: string, ...handlers: RouteHandler[]): unknown;
}

type PutCareStateParseResult =
  | { success: true; data: { version: number; doc: unknown } }
  | { success: false; error: { message: string } };

type QueryOperator = (...args: any[]) => any;

export interface CareStateRouterDependencies {
  createRouter: () => RouterLike;
  db: any;
  careStateTable: any;
  queryOps: {
    and: QueryOperator;
    eq: QueryOperator;
  };
  schemas: {
    GetCareStateResponse: { parse(value: unknown): unknown };
    PutCareStateBody: { safeParse(value: unknown): PutCareStateParseResult };
  };
  requireAuth: RouteHandler;
  getUserId: (req: any) => string;
  getActiveHouseholdId: (userId: string) => Promise<string>;
  getHouseholdMemberAuthz: (
    householdId: string,
    userId: string,
  ) => Promise<
    { storedRole?: string | null; role?: string | null } | null | undefined
  >;
}

export function createCareStateRouter(
  dependencies: CareStateRouterDependencies,
): RouterLike {
  const router = dependencies.createRouter();
  const {
    db,
    careStateTable,
    queryOps,
    schemas,
    requireAuth,
    getUserId,
    getActiveHouseholdId,
    getHouseholdMemberAuthz,
  } = dependencies;
  const { and, eq } = queryOps;

  const toEnvelope = (row: any): unknown =>
    schemas.GetCareStateResponse.parse({
      version: row.version,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
      doc: row.doc,
    });

  router.get(
    "/care-state",
    requireAuth,
    async (req: any, res: any): Promise<void> => {
      const userId = getUserId(req);
      const householdId = await getActiveHouseholdId(userId);
      const [row] = await db
        .select()
        .from(careStateTable)
        .where(eq(careStateTable.householdId, householdId));
      if (!row) {
        res.status(404).json({ error: "Care state not found" });
        return;
      }
      res.json(toEnvelope(row));
    },
  );

  router.put(
    "/care-state",
    requireAuth,
    async (req: any, res: any): Promise<void> => {
      const userId = getUserId(req);
      const parsed = schemas.PutCareStateBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const householdId = await getActiveHouseholdId(userId);
      const member = await getHouseholdMemberAuthz(householdId, userId);
      const policy = assertCareStateWriteAllowed(
        member?.storedRole,
        member?.role,
      );
      if (!policy.allowed) {
        res.status(403).json({ error: policy.reason });
        return;
      }

      const [current] = await db
        .select()
        .from(careStateTable)
        .where(eq(careStateTable.householdId, householdId));

      if (!current) {
        res.status(404).json({ error: "Care state not found" });
        return;
      }

      if (current.version !== parsed.data.version) {
        res.status(409).json(toEnvelope(current));
        return;
      }

      const [updated] = await db
        .update(careStateTable)
        .set({
          doc: parsed.data.doc,
          version: current.version + 1,
          updatedBy: userId,
        })
        .where(
          and(
            eq(careStateTable.householdId, householdId),
            eq(careStateTable.version, current.version),
          ),
        )
        .returning();

      if (!updated) {
        const [refreshed] = await db
          .select()
          .from(careStateTable)
          .where(eq(careStateTable.householdId, householdId));
        if (!refreshed) {
          res.status(404).json({ error: "Care state not found" });
          return;
        }
        res.status(409).json(toEnvelope(refreshed));
        return;
      }

      res.json(toEnvelope(updated));
    },
  );

  return router;
}
