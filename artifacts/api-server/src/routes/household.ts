import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  householdsTable,
  householdAuditEventsTable,
  householdInvitationsTable,
  householdMembersTable,
  usersTable,
} from "@workspace/db";
import {
  GetMeResponse,
  JoinHouseholdResponse,
  UpdateMeBody,
  JoinHouseholdBody,
  UpdateHouseholdMemberParams,
  UpdateHouseholdMemberBody,
  UpdateHouseholdMemberResponse,
  RevokeHouseholdMemberParams,
  RevokeHouseholdMemberResponse,
  AccessPassActivationBody,
  AccessPassRevocationBody,
  HouseholdAccessPassMutationResponse,
  ListHouseholdAuditEventsQueryParams,
  ListHouseholdAuditEventsResponse,
  ListHouseholdInvitationsQueryParams,
  ListHouseholdInvitationsResponse,
  CreateHouseholdInvitationBody,
  HouseholdInvitationMutationResponse,
  RevokeHouseholdInvitationParams,
  RevokeHouseholdInvitationBody,
  ListHouseholdSharingCleanupQueryParams,
  ListHouseholdSharingCleanupResponse,
} from "@workspace/api-zod";
import { requireAuth, getUserId } from "../lib/auth";
import { rejectMismatchedHouseholdRequestScope } from "../lib/household-request-scope";
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
  assertAccessPassExpiryAllowed,
  buildHouseholdAuditEvent,
  buildHouseholdAuditEventFromRecord,
  buildHouseholdAuditInsert,
  normalizeHouseholdAuditListQuery,
  normalizeAccessPassRole,
  isAccessPassHelperRole,
} from "../lib/household-access-pass";
import {
  HOUSEHOLD_INVITATION_BOUNDARY,
  assertHouseholdInvitationAcceptAllowed,
  buildHouseholdInvitationView,
  deriveHouseholdInvitationRuntimeStatus,
  normalizeHouseholdInvitationExpiry,
  normalizeHouseholdInvitationLifecycleState,
  normalizeHouseholdInvitationListQuery,
} from "../lib/household-invitations";
import {
  HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
  buildHouseholdSharingCleanupCandidates,
  normalizeHouseholdSharingCleanupQuery,
} from "../lib/household-sharing-cleanup";
import { createHouseholdUpdateRouter } from "./household-update-router.ts";

const router: IRouter = Router();

const INVITATION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeInvitationCode(): string {
  return Array.from(randomBytes(8), (byte) =>
    INVITATION_CODE_ALPHABET[byte % INVITATION_CODE_ALPHABET.length],
  ).join("");
}

async function makeUniqueInvitationCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeInvitationCode();
    const [invitationCollision] = await db
      .select({ id: householdInvitationsTable.id })
      .from(householdInvitationsTable)
      .where(eq(householdInvitationsTable.inviteCode, code))
      .limit(1);
    const [legacyCollision] = await db
      .select({ id: householdsTable.id })
      .from(householdsTable)
      .where(eq(householdsTable.inviteCode, code))
      .limit(1);
    if (!invitationCollision && !legacyCollision) return code;
  }

  throw new Error("Unable to create a unique household invitation code.");
}

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

router.use(
  createHouseholdUpdateRouter({
    requireAuth,
    getUserId,
    ensureUserAndHousehold,
    getHouseholdMemberAuthz,
    rejectMismatchedHouseholdRequestScope,
    async updateHouseholdName(householdId, name) {
      await db
        .update(householdsTable)
        .set({ name })
        .where(eq(householdsTable.id, householdId));
    },
    buildMe,
  }),
);

router.get("/household/invitations", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListHouseholdInvitationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  if (actor?.role !== "owner") {
    res.status(403).json({
      error:
        "Only an owner/admin can review household invitations before caregiver memberships are created.",
    });
    return;
  }

  const filters = normalizeHouseholdInvitationListQuery(parsed.data);
  const conditions = [eq(householdInvitationsTable.householdId, householdId)];
  if (filters.lifecycleState) {
    conditions.push(eq(householdInvitationsTable.lifecycleState, filters.lifecycleState));
  }

  const rows = await db
    .select()
    .from(householdInvitationsTable)
    .where(and(...conditions))
    .orderBy(desc(householdInvitationsTable.createdAt))
    .limit(filters.limit);

  res.json(
    ListHouseholdInvitationsResponse.parse({
      invitations: rows.map((row) => buildHouseholdInvitationView(row)),
      limit: filters.limit,
      filters: {
        ...(filters.lifecycleState
          ? { lifecycleState: filters.lifecycleState }
          : {}),
      },
      boundary: HOUSEHOLD_INVITATION_BOUNDARY,
    }),
  );
});

router.post("/household/invitations", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateHouseholdInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  if (actor?.role !== "owner") {
    res.status(403).json({
      error:
        "Only an owner/admin can create household invitations for caregiver access.",
    });
    return;
  }

  const lifecycleState = normalizeHouseholdInvitationLifecycleState(
    parsed.data.lifecycleState ?? "approved",
  );
  if (lifecycleState !== "approved" && lifecycleState !== "pending-approval") {
    res.status(400).json({
      error:
        "New household invitations can only start as approved or pending approval.",
    });
    return;
  }

  const expiresAt = normalizeHouseholdInvitationExpiry(
    parsed.data.expiresAt?.toISOString() ?? null,
  );
  if (parsed.data.expiresAt && !expiresAt) {
    res.status(400).json({ error: "Invitation expiration must be a valid ISO date." });
    return;
  }
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    res.status(400).json({
      error: "Invitation expiration must be in the future before sharing.",
    });
    return;
  }

  const requestedRole = normalizeHouseholdMemberRole(parsed.data.role ?? "adult");
  const role = requestedRole === "owner" ? "adult" : requestedRole;
  const inviteCode = await makeUniqueInvitationCode();
  const [invitation] = await db
    .insert(householdInvitationsTable)
    .values({
      householdId,
      inviteCode,
      invitedEmail: parsed.data.invitedEmail ?? null,
      role,
      lifecycleState,
      createdByUserId: userId,
      approvedByUserId: lifecycleState === "approved" ? userId : null,
      note: parsed.data.note ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      metadata: {
        boundary: HOUSEHOLD_INVITATION_BOUNDARY,
        storage: "provider-durable",
      },
    })
    .returning();

  const auditEvent = buildHouseholdAuditEvent({
    action: "invitation-created",
    actorUserId: userId,
    householdId,
    nextRole: role,
    reason:
      lifecycleState === "approved"
        ? "Owner/admin created an approved household invitation."
        : "Owner/admin staged an invitation that still needs approval before acceptance.",
    note: parsed.data.note,
    expiresAt,
  });
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

  res.status(201).json(
    HouseholdInvitationMutationResponse.parse({
      invitation: buildHouseholdInvitationView(invitation),
      auditEvent,
    }),
  );
});

router.post("/household/invitations/:id/revoke", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const params = RevokeHouseholdInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RevokeHouseholdInvitationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  if (actor?.role !== "owner") {
    res.status(403).json({
      error:
        "Only an owner/admin can revoke household invitations before acceptance.",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(householdInvitationsTable)
    .where(
      and(
        eq(householdInvitationsTable.id, params.data.id),
        eq(householdInvitationsTable.householdId, householdId),
      ),
    )
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Household invitation not found" });
    return;
  }

  const now = new Date();
  const [invitation] = await db
    .update(householdInvitationsTable)
    .set({
      lifecycleState: "revoked",
      revokedByUserId: userId,
      revokedAt: now,
      note: parsed.data.reason ?? existing.note ?? null,
      updatedAt: now,
    })
    .where(
      and(
        eq(householdInvitationsTable.id, params.data.id),
        eq(householdInvitationsTable.householdId, householdId),
      ),
    )
    .returning();

  const auditEvent = buildHouseholdAuditEvent({
    action: "invitation-revoked",
    actorUserId: userId,
    householdId,
    targetRole: existing.role,
    reason: parsed.data.reason ?? "Owner/admin revoked a household invitation.",
    expiresAt: invitation.expiresAt ? invitation.expiresAt.toISOString() : null,
  });
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

  res.json(
    HouseholdInvitationMutationResponse.parse({
      invitation: buildHouseholdInvitationView(invitation),
      auditEvent,
    }),
  );
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
  const [invitation] = await db
    .select()
    .from(householdInvitationsTable)
    .where(eq(householdInvitationsTable.inviteCode, code))
    .limit(1);
  let household;
  let acceptedInvitation = null;
  let nextMemberRole = normalizeHouseholdMemberRole("adult");

  if (invitation) {
    const runtime = deriveHouseholdInvitationRuntimeStatus({
      lifecycleState: invitation.lifecycleState,
      expiresAt: invitation.expiresAt,
    });
    const policy = assertHouseholdInvitationAcceptAllowed(runtime);
    if (!policy.allowed) {
      if (
        policy.lifecycleState === "expired" &&
        invitation.lifecycleState !== "expired"
      ) {
        await db
          .update(householdInvitationsTable)
          .set({ lifecycleState: "expired", updatedAt: new Date() })
          .where(eq(householdInvitationsTable.id, invitation.id));
      }
      res.status(403).json({
        error: policy.reason ?? "Invitation is not approved for acceptance.",
      });
      return;
    }

    const [invitedHousehold] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.id, invitation.householdId))
      .limit(1);
    household = invitedHousehold;
    acceptedInvitation = invitation;
    nextMemberRole = normalizeHouseholdMemberRole(invitation.role);
  } else {
    const [legacyHousehold] = await db
      .select()
      .from(householdsTable)
      .where(eq(householdsTable.inviteCode, code))
      .limit(1);
    household = legacyHousehold;
  }

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
      role: nextMemberRole,
      displayName: user?.displayName ?? null,
    });
  }

  const auditEvent = buildHouseholdAuditEvent({
    action: "invitation-accepted",
    actorUserId: userId,
    householdId: household.id,
    targetUserId: userId,
    targetRole: inThisHousehold ? "existing-member" : null,
    nextRole: nextMemberRole,
    reason: inThisHousehold
      ? "Existing household member opened an invite code."
      : "Invite code accepted and caregiver membership created.",
  });
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

  if (acceptedInvitation) {
    await db
      .update(householdInvitationsTable)
      .set({
        lifecycleState: "accepted",
        acceptedByUserId: userId,
        acceptedAt: new Date(auditEvent.createdAt),
        invitedUserId: userId,
        updatedAt: new Date(auditEvent.createdAt),
      })
      .where(eq(householdInvitationsTable.id, acceptedInvitation.id));
  }

  res.json(
    JoinHouseholdResponse.parse({
      ...(await buildMe(userId, household.id)),
      auditEvent,
    }),
  );
});

router.get("/household/sharing-cleanup", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListHouseholdSharingCleanupQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  if (actor?.role !== "owner") {
    res.status(403).json({
      error:
        "Only an owner/admin can review expired household sharing cleanup candidates.",
    });
    return;
  }

  const filters = normalizeHouseholdSharingCleanupQuery(parsed.data);
  const invitations = await db
    .select()
    .from(householdInvitationsTable)
    .where(eq(householdInvitationsTable.householdId, householdId))
    .orderBy(desc(householdInvitationsTable.createdAt))
    .limit(200);
  const members = await db
    .select({
      id: householdMembersTable.id,
      householdId: householdMembersTable.householdId,
      userId: householdMembersTable.userId,
      role: householdMembersTable.role,
      displayName: householdMembersTable.displayName,
      accessPassExpiresAt: householdMembersTable.accessPassExpiresAt,
      createdAt: householdMembersTable.createdAt,
    })
    .from(householdMembersTable)
    .where(eq(householdMembersTable.householdId, householdId))
    .limit(200);

  const candidates = buildHouseholdSharingCleanupCandidates(
    { invitations, members },
    filters,
  );
  const expiredInvitationCount = candidates.filter(
    (candidate) => candidate.kind === "expired-invitation",
  ).length;
  const expiredAccessPassCount = candidates.filter(
    (candidate) => candidate.kind === "expired-access-pass",
  ).length;

  res.json(
    ListHouseholdSharingCleanupResponse.parse({
      candidates,
      limit: filters.limit,
      filters: {
        ...(filters.kind ? { kind: filters.kind } : {}),
      },
      pendingReviewCount: candidates.length,
      expiredInvitationCount,
      expiredAccessPassCount,
      boundary: HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
    }),
  );
});

router.get("/household/audit-events", requireAuth, async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = ListHouseholdAuditEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { householdId } = await ensureUserAndHousehold(userId);
  const actor = await getHouseholdMemberAuthz(householdId, userId);
  if (actor?.role !== "owner") {
    res.status(403).json({
      error:
        "Only an owner/admin can review durable household invite, role, and Access Pass audit events.",
    });
    return;
  }

  const filters = normalizeHouseholdAuditListQuery(parsed.data);
  const conditions = [eq(householdAuditEventsTable.householdId, householdId)];
  if (filters.action) {
    conditions.push(eq(householdAuditEventsTable.action, filters.action));
  }
  if (filters.lifecycleState) {
    conditions.push(eq(householdAuditEventsTable.lifecycleState, filters.lifecycleState));
  }

  const rows = await db
    .select()
    .from(householdAuditEventsTable)
    .where(and(...conditions))
    .orderBy(desc(householdAuditEventsTable.createdAt))
    .limit(filters.limit);

  res.json(
    ListHouseholdAuditEventsResponse.parse({
      events: rows.map(buildHouseholdAuditEventFromRecord),
      limit: filters.limit,
      filters: {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.lifecycleState ? { lifecycleState: filters.lifecycleState } : {}),
      },
      boundary:
        "Durable household audit review is provider-ready for owner/admin review; migration, RLS, retention, and export/deletion policy remain launch approval gates.",
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
        ? {
            role: nextRole,
            accessPassExpiresAt: isAccessPassHelperRole(nextRole)
              ? target.accessPassExpiresAt
              : null,
          }
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
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

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
    await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

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
  const expiryPolicy = assertAccessPassExpiryAllowed(parsed.data.expiresAt);
  if (!expiryPolicy.allowed) {
    res.status(400).json({ error: expiryPolicy.reason });
    return;
  }

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
      accessPassExpiresAt: expiryPolicy.expiresAt ? new Date(expiryPolicy.expiresAt) : null,
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
    expiresAt: expiryPolicy.expiresAt,
  });
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

  res.json(
    HouseholdAccessPassMutationResponse.parse({
      ...(await buildMe(userId, householdId)),
      accessPass: {
        memberId: target.id,
        userId: target.userId,
        role: nextRole,
        status: "active",
        expiresAt: expiryPolicy.expiresAt,
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
  await db.insert(householdAuditEventsTable).values(buildHouseholdAuditInsert(auditEvent));

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
