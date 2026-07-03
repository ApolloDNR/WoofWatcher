import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, careEntriesTable, careEntryTombstonesTable } from "@workspace/db";
import { normalizeCareEventType } from "@workspace/care-domain";
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
import { requireAuth, getUserId } from "../lib/auth";
import {
  getActiveHouseholdId,
  getCaregiverName,
  getHouseholdMemberAuthz,
} from "../lib/household";
import {
  applyCareEntryWritePolicy,
  assertCareEntryWriteAllowed,
} from "../lib/care-entry-authorization";
import {
  normalizeListCareEntriesQuery,
  normalizeListCareEntryTombstonesQuery,
} from "../lib/care-entry-query";

const router: IRouter = Router();

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

  const [entry] = await db
    .insert(careEntriesTable)
    .values({
      householdId,
      petId: parsed.data.petId ?? null,
      type: normalizeCareEventType(parsed.data.type, policy.details),
      occurredAt: parsed.data.occurredAt ?? new Date(),
      caregiverUserId: userId,
      caregiverName,
      mood: parsed.data.mood ?? null,
      severity: parsed.data.severity ?? null,
      note: parsed.data.note ?? null,
      details: policy.details,
    })
    .returning();

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
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(careEntriesTable.id, params.data.id),
        eq(careEntriesTable.householdId, householdId),
      ),
    )
    .returning();

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

    let deleted: typeof careEntriesTable.$inferSelect | undefined;
    const deletedAt = new Date();

    await db.transaction(async (tx) => {
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

export default router;
