import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  GetCareState200Response as GetCareStateResponse,
  PutCareStateBody,
} from "@workspace/api-zod";
import {
  containsEmbeddedCareLogCollections,
  stripEmbeddedCareLogCollections,
} from "../lib/care-entry-privacy.ts";
import type { RunHouseholdScopedOperation } from "../lib/household-scoped-operation.ts";
import { runExpectedCareHouseholdOperation } from "./care-household-capability.ts";

type QueryOperator = (...args: any[]) => any;

export interface CareStateRouterDependencies {
  careStateTable: any;
  and: QueryOperator;
  eq: QueryOperator;
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
}

export function createCareStateRouter(
  dependencies: CareStateRouterDependencies,
): IRouter {
  const router: IRouter = Router();
  const {
    careStateTable,
    and,
    eq,
    requireAuth,
    getUserId,
    runHouseholdScopedOperation,
  } = dependencies;

  router.get("/care-state", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    await runExpectedCareHouseholdOperation({
      req,
      res,
      userId,
      runHouseholdScopedOperation,
      async operation(scope, reply) {
        const [row] = await scope.database
          .select()
          .from(careStateTable)
          .where(eq(careStateTable.householdId, scope.householdId));
        if (!row) {
          reply.status(404).json({ error: "Care state not found" });
          return;
        }
        reply.json(
          GetCareStateResponse.parse({
            householdId: scope.householdId,
            version: row.version,
            updatedAt: row.updatedAt,
            updatedBy: row.updatedBy,
            doc: stripEmbeddedCareLogCollections(row.doc),
          }),
        );
      },
    });
  });

  router.put("/care-state", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    await runExpectedCareHouseholdOperation({
      req,
      res,
      userId,
      runHouseholdScopedOperation,
      async operation(scope, reply) {
        const submittedVersion =
          req.body != null &&
          typeof req.body === "object" &&
          !Array.isArray(req.body)
            ? (req.body as Record<string, unknown>).version
            : undefined;
        if (
          submittedVersion !== undefined &&
          (typeof submittedVersion !== "number" ||
            !Number.isSafeInteger(submittedVersion) ||
            submittedVersion <= 0 ||
            submittedVersion >= 2_147_483_647)
        ) {
          reply.status(400).json({
            error:
              "Care state version must be a positive 32-bit integer that can advance.",
          });
          return;
        }

        const parsed = PutCareStateBody.safeParse(req.body);
        if (!parsed.success) {
          reply.status(400).json({ error: parsed.error.message });
          return;
        }
        if (containsEmbeddedCareLogCollections(parsed.data.doc)) {
          reply.status(400).json({
            error:
              "Care log entries and tombstones must use the private care-entry sync routes.",
          });
          return;
        }
        if (
          scope.authorizationRole !== "owner" &&
          scope.authorizationRole !== "adult"
        ) {
          reply.status(403).json({
            error: "Only an owner or adult can update shared Care state.",
          });
          return;
        }

        // The expected version participates in the UPDATE itself. A
        // preflight SELECT cannot prevent another writer from winning between
        // the read and write.
        const [updated] = await scope.database
          .update(careStateTable)
          .set({
            doc: parsed.data.doc,
            version: parsed.data.version + 1,
            updatedBy: userId,
            updatedAt: scope.now,
          })
          .where(
            and(
              eq(careStateTable.householdId, scope.householdId),
              eq(careStateTable.version, parsed.data.version),
            ),
          )
          .returning();

        if (!updated) {
          const [current] = await scope.database
            .select()
            .from(careStateTable)
            .where(eq(careStateTable.householdId, scope.householdId));
          if (!current) {
            reply.status(404).json({ error: "Care state not found" });
            return;
          }
          reply.status(409).json(
            GetCareStateResponse.parse({
              householdId: scope.householdId,
              version: current.version,
              updatedAt: current.updatedAt,
              updatedBy: current.updatedBy,
              doc: stripEmbeddedCareLogCollections(current.doc),
            }),
          );
          return;
        }

        reply.json(
          GetCareStateResponse.parse({
            householdId: scope.householdId,
            version: updated.version,
            updatedAt: updated.updatedAt,
            updatedBy: updated.updatedBy,
            doc: stripEmbeddedCareLogCollections(updated.doc),
          }),
        );
      },
    });
  });

  return router;
}
