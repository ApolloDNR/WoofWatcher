import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, householdsTable, householdMembersTable, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateHouseholdBody,
  JoinHouseholdBody,
  UpdateHouseholdMemberParams,
  UpdateHouseholdMemberBody,
  RevokeHouseholdMemberParams,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import {
  ensureUserAndHousehold,
  buildMe,
  getHouseholdMemberAuthz,
} from "../lib/household";
import {
  assertHouseholdMemberMutationAllowed,
  normalizeHouseholdMemberRole,
} from "../lib/household-authorization";

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
      .where(eq(householdMembersTable.userId, userId));
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
  const { householdId } = await ensureUserAndHousehold(userId);
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
  // Ensure the user is provisioned first.
  await ensureUserAndHousehold(userId);

  const code = parsed.data.inviteCode.trim().toUpperCase();
  const [household] = await db
    .select()
    .from(householdsTable)
    .where(eq(householdsTable.inviteCode, code));
  if (!household) {
    res.status(404).json({ error: "Invite code not found" });
    return;
  }

  const memberships = await db
    .select({ householdId: householdMembersTable.householdId })
    .from(householdMembersTable)
    .where(eq(householdMembersTable.userId, userId));
  const inThisHousehold = memberships.some(
    (m) => m.householdId === household.id,
  );

  if (!inThisHousehold) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    await db.insert(householdMembersTable).values({
      householdId: household.id,
      userId,
      role: "member",
      displayName: user?.displayName ?? null,
    });
  }

  res.json(GetMeResponse.parse(await buildMe(userId, household.id)));
});

router.patch("/household/members/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = UpdateHouseholdMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateHouseholdMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.role === undefined && parsed.data.displayName === undefined) {
    res.status(400).json({ error: "Provide a role or display name to update." });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  const [target] = await db
    .select()
    .from(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.id, params.data.id),
        eq(householdMembersTable.householdId, householdId),
      ),
    )
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Household member not found" });
    return;
  }

  const policy = assertHouseholdMemberMutationAllowed({
    actorRole: actor?.role,
    targetRole: target.role,
    nextRole: parsed.data.role,
    targetIsSelf: target.userId === userId,
    action: "update-role",
  });
  if (!policy.allowed) {
    res.status(403).json({ error: policy.reason });
    return;
  }

  await db
    .update(householdMembersTable)
    .set({
      ...(parsed.data.role !== undefined
        ? { role: normalizeHouseholdMemberRole(parsed.data.role) }
        : {}),
      ...(parsed.data.displayName !== undefined
        ? { displayName: parsed.data.displayName ?? null }
        : {}),
    })
    .where(
      and(
        eq(householdMembersTable.id, params.data.id),
        eq(householdMembersTable.householdId, householdId),
      ),
    );

  res.json(GetMeResponse.parse(await buildMe(userId, householdId)));
});

router.delete(
  "/household/members/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = getUserId(req);
    const params = RevokeHouseholdMemberParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const { householdId } = await ensureUserAndHousehold(userId);
    const actor = await getHouseholdMemberAuthz(householdId, userId);
    const [target] = await db
      .select()
      .from(householdMembersTable)
      .where(
        and(
          eq(householdMembersTable.id, params.data.id),
          eq(householdMembersTable.householdId, householdId),
        ),
      )
      .limit(1);

    if (!target) {
      res.status(404).json({ error: "Household member not found" });
      return;
    }

    const policy = assertHouseholdMemberMutationAllowed({
      actorRole: actor?.role,
      targetRole: target.role,
      targetIsSelf: target.userId === userId,
      action: "revoke",
    });
    if (!policy.allowed) {
      res.status(403).json({ error: policy.reason });
      return;
    }

    await db
      .delete(householdMembersTable)
      .where(
        and(
          eq(householdMembersTable.id, params.data.id),
          eq(householdMembersTable.householdId, householdId),
        ),
      );

    res.sendStatus(204);
  },
);

export default router;
