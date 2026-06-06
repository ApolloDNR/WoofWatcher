import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, careEntriesTable } from "@workspace/db";
import { normalizeCareEventType } from "@workspace/care-domain";
import {
  ListCareEntriesResponse,
  ListCareEntriesResponseItem,
  CreateCareEntryBody,
  UpdateCareEntryParams,
  UpdateCareEntryBody,
  UpdateCareEntryResponse,
  DeleteCareEntryParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import { getActiveHouseholdId, getCaregiverName } from "../lib/household";

const router: IRouter = Router();

router.get("/care-entries", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const householdId = await getActiveHouseholdId(userId);

  const sinceRaw = Array.isArray(req.query.since)
    ? req.query.since[0]
    : req.query.since;
  const since =
    typeof sinceRaw === "string" ? new Date(sinceRaw) : undefined;
  const hasSince = since != null && !Number.isNaN(since.getTime());

  const where = hasSince
    ? and(
        eq(careEntriesTable.householdId, householdId),
        gte(careEntriesTable.occurredAt, since),
      )
    : eq(careEntriesTable.householdId, householdId);

  const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(500, Math.max(1, parseInt(typeof limitRaw === "string" ? limitRaw : "250", 10) || 250));

  const rows = await db
    .select()
    .from(careEntriesTable)
    .where(where)
    .orderBy(desc(careEntriesTable.occurredAt))
    .limit(limit);

  res.json(ListCareEntriesResponse.parse(rows));
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

  const [entry] = await db
    .insert(careEntriesTable)
    .values({
      householdId,
      petId: parsed.data.petId ?? null,
      type: normalizeCareEventType(parsed.data.type, parsed.data.details),
      occurredAt: parsed.data.occurredAt ?? new Date(),
      caregiverUserId: userId,
      caregiverName,
      mood: parsed.data.mood ?? null,
      severity: parsed.data.severity ?? null,
      note: parsed.data.note ?? null,
      details: parsed.data.details ?? null,
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

  const [updated] = await db
    .update(careEntriesTable)
    .set({
      ...(parsed.data.type !== undefined
        ? { type: normalizeCareEventType(parsed.data.type, parsed.data.details) }
        : {}),
      ...(parsed.data.occurredAt !== undefined
        ? { occurredAt: parsed.data.occurredAt }
        : {}),
      ...(parsed.data.mood !== undefined ? { mood: parsed.data.mood } : {}),
      ...(parsed.data.severity !== undefined
        ? { severity: parsed.data.severity }
        : {}),
      ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
      ...(parsed.data.details !== undefined
        ? { details: parsed.data.details }
        : {}),
    })
    .where(
      and(
        eq(careEntriesTable.id, params.data.id),
        eq(careEntriesTable.householdId, householdId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Entry not found" });
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

    const [deleted] = await db
      .delete(careEntriesTable)
      .where(
        and(
          eq(careEntriesTable.id, params.data.id),
          eq(careEntriesTable.householdId, householdId),
        ),
      )
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
