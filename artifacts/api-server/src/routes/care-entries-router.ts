import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { normalizeCareEventType } from "@workspace/care-domain";
import {
  ListCareEntriesResponse,
  ListCareEntriesResponseItem,
  ListCareEntryHistoryResponse,
  ListCareEntryTombstonesResponse,
  CreateCareEntryBody,
  UpdateCareEntryParams,
  UpdateCareEntryBody,
  UpdateCareEntryResponse,
  DeleteCareEntryParams,
} from "@workspace/api-zod";
import {
  applyCareEntryWritePolicy,
  assertCareEntryWriteAllowed,
} from "../lib/care-entry-authorization.ts";
import {
  normalizeListCareEntryHistoryQuery,
  normalizeListCareEntriesQuery,
  normalizeListCareEntryTombstonesQuery,
  normalizeCareEntryHouseholdScope,
} from "../lib/care-entry-query.ts";
import { readCoherentCareEntryHistoryPage } from "../lib/care-entry-history.ts";

type QueryOperator = (...args: any[]) => any;

export interface CareEntriesRouterDependencies {
  db: any;
  careEntriesTable: any;
  careEntryTombstonesTable: any;
  householdsTable: any;
  queryOps: {
    and: QueryOperator;
    desc: QueryOperator;
    eq: QueryOperator;
    gte: QueryOperator;
    lt: QueryOperator;
    or: QueryOperator;
    /** Drizzle SQL tag for JSONB lookups and atomic revision increments. */
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
  };
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  getActiveHouseholdId: (userId: string) => Promise<string>;
  getCaregiverName: (householdId: string, userId: string) => Promise<string | null>;
  getHouseholdMemberAuthz: (householdId: string, userId: string) => Promise<{ role?: string | null } | null | undefined>;
  now: () => Date;
}

export function createCareEntriesRouter(dependencies: CareEntriesRouterDependencies): IRouter {
  const router: IRouter = Router();
  const {
    db,
    careEntriesTable,
    careEntryTombstonesTable,
    householdsTable,
    queryOps,
    requireAuth,
    getUserId,
    getActiveHouseholdId,
    getCaregiverName,
    getHouseholdMemberAuthz,
    now,
  } = dependencies;
  const { and, desc, eq, gte, lt, or, sql } = queryOps;
  const visibleToUser = (table: any, userId: string) =>
    or(eq(table.householdVisible, true), eq(table.caregiverUserId, userId));

  router.get("/care-entries", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const householdId = await getActiveHouseholdId(userId);
    const query = normalizeListCareEntriesQuery(req.query);
    if (!query.ok) {
      res.status(query.status).json({ error: query.error });
      return;
    }

    const since = query.since;
    const updatedSince = query.updatedSince;

    const where = updatedSince
      ? and(
          eq(careEntriesTable.householdId, householdId),
          gte(careEntriesTable.updatedAt, updatedSince),
          visibleToUser(careEntriesTable, userId),
        )
      : since
      ? and(
          eq(careEntriesTable.householdId, householdId),
          gte(careEntriesTable.occurredAt, since),
          visibleToUser(careEntriesTable, userId),
        )
      : and(
          eq(careEntriesTable.householdId, householdId),
          visibleToUser(careEntriesTable, userId),
        );

    const rows = await db
      .select()
      .from(careEntriesTable)
      .where(where)
      .orderBy(desc(updatedSince ? careEntriesTable.updatedAt : careEntriesTable.occurredAt))
      .limit(query.limit);

    res.json(ListCareEntriesResponse.parse(rows));
  });

  router.get("/care-entries/history", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const query = normalizeListCareEntryHistoryQuery(req.query);
    if (!query.ok) {
      res.status(query.status).json({ error: query.error });
      return;
    }
    const householdId = await getActiveHouseholdId(userId);
    if (query.householdId !== householdId) {
      res.status(412).json({
        error:
          "Active household changed during care-history sync. Restart in the current household.",
        currentHouseholdId: householdId,
      });
      return;
    }

    const page = await db.transaction(async (tx: any) =>
      readCoherentCareEntryHistoryPage({
        expectedGeneration: query.expectedGeneration,
        readGeneration: async () => {
          const [household] = await tx
            .select({
              historyGeneration:
                householdsTable.careHistoryGeneration,
            })
            .from(householdsTable)
            .where(eq(householdsTable.id, householdId))
            .limit(1);
          const historyGeneration = household?.historyGeneration;
          if (
            !Number.isSafeInteger(historyGeneration) ||
            historyGeneration < 0
          ) {
            throw new Error(
              "Active household care-history generation is unavailable.",
            );
          }
          return historyGeneration;
        },
        readRows: () => {
          const beforeOccurredAt = query.beforeOccurredAt;
          const beforeId = query.beforeId;
          const cursor = beforeOccurredAt && beforeId
            ? or(
                lt(careEntriesTable.occurredAt, beforeOccurredAt),
                and(
                  eq(careEntriesTable.occurredAt, beforeOccurredAt),
                  lt(careEntriesTable.id, beforeId),
                ),
              )
            : undefined;
          return tx
            .select()
            .from(careEntriesTable)
            .where(
              and(
                eq(careEntriesTable.householdId, householdId),
                visibleToUser(careEntriesTable, userId),
                ...(cursor ? [cursor] : []),
              ),
            )
            .orderBy(
              desc(careEntriesTable.occurredAt),
              desc(careEntriesTable.id),
            )
            .limit(query.limit);
        },
      }),
    );

    if (!page.ok) {
      res.status(page.status).json({
        error: page.error,
        currentGeneration: page.currentGeneration,
      });
      return;
    }
    res.json(
      ListCareEntryHistoryResponse.parse({
        ...page,
        householdId,
      }),
    );
  });

  router.get("/care-entries/tombstones", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const householdId = await getActiveHouseholdId(userId);
    const query = normalizeListCareEntryTombstonesQuery(req.query);
    if (!query.ok) {
      res.status(query.status).json({ error: query.error });
      return;
    }

    const where = query.updatedSince
      ? and(
          eq(careEntryTombstonesTable.householdId, householdId),
          gte(careEntryTombstonesTable.updatedAt, query.updatedSince),
          visibleToUser(careEntryTombstonesTable, userId),
        )
      : and(
          eq(careEntryTombstonesTable.householdId, householdId),
          visibleToUser(careEntryTombstonesTable, userId),
        );

    const rows = await db
      .select()
      .from(careEntryTombstonesTable)
      .where(where)
      .orderBy(desc(careEntryTombstonesTable.updatedAt))
      .limit(query.limit);

    res.json(ListCareEntryTombstonesResponse.parse(rows));
  });

  router.post("/care-entries", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const parsed = CreateCareEntryBody.safeParse(req.body);
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
          "Active household changed before care-log creation. Refresh and retry in the current household.",
        currentHouseholdId: householdId,
      });
      return;
    }
    const caregiverName = await getCaregiverName(householdId, userId);
    const member = await getHouseholdMemberAuthz(householdId, userId);
    const policy = applyCareEntryWritePolicy({
      role: member?.role,
      type: parsed.data.type,
      details: parsed.data.details,
      action: "create",
    });
    if (!policy.allowed) {
      res.status(403).json({ error: policy.reason });
      return;
    }

    // Idempotent create: clients stamp details.clientKey (their temp id,
    // stable across retries), so a create whose response was lost can be
    // retried without duplicating the row. A partial unique index on
    // (household_id, details->>'clientKey') backstops the read-then-insert
    // race; on that conflict we return the winning row.
    const clientKeyValue = (policy.details as Record<string, unknown> | null | undefined)?.clientKey;
    const clientKey = typeof clientKeyValue === "string" && clientKeyValue.length > 0 ? clientKeyValue : null;
    const findByClientKey = async (): Promise<unknown | undefined> => {
      if (!clientKey) return undefined;
      const [existing] = await db
        .select()
        .from(careEntriesTable)
        .where(
          and(
            eq(careEntriesTable.householdId, householdId),
            sql`${careEntriesTable.details} ->> 'clientKey' = ${clientKey}`,
            visibleToUser(careEntriesTable, userId),
          ),
        )
        .limit(1);
      return existing;
    };

    const alreadyCreated = await findByClientKey();
    if (alreadyCreated) {
      res.status(200).json(ListCareEntriesResponseItem.parse(alreadyCreated));
      return;
    }

    let entry: unknown;
    try {
      const [inserted] = await db
        .insert(careEntriesTable)
        .values({
          householdId,
          petId: parsed.data.petId ?? null,
          type: normalizeCareEventType(parsed.data.type, policy.details),
          occurredAt: parsed.data.occurredAt ?? now(),
          caregiverUserId: userId,
          householdVisible: policy.details.householdVisible !== false,
          caregiverName,
          mood: parsed.data.mood ?? null,
          severity: parsed.data.severity ?? null,
          note: parsed.data.note ?? null,
          details: policy.details,
        })
        .returning();
      entry = inserted;
    } catch (err) {
      // Unique-violation on the clientKey index: a concurrent identical
      // create won the race - return its row instead of an error.
      const code = (err as { code?: string; cause?: { code?: string } })?.code ??
        (err as { cause?: { code?: string } })?.cause?.code;
      if (code !== "23505") throw err;
      const winner = await findByClientKey();
      if (!winner) throw err;
      res.status(200).json(ListCareEntriesResponseItem.parse(winner));
      return;
    }

    res.status(201).json(ListCareEntriesResponseItem.parse(entry));
  });

  router.patch("/care-entries/:id", requireAuth, async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const params = UpdateCareEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateCareEntryBody.safeParse(req.body);
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
          "Active household changed before care-log update. Refresh and retry in the current household.",
        currentHouseholdId: householdId,
      });
      return;
    }
    const member = await getHouseholdMemberAuthz(householdId, userId);

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
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    const policy = applyCareEntryWritePolicy({
      role: member?.role,
      type: parsed.data.type ?? existing.type,
      details: parsed.data.details ?? existing.details ?? {},
      action: "update",
    });
    if (!policy.allowed) {
      res.status(403).json({ error: policy.reason });
      return;
    }
    const householdVisible = policy.details.householdVisible !== false;
    if (!householdVisible && existing.caregiverUserId !== userId) {
      res.status(403).json({
        error: "Only the author can make a care log private.",
      });
      return;
    }

    const [updated] = await db
      .update(careEntriesTable)
      .set({
        ...(parsed.data.type !== undefined
          ? { type: normalizeCareEventType(parsed.data.type, policy.details) }
          : {}),
        ...(parsed.data.occurredAt !== undefined
          ? { occurredAt: parsed.data.occurredAt }
          : {}),
        ...(parsed.data.mood !== undefined ? { mood: parsed.data.mood } : {}),
        ...(parsed.data.severity !== undefined
          ? { severity: parsed.data.severity }
          : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
        details: policy.details,
        householdVisible,
        revision: sql`${careEntriesTable.revision} + 1`,
        updatedAt: now(),
      })
      .where(
        and(
          eq(careEntriesTable.id, params.data.id),
          eq(careEntriesTable.householdId, householdId),
          visibleToUser(careEntriesTable, userId),
          eq(
            careEntriesTable.householdVisible,
            existing.householdVisible,
          ),
          eq(careEntriesTable.revision, parsed.data.expectedRevision),
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
        res.status(404).json({ error: "Entry not found" });
        return;
      }
      res.status(409).json(UpdateCareEntryResponse.parse(current));
      return;
    }

    res.json(UpdateCareEntryResponse.parse(updated));
  });

  router.delete(
    "/care-entries/:id",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = getUserId(req);
      const params = DeleteCareEntryParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }
      const scopeQuery =
        normalizeCareEntryHouseholdScope(req.query);
      if (!scopeQuery.ok) {
        res.status(scopeQuery.status).json({
          error: scopeQuery.error,
        });
        return;
      }
      const householdId = await getActiveHouseholdId(userId);
      if (
        scopeQuery.householdId !== householdId
      ) {
        res.status(412).json({
          error:
            "Active household changed before care-log deletion. Refresh and retry in the current household.",
          currentHouseholdId: householdId,
        });
        return;
      }
      const member = await getHouseholdMemberAuthz(householdId, userId);
      const policy = assertCareEntryWriteAllowed({
        role: member?.role,
        action: "delete",
      });
      if (!policy.allowed) {
        res.status(403).json({ error: policy.reason });
        return;
      }

      let deleted: any | undefined;
      const deletedAt = now();

      await db.transaction(async (tx: any) => {
        const [removed] = await tx
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
          await tx.insert(careEntryTombstonesTable).values({
            householdId,
            entryId: deleted.id,
            petId: deleted.petId,
            caregiverUserId: deleted.caregiverUserId,
            householdVisible: deleted.householdVisible,
            deletedByUserId: userId,
            deletedAt,
            updatedAt: deletedAt,
          });
        }
      });

      if (!deleted) {
        res.status(404).json({
          error: "Entry not found",
          householdId,
          scopeBound: true,
        });
        return;
      }

      res.sendStatus(204);
    },
  );

  return router;
}
