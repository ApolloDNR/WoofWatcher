import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID } from "node:crypto";
import {
  CARE_ENTRY_SYNC_PROTOCOL,
  CARE_ENTRY_SYNC_REVISION_KEY,
  isNextCareEntrySyncRevision,
  normalizeCareEventType,
  readCareEntrySyncRevision,
  resolveLegacyCareEntrySyncWriteRevision,
} from "@workspace/care-domain";
import {
  ListCareEntries200Response as ListCareEntriesResponse,
  ListCareEntries200ResponseItem as ListCareEntriesResponseItem,
  ListCareEntryTombstones200Response as ListCareEntryTombstonesResponse,
  CreateCareEntryBody,
  CreateCareEntry410Response,
  DeleteCareEntryByClientKeyParams,
  UpdateCareEntryParams,
  UpdateCareEntryBody,
  UpdateCareEntry200Response as UpdateCareEntryResponse,
  DeleteCareEntryParams,
} from "@workspace/api-zod";
import {
  applyCareEntryWritePolicy,
  assertCareEntryWriteAllowed,
} from "../lib/care-entry-authorization.ts";
import {
  readCareEntryHouseholdVisibility,
  resolveCareEntryHouseholdVisibility,
} from "../lib/care-entry-privacy.ts";
import type { RunHouseholdScopedOperation } from "../lib/household-scoped-operation.ts";
import {
  normalizeListCareEntriesQuery,
  normalizeListCareEntryTombstonesQuery,
} from "../lib/care-entry-query.ts";
import { runExpectedCareHouseholdOperation } from "./care-household-capability.ts";

type QueryOperator = (...args: any[]) => any;

export const CARE_ENTRY_CREATE_REVOKED_CODE =
  "care_entry_create_revoked" as const;

export function normalizeCareEntryClientKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export interface CareEntriesRouterDependencies {
  careEntriesTable: any;
  careEntryTombstonesTable: any;
  queryOps: {
    and: QueryOperator;
    desc: QueryOperator;
    eq: QueryOperator;
    gte: QueryOperator;
    or: QueryOperator;
    /** Drizzle SQL tag used for JSONB idempotency and revision guards. */
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
  };
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
}

export function createCareEntriesRouter(
  dependencies: CareEntriesRouterDependencies,
): IRouter {
  const router: IRouter = Router();
  const {
    careEntriesTable,
    careEntryTombstonesTable,
    queryOps,
    requireAuth,
    getUserId,
    runHouseholdScopedOperation,
  } = dependencies;
  const { and, desc, eq, gte, or, sql } = queryOps;

  const visibleToUser = (table: any, userId: string) =>
    or(eq(table.householdVisible, true), eq(table.caregiverUserId, userId));

  router.get("/care-entries", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    await runExpectedCareHouseholdOperation({
      req,
      res,
      userId,
      runHouseholdScopedOperation,
      async operation(scope, reply) {
        const householdId = scope.householdId;
        const query = normalizeListCareEntriesQuery(req.query);
        if (!query.ok) {
          reply.status(query.status).json({ error: query.error });
          return;
        }

        const since = query.since;
        const updatedSince = query.updatedSince;

        const where = updatedSince
          ? and(
              eq(careEntriesTable.householdId, householdId),
              visibleToUser(careEntriesTable, userId),
              gte(careEntriesTable.updatedAt, updatedSince),
            )
          : since
            ? and(
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
                gte(careEntriesTable.occurredAt, since),
              )
            : and(
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
              );

        const rows = await scope.database
          .select()
          .from(careEntriesTable)
          .where(where)
          .orderBy(
            desc(
              updatedSince
                ? careEntriesTable.updatedAt
                : careEntriesTable.occurredAt,
            ),
          )
          .limit(query.limit);

        reply.json(ListCareEntriesResponse.parse(rows));
      },
    });
  });

  router.get(
    "/care-entries/tombstones",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = getUserId(req);
      await runExpectedCareHouseholdOperation({
        req,
        res,
        userId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const householdId = scope.householdId;
          const query = normalizeListCareEntryTombstonesQuery(req.query);
          if (!query.ok) {
            reply.status(query.status).json({ error: query.error });
            return;
          }

          const where = query.updatedSince
            ? and(
                eq(careEntryTombstonesTable.householdId, householdId),
                visibleToUser(careEntryTombstonesTable, userId),
                gte(careEntryTombstonesTable.updatedAt, query.updatedSince),
              )
            : and(
                eq(careEntryTombstonesTable.householdId, householdId),
                visibleToUser(careEntryTombstonesTable, userId),
              );

          const rows = await scope.database
            .select()
            .from(careEntryTombstonesTable)
            .where(where)
            .orderBy(desc(careEntryTombstonesTable.updatedAt))
            .limit(query.limit);

          reply.json(ListCareEntryTombstonesResponse.parse(rows));
        },
      });
    },
  );

  router.post("/care-entries", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    await runExpectedCareHouseholdOperation({
      req,
      res,
      userId,
      runHouseholdScopedOperation,
      serializeHouseholdMutation: true,
      async operation(scope, reply) {
        const db = scope.database;
        const householdId = scope.householdId;
        const parsed = CreateCareEntryBody.safeParse(req.body);
        if (!parsed.success) {
          reply.status(400).json({ error: parsed.error.message });
          return;
        }
        const policy = applyCareEntryWritePolicy({
          role: scope.authorizationRole,
          type: parsed.data.type,
          details: parsed.data.details,
          action: "create",
        });
        if (!policy.allowed) {
          reply.status(403).json({ error: policy.reason });
          return;
        }
        const visibilityMetadata = readCareEntryHouseholdVisibility(
          parsed.data.details,
        );
        if (!visibilityMetadata.valid) {
          reply.status(400).json({
            error: "householdVisible must be a boolean when provided.",
          });
          return;
        }

        // Idempotent create: clients stamp details.clientKey (their temp id,
        // stable across retries), so a create whose response was lost can be
        // retried without duplicating the row. PostgreSQL ON CONFLICT keeps
        // the surrounding authority transaction usable when another create
        // wins the partial unique-index race.
        const clientKeyValue = (
          policy.details as Record<string, unknown> | null | undefined
        )?.clientKey;
        const clientKey = normalizeCareEntryClientKey(clientKeyValue);
        if (clientKey) {
          policy.details.clientKey = clientKey;
        } else {
          delete policy.details.clientKey;
        }
        const householdVisible = visibilityMetadata.value;
        const findDeletionTombstone = async (): Promise<
          unknown | undefined
        > => {
          if (!clientKey) return undefined;
          const [tombstone] = await db
            .select()
            .from(careEntryTombstonesTable)
            .where(
              and(
                eq(careEntryTombstonesTable.householdId, householdId),
                eq(careEntryTombstonesTable.caregiverUserId, userId),
                eq(careEntryTombstonesTable.clientKey, clientKey),
              ),
            )
            .limit(1);
          return tombstone;
        };
        const findByClientKey = async (): Promise<unknown | undefined> => {
          if (!clientKey) return undefined;
          const [existing] = await db
            .select()
            .from(careEntriesTable)
            .where(
              and(
                eq(careEntriesTable.householdId, householdId),
                eq(careEntriesTable.caregiverUserId, userId),
                sql`btrim(${careEntriesTable.details} ->> 'clientKey') = ${clientKey}`,
              ),
            )
            .limit(1);
          return existing;
        };

        const deletedCreate = await findDeletionTombstone();
        if (deletedCreate) {
          reply.status(410).json(
            CreateCareEntry410Response.parse({
              error: "This care entry was deleted and cannot be recreated.",
              code: CARE_ENTRY_CREATE_REVOKED_CODE,
              clientKey,
            }),
          );
          return;
        }

        const alreadyCreated = await findByClientKey();
        if (alreadyCreated) {
          reply
            .status(200)
            .json(ListCareEntriesResponseItem.parse(alreadyCreated));
          return;
        }

        const [entry] = await db
          .insert(careEntriesTable)
          .values({
            householdId,
            petId: parsed.data.petId ?? null,
            type: normalizeCareEventType(parsed.data.type, policy.details),
            occurredAt: parsed.data.occurredAt ?? scope.now,
            caregiverUserId: userId,
            caregiverName: scope.caregiverName,
            householdVisible,
            mood: parsed.data.mood ?? null,
            severity: parsed.data.severity ?? null,
            note: parsed.data.note ?? null,
            details: policy.details,
          })
          .onConflictDoNothing()
          .returning();

        if (!entry) {
          const winner = await findByClientKey();
          if (!winner) {
            throw new Error(
              "Care entry create conflicted without an idempotency winner.",
            );
          }
          reply.status(200).json(ListCareEntriesResponseItem.parse(winner));
          return;
        }

        reply.status(201).json(ListCareEntriesResponseItem.parse(entry));
      },
    });
  });

  router.patch(
    "/care-entries/:id",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = getUserId(req);
      await runExpectedCareHouseholdOperation({
        req,
        res,
        userId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const db = scope.database;
          const householdId = scope.householdId;
          const params = UpdateCareEntryParams.safeParse(req.params);
          if (!params.success) {
            reply.status(400).json({ error: params.error.message });
            return;
          }
          const parsed = UpdateCareEntryBody.safeParse(req.body);
          if (!parsed.success) {
            reply.status(400).json({ error: parsed.error.message });
            return;
          }
          const visibilityMetadata = readCareEntryHouseholdVisibility(
            parsed.data.details,
          );
          if (!visibilityMetadata.valid) {
            reply.status(400).json({
              error: "householdVisible must be a boolean when provided.",
            });
            return;
          }
          const [existing] = await db
            .select()
            .from(careEntriesTable)
            .where(
              and(
                eq(careEntriesTable.id, params.data.id),
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
              ),
            )
            .limit(1);

          if (!existing) {
            reply.status(404).json({ error: "Entry not found" });
            return;
          }

          const policy = applyCareEntryWritePolicy({
            role: scope.authorizationRole,
            type: parsed.data.type ?? existing.type,
            details: parsed.data.details ?? existing.details ?? {},
            action: "update",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }

          const existingHouseholdVisible =
            typeof existing.householdVisible === "boolean"
              ? existing.householdVisible
              : resolveCareEntryHouseholdVisibility(existing.details);
          const requestedHouseholdVisibility = visibilityMetadata.present
            ? visibilityMetadata.value
            : undefined;
          const householdVisible =
            requestedHouseholdVisibility ?? existingHouseholdVisible;
          // PATCH details are replacement-style for legacy compatibility, but
          // omitting the privacy bit must never silently publish a private row.
          // Making a private row shared therefore requires an explicit `true`.
          if (!householdVisible) {
            policy.details.householdVisible = false;
          } else if (requestedHouseholdVisibility === true) {
            policy.details.householdVisible = true;
          }
          if (!householdVisible && existing.caregiverUserId !== userId) {
            reply.status(403).json({
              error: "Only the creator can make a care entry private.",
            });
            return;
          }

          // Marked clients establish exactly the next revision. The early check
          // gives them an immediate conflict envelope; the matching SQL predicate
          // below closes the select/update race. Unmarked clients retain the
          // pre-protocol advancement behavior for backwards compatibility.
          const usesRevisionProtocol =
            parsed.data.clientSyncProtocol === CARE_ENTRY_SYNC_PROTOCOL;
          if (
            usesRevisionProtocol &&
            readCareEntrySyncRevision(policy.details) == null
          ) {
            reply.status(400).json({
              error:
                "revision-v1 care entry updates require clientSyncRevision.",
            });
            return;
          }
          if (
            usesRevisionProtocol &&
            !isNextCareEntrySyncRevision(existing.details, policy.details)
          ) {
            reply.status(409).json({
              error:
                "A newer care entry update already exists. Refresh before retrying.",
              entry: UpdateCareEntryResponse.parse(existing),
            });
            return;
          }
          const incomingRevision = usesRevisionProtocol
            ? readCareEntrySyncRevision(policy.details)!
            : resolveLegacyCareEntrySyncWriteRevision({
                storedDetails: existing.details,
                requestedDetails: policy.details,
                detailsWereSupplied: parsed.data.details !== undefined,
              });
          policy.details[CARE_ENTRY_SYNC_REVISION_KEY] = incomingRevision;
          const storedRevision = sql`CASE WHEN jsonb_typeof(${careEntriesTable.details} -> ${CARE_ENTRY_SYNC_REVISION_KEY}) = 'number' THEN CASE WHEN (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric >= 0 AND (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric <= 9007199254740991 AND trunc((${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric) = (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric THEN (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::bigint ELSE 0 END ELSE 0 END`;
          const revisionGuard = usesRevisionProtocol
            ? sql`${storedRevision} = ${incomingRevision - 1}`
            : sql`${storedRevision} < ${incomingRevision}`;
          const [updated] = await db
            .update(careEntriesTable)
            .set({
              ...(parsed.data.type !== undefined
                ? {
                    type: normalizeCareEventType(
                      parsed.data.type,
                      policy.details,
                    ),
                  }
                : {}),
              ...(parsed.data.occurredAt !== undefined
                ? { occurredAt: parsed.data.occurredAt }
                : {}),
              ...(parsed.data.mood !== undefined
                ? { mood: parsed.data.mood }
                : {}),
              ...(parsed.data.severity !== undefined
                ? { severity: parsed.data.severity }
                : {}),
              ...(parsed.data.note !== undefined
                ? { note: parsed.data.note }
                : {}),
              details: policy.details,
              householdVisible,
              updatedAt: scope.now,
            })
            .where(
              and(
                eq(careEntriesTable.id, params.data.id),
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
                revisionGuard,
              ),
            )
            .returning();

          if (!updated) {
            const [current] = await db
              .select()
              .from(careEntriesTable)
              .where(
                and(
                  eq(careEntriesTable.id, params.data.id),
                  eq(careEntriesTable.householdId, householdId),
                  visibleToUser(careEntriesTable, userId),
                ),
              )
              .limit(1);
            if (!current) {
              reply.status(404).json({ error: "Entry not found" });
              return;
            }
            reply.status(409).json({
              error:
                "A newer care entry update already exists. Refresh before retrying.",
              entry: UpdateCareEntryResponse.parse(current),
            });
            return;
          }

          reply.json(UpdateCareEntryResponse.parse(updated));
        },
      });
    },
  );

  router.delete(
    "/care-entries/client-key/:clientKey",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = getUserId(req);
      await runExpectedCareHouseholdOperation({
        req,
        res,
        userId,
        runHouseholdScopedOperation,
        serializeHouseholdMutation: true,
        async operation(scope, reply) {
          const db = scope.database;
          const householdId = scope.householdId;
          const params = DeleteCareEntryByClientKeyParams.safeParse(req.params);
          if (!params.success) {
            reply.status(400).json({ error: params.error.message });
            return;
          }
          const clientKey = normalizeCareEntryClientKey(params.data.clientKey);
          if (!clientKey) {
            reply.status(400).json({
              error: "A non-empty care entry client key is required.",
            });
            return;
          }
          const policy = assertCareEntryWriteAllowed({
            role: scope.authorizationRole,
            action: "delete",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }

          const [deleted] = await db
            .delete(careEntriesTable)
            .where(
              and(
                eq(careEntriesTable.householdId, householdId),
                eq(careEntriesTable.caregiverUserId, userId),
                sql`btrim(${careEntriesTable.details} ->> 'clientKey') = ${clientKey}`,
              ),
            )
            .returning();
          const deletedAt = scope.now;
          const [existingTombstone] = await db
            .select()
            .from(careEntryTombstonesTable)
            .where(
              and(
                eq(careEntryTombstonesTable.householdId, householdId),
                eq(careEntryTombstonesTable.caregiverUserId, userId),
                eq(careEntryTombstonesTable.clientKey, clientKey),
              ),
            )
            .limit(1);

          if (!existingTombstone) {
            await db.insert(careEntryTombstonesTable).values({
              householdId,
              entryId: deleted?.id ?? randomUUID(),
              petId: deleted?.petId ?? null,
              caregiverUserId: deleted?.caregiverUserId ?? userId,
              householdVisible: deleted?.householdVisible ?? false,
              clientKey,
              deletedByUserId: userId,
              deletedAt,
              updatedAt: deletedAt,
            });
          }

          reply.sendStatus(204);
        },
      });
    },
  );

  router.delete(
    "/care-entries/:id",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = getUserId(req);
      await runExpectedCareHouseholdOperation({
        req,
        res,
        userId,
        runHouseholdScopedOperation,
        serializeHouseholdMutation: true,
        async operation(scope, reply) {
          const db = scope.database;
          const householdId = scope.householdId;
          const params = DeleteCareEntryParams.safeParse(req.params);
          if (!params.success) {
            reply.status(400).json({ error: params.error.message });
            return;
          }
          const policy = assertCareEntryWriteAllowed({
            role: scope.authorizationRole,
            action: "delete",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }

          let deleted: any | undefined;
          const deletedAt = scope.now;

          const [removed] = await db
            .delete(careEntriesTable)
            .where(
              and(
                eq(careEntriesTable.id, params.data.id),
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
              ),
            )
            .returning();

          deleted = removed;

          if (deleted) {
            const deletedClientKey = normalizeCareEntryClientKey(
              deleted.details?.clientKey,
            );
            await db.insert(careEntryTombstonesTable).values({
              householdId,
              entryId: deleted.id,
              petId: deleted.petId,
              caregiverUserId: deleted.caregiverUserId ?? userId,
              householdVisible: deleted.householdVisible,
              ...(deletedClientKey ? { clientKey: deletedClientKey } : {}),
              deletedByUserId: userId,
              deletedAt,
              updatedAt: deletedAt,
            });
          }

          if (!deleted) {
            reply.status(404).json({ error: "Entry not found" });
            return;
          }

          reply.sendStatus(204);
        },
      });
    },
  );

  return router;
}
