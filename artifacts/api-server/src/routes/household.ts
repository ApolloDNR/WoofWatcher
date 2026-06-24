import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, householdsTable, householdMembersTable, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  JoinHouseholdResponse,
  UpdateMeBody,
  UpdateHouseholdBody,
  JoinHouseholdBody,
  UpdateHouseholdMemberParams,
  UpdateHouseholdMemberBody,
  UpdateHouseholdMemberResponse,
  RevokeHouseholdMemberParams,
  RevokeHouseholdMemberResponse,
  AccessPassActivationBody,
  AccessPassRevocationBody,
  HouseholdAccessPassMutationResponse,
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
import {
  assertAccessPassMutationAllowed,
  buildHouseholdAuditEvent,
  normalizeAccessPassRole,
} from "../lib/household-access-pass";

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
      role: normalizeHouseholdMemberRole("adult"),
      displayName: user?.displayName ?? null,
    });
  }

  const auditEvent = buildHouseholdAuditEvent({
    action: "invitation-accepted",
    actorUserId: userId,
    householdId: household.id,
    targetUserId: userId,
    targetRole: inThisHousehold ? "existing-member" : null,
    nextRole: normalizeHouseholdMemberRole("adult"),
    reason: inThisHousehold
      ? "Existing household member opened an invite code."
      : "Invite code accepted and caregiver membership created.",
  });

  res.json(
    JoinHouseholdResponse.parse({
      ...(await buildMe(userId, household.id)),
      auditEvent,
    }),
  );
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
  const nextRole =
    parsed.data.role !== undefined
      ? normalizeHouseholdMemberRole(parsed.data.role)
      : normalizeHouseholdMemberRole(target.role);

  await db
    .update(householdMembersTable)
    .set({
      ...(parsed.data.role !== undefined
        ? { role: nextRole }
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

  const auditEvent = buildHouseholdAuditEvent({
    action: "member-role-updated",
    actorUserId: userId,
    householdId,
    targetMemberId: target.id,
    targetUserId: target.userId,
    targetRole: normalizeHouseholdMemberRole(target.role),
    nextRole,
    reason: policy.reason,
  });

  res.json(
    UpdateHouseholdMemberResponse.parse({
      ...(await buildMe(userId, householdId)),
      auditEvent,
    }),
  );
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

    const auditEvent = buildHouseholdAuditEvent({
      action: "member-revoked",
      actorUserId: userId,
      householdId,
      targetMemberId: target.id,
      targetUserId: target.userId,
      targetRole: normalizeHouseholdMemberRole(target.role),
      reason: policy.reason,
    });

    await db
      .delete(householdMembersTable)
      .where(
        and(
          eq(householdMembersTable.id, params.data.id),
          eq(householdMembersTable.householdId, householdId),
        ),
      );

    res.json(
      RevokeHouseholdMemberResponse.parse({
        ...(await buildMe(userId, householdId)),
        auditEvent,
      }),
    );
  },
);

router.post("/household/access-passes/activate", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = AccessPassActivationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  const [target] = await db
    .select()
    .from(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.id, parsed.data.memberId),
        eq(householdMembersTable.householdId, householdId),
      ),
    )
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Household member not found" });
    return;
  }

  const nextRole = normalizeAccessPassRole(parsed.data.role);
  const policy = assertAccessPassMutationAllowed({
    actorRole: actor?.role,
    targetRole: target.role,
    nextRole,
    targetIsSelf: target.userId === userId,
    action: "activate",
  });
  if (!policy.allowed) {
    res.status(403).json({ error: policy.reason });
    return;
  }

  await db
    .update(householdMembersTable)
    .set({
      role: nextRole,
      ...(parsed.data.displayName !== undefined
        ? { displayName: parsed.data.displayName ?? null }
        : {}),
    })
    .where(
      and(
        eq(householdMembersTable.id, parsed.data.memberId),
        eq(householdMembersTable.householdId, householdId),
      ),
    );

  const auditEvent = buildHouseholdAuditEvent({
    action: "access-pass-activated",
    actorUserId: userId,
    householdId,
    targetMemberId: target.id,
    targetUserId: target.userId,
    targetRole: normalizeHouseholdMemberRole(target.role),
    nextRole,
    reason: policy.reason,
    note: parsed.data.note,
    expiresAt: parsed.data.expiresAt,
  });

  res.json(
    HouseholdAccessPassMutationResponse.parse({
      ...(await buildMe(userId, householdId)),
      accessPass: {
        memberId: target.id,
        userId: target.userId,
        role: nextRole,
        status: "active",
        expiresAt: parsed.data.expiresAt ?? null,
        note: parsed.data.note ?? null,
      },
      auditEvent,
    }),
  );
});

router.post("/household/access-passes/revoke", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = AccessPassRevocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  const [target] = await db
    .select()
    .from(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.id, parsed.data.memberId),
        eq(householdMembersTable.householdId, householdId),
      ),
    )
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "Household member not found" });
    return;
  }

  const policy = assertAccessPassMutationAllowed({
    actorRole: actor?.role,
    targetRole: target.role,
    targetIsSelf: target.userId === userId,
    action: "revoke",
  });
  if (!policy.allowed) {
    res.status(403).json({ error: policy.reason });
    return;
  }

  const auditEvent = buildHouseholdAuditEvent({
    action: "access-pass-revoked",
    actorUserId: userId,
    householdId,
    targetMemberId: target.id,
    targetUserId: target.userId,
    targetRole: normalizeHouseholdMemberRole(target.role),
    reason: parsed.data.reason ?? policy.reason,
  });

  await db
    .delete(householdMembersTable)
    .where(
      and(
        eq(householdMembersTable.id, parsed.data.memberId),
        eq(householdMembersTable.householdId, householdId),
      ),
    );

  res.json(
    HouseholdAccessPassMutationResponse.parse({
      ...(await buildMe(userId, householdId)),
      accessPass: {
        memberId: target.id,
        userId: target.userId,
        role: normalizeHouseholdMemberRole(target.role),
        status: "revoked",
        expiresAt: null,
        note: parsed.data.reason ?? null,
      },
      auditEvent,
    }),
  );
});

export default router;
