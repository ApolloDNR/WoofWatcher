import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  CARE_ENTRY_SYNC_PROTOCOL,
  CARE_ENTRY_SYNC_REVISION_KEY,
  isNextCareEntrySyncRevision,
  normalizeCareEventType,
  readCareEntrySyncRevision,
  resolveLegacyCareEntrySyncWriteRevision,
} from "@workspace/care-domain";
import {
  ListCareEntriesResponse,
  ListCareEntriesResponseItem,
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
  normalizeListCareEntriesQuery,
  normalizeListCareEntryTombstonesQuery,
} from "../lib/care-entry-query.ts";

type QueryOperator = (...args: any[]) => any;

export interface CareEntriesRouterDependencies {
  db: any;
  careEntriesTable: any;
  careEntryTombstonesTable: any;
  queryOps: {
    and: QueryOperator;
    desc: QueryOperator;
    eq: QueryOperator;
    gte: QueryOperator;
    /** Drizzle SQL tag used for JSONB idempotency and revision guards. */
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
    queryOps,
    requireAuth,
    getUserId,
    getActiveHouseholdId,
    getCaregiverName,
    getHouseholdMemberAuthz,
    now,
  } = dependencies;
  const { and, desc, eq, gte, sql } = queryOps;

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
        )
      : since
      ? and(
          eq(careEntriesTable.householdId, householdId),
          gte(careEntriesTable.occurredAt, since),
        )
      : eq(careEntriesTable.householdId, householdId);

    const rows = await db
      .select()
      .from(careEntriesTable)
      .where(where)
      .orderBy(desc(updatedSince ? careEntriesTable.updatedAt : careEntriesTable.occurredAt))
      .limit(query.limit);

    res.json(ListCareEntriesResponse.parse(rows));
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
        )
      : eq(careEntryTombstonesTable.householdId, householdId);

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
    const householdId = await getActiveHouseholdId(userId);
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
    const householdId = await getActiveHouseholdId(userId);
    const member = await getHouseholdMemberAuthz(householdId, userId);

    const [existing] = await db
      .select()
      .from(careEntriesTable)
      .where(
        and(
          eq(careEntriesTable.id, params.data.id),
          eq(careEntriesTable.householdId, householdId),
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
      res.status(400).json({
        error:
          "revision-v1 care entry updates require clientSyncRevision.",
      });
      return;
    }
    if (
      usesRevisionProtocol &&
      !isNextCareEntrySyncRevision(existing.details, policy.details)
    ) {
      res.status(409).json({
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
    const storedRevision =
      sql`CASE WHEN jsonb_typeof(${careEntriesTable.details} -> ${CARE_ENTRY_SYNC_REVISION_KEY}) = 'number' THEN CASE WHEN (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric >= 0 AND (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric <= 9007199254740991 AND trunc((${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric) = (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::numeric THEN (${careEntriesTable.details} ->> ${CARE_ENTRY_SYNC_REVISION_KEY})::bigint ELSE 0 END ELSE 0 END`;
    const revisionGuard = usesRevisionProtocol
      ? sql`${storedRevision} = ${incomingRevision - 1}`
      : sql`${storedRevision} < ${incomingRevision}`;
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
        updatedAt: now(),
      })
      .where(
        and(
          eq(careEntriesTable.id, params.data.id),
          eq(careEntriesTable.householdId, householdId),
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
          ),
        )
        .limit(1);
      if (!current) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }
      res.status(409).json({
        error:
          "A newer care entry update already exists. Refresh before retrying.",
        entry: UpdateCareEntryResponse.parse(current),
      });
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
      const householdId = await getActiveHouseholdId(userId);
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
            ),
          )
          .returning();

        deleted = removed;

        if (deleted) {
          await tx.insert(careEntryTombstonesTable).values({
            householdId,
            entryId: deleted.id,
            petId: deleted.petId,
            deletedByUserId: userId,
            deletedAt,
            updatedAt: deletedAt,
          });
        }
      });

      if (!deleted) {
        res.status(404).json({ error: "Entry not found" });
        return;
      }

      res.sendStatus(204);
    },
  );

  return router;
}
