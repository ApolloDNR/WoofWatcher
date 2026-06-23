import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, householdsTable, householdMembersTable, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateHouseholdBody,
  JoinHouseholdBody,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import {
  ensureUserAndHousehold,
  ensureUser,
  ensureCareState,
  buildMe,
  requireActiveHouseholdRole,
} from "../lib/household";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const { householdId } = await ensureUserAndHousehold(userId);
  res.json(GetMeResponse.parse(await buildMe(userId, householdId)));
});

router.patch("/me", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { householdId } = await ensureUserAndHousehold(userId);
  if (parsed.data.displayName != null) {
    await db
      .update(usersTable)
      .set({ displayName: parsed.data.displayName })
      .where(eq(usersTable.id, userId));
    await db
      .update(householdMembersTable)
      .set({ displayName: parsed.data.displayName })
      .where(
        and(
          eq(householdMembersTable.userId, userId),
          eq(householdMembersTable.householdId, householdId),
        ),
      );
  }
  res.json(GetMeResponse.parse(await buildMe(userId, householdId)));
});

router.patch("/household", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = UpdateHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { householdId, allowed } = await requireActiveHouseholdRole(userId, ["owner", "admin"]);
  if (!allowed) {
    res.status(403).json({ error: "Only household owners can rename this pack" });
    return;
  }
  await db
    .update(householdsTable)
    .set({ name: parsed.data.name })
    .where(eq(householdsTable.id, householdId));
  res.json(GetMeResponse.parse(await buildMe(userId, householdId)));
});

router.post("/household/join", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = JoinHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = parsed.data.inviteCode.trim().toUpperCase();
  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.inviteCode, code));
  if (!household) {
    res.status(404).json({ error: "Invite code not found" });
    return;
  }

  const user = await ensureUser(userId);
  await ensureCareState(household.id, userId);

  const memberships = await db
    .select({ householdId: householdMembersTable.householdId })
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));
  const inThisHousehold = memberships.some(
    (m) => m.householdId === household.id,
  );

  if (!inThisHousehold) {
    await db.insert(householdMembersTable).values({
      householdId: household.id,
      userId,
      role: "member",
      displayName: user?.displayName ?? null,
    });
  }

  await db
    .update(usersTable)
    .set({ activeHouseholdId: household.id })
    .where(eq(usersTable.id, userId));

  res.json(GetMeResponse.parse(await buildMe(userId, household.id)));
});

export default router;
