import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, careStateTable } from "@workspace/db";
import { GetCareStateResponse, PutCareStateBody } from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import {
  CARE_PLAN_WRITE_FORBIDDEN_ERROR,
  getActiveHouseholdId,
  requireActiveHouseholdCarePlanWrite,
} from "../lib/household";

const router: IRouter = Router();

router.get("/care-state", requireAuth, async (req, res): Promise<void> => {
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
  res.json(
    GetCareStateResponse.parse({
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
  const { householdId, allowed } = await requireActiveHouseholdCarePlanWrite(userId);
  if (!allowed) {
    res.status(403).json({ error: CARE_PLAN_WRITE_FORBIDDEN_ERROR });
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

  // Optimistic concurrency: reject stale writes so a slow device can't
  // clobber newer data. The client refetches and merges on 409.
  if (current.version !== parsed.data.version) {
    res.status(409).json(
      GetCareStateResponse.parse({
        version: current.version,
        updatedAt: current.updatedAt,
        updatedBy: current.updatedBy,
        doc: current.doc,
      }),
    );
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

    res.status(409).json(
      GetCareStateResponse.parse({
        version: refreshed.version,
        updatedAt: refreshed.updatedAt,
        updatedBy: refreshed.updatedBy,
        doc: refreshed.doc,
      }),
    );
    return;
  }

  res.json(
    GetCareStateResponse.parse({
      version: updated.version,
      updatedAt: updated.updatedAt,
      updatedBy: updated.updatedBy,
      doc: updated.doc,
    }),
  );
});

export default router;
