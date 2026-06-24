import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  householdsTable,
  householdAuditEventsTable,
  householdMembersTable,
  usersTable,
} from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateHouseholdBody,
  JoinHouseholdBody,
  SetActiveHouseholdBody,
  ListHouseholdAuditEventsQueryParams,
  ListHouseholdAuditEventsResponse,
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

router.patch("/me/active-household", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = SetActiveHouseholdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureUser(userId);
  const [membership] = await db
    .select({ householdId: householdMembersTable.householdId })
    .from(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.userId, userId),
        eq(householdMembersTable.householdId, parsed.data.householdId),
      ),
    )
    .limit(1);

  if (!membership) {
    res.status(404).json({ error: "Household membership not found" });
    return;
  }

  await ensureCareState(parsed.data.householdId, userId);
  await db
    .update(usersTable)
    .set({ activeHouseholdId: parsed.data.householdId })
    .where(eq(usersTable.id, userId));

  res.json(GetMeResponse.parse(await buildMe(userId, parsed.data.householdId)));
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

router.get("/household/audit-events", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListHouseholdAuditEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId, allowed } = await requireActiveHouseholdRole(userId, ["owner", "admin"]);
  if (!allowed) {
    res.status(403).json({ error: "Only household owners can review audit events" });
    return;
  }

  const limit = Math.min(200, Math.max(1, parsed.data.limit ?? 50));
  const filters = [eq(householdAuditEventsTable.householdId, householdId)];
  if (parsed.data.action) {
    filters.push(eq(householdAuditEventsTable.action, parsed.data.action));
  }
  if (parsed.data.lifecycleState) {
    filters.push(eq(householdAuditEventsTable.lifecycleState, parsed.data.lifecycleState));
  }

  const rows = await db
    .select()
    .from(householdAuditEventsTable)
    .where(and(...filters))
    .orderBy(desc(householdAuditEventsTable.createdAt))
    .limit(limit);

  res.json(ListHouseholdAuditEventsResponse.parse(rows));
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
