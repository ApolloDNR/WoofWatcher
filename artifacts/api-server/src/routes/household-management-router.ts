import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import {
  AccessPassActivationBody,
  AccessPassRevocationBody,
  GetMeResponse,
  HouseholdAccessPassMutationResponse,
  HouseholdInvitationMutationResponse,
  ListHouseholdAuditEventsQueryParams,
  ListHouseholdAuditEventsResponse,
  ListHouseholdInvitationsQueryParams,
  ListHouseholdInvitationsResponse,
  ListHouseholdSharingCleanupQueryParams,
  ListHouseholdSharingCleanupResponse,
  RevokeHouseholdMemberParams,
  RevokeHouseholdMemberResponse,
  RevokeHouseholdInvitationBody,
  RevokeHouseholdInvitationParams,
  UpdateHouseholdBody,
  UpdateHouseholdMemberBody,
  UpdateHouseholdMemberParams,
  UpdateHouseholdMemberResponse,
} from "@workspace/api-zod";

import {
  assertAccessPassExpiryAllowed,
  assertAccessPassMutationAllowed,
  buildHouseholdAuditEvent,
  buildHouseholdAuditEventFromRecord,
  buildHouseholdAuditInsert,
  isAccessPassHelperRole,
  normalizeAccessPassRole,
  normalizeHouseholdAuditListQuery,
  type HouseholdAuditEvent,
} from "../lib/household-access-pass.ts";
import { assertHouseholdMemberMutationAllowed } from "../lib/household-authorization.ts";
import type { MePayload } from "../lib/household.ts";
import {
  HouseholdInvitationRevocationError,
  revokePreAcceptanceInvitation,
  type RevocableHouseholdInvitation,
} from "../lib/household-invitation-revocation.ts";
import {
  HOUSEHOLD_INVITATION_BOUNDARY,
  buildHouseholdInvitationView,
  normalizeHouseholdInvitationListQuery,
  type HouseholdInvitationRecordLike,
} from "../lib/household-invitations.ts";
import {
  parseHouseholdMemberRole,
  resolveHouseholdMembershipAuthority,
  type HouseholdMemberRole,
} from "../lib/household-role-authority.ts";
import {
  HOUSEHOLD_SCOPED_INTEGRITY_ERROR,
  HouseholdScopedOperationError,
  type HouseholdScopedOperationScope,
  type RunHouseholdScopedOperation,
} from "../lib/household-scoped-operation.ts";
import {
  HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
  buildHouseholdSharingCleanupCandidates,
  normalizeHouseholdSharingCleanupQuery,
} from "../lib/household-sharing-cleanup.ts";
import { parseExpectedHouseholdCapability } from "./household-capability.ts";
import { runHouseholdScopedRouteOperation } from "./household-scoped-operation-response.ts";

type QueryOperator = (...args: any[]) => any;
type PersistedHouseholdInvitation = HouseholdInvitationRecordLike &
  RevocableHouseholdInvitation;

export interface HouseholdManagementRouterDependencies {
  tables: {
    householdsTable: any;
    householdAuditEventsTable: any;
    householdInvitationsTable: any;
    householdMembersTable: any;
  };
  queryOps: {
    and: QueryOperator;
    desc: QueryOperator;
    eq: QueryOperator;
    inArray: QueryOperator;
  };
  requireAuth: (req: Request, res: Response, next: NextFunction) => void;
  getUserId: (req: Request) => string;
  runHouseholdScopedOperation: RunHouseholdScopedOperation;
  buildMeInTransaction: (
    transaction: any,
    userId: string,
    householdId: string,
  ) => Promise<MePayload>;
}

function requireOwner(
  scope: HouseholdScopedOperationScope,
  message: string,
  reply: { status(status: number): { json(body: unknown): void } },
): boolean {
  if (scope.role === "owner") return true;
  reply.status(403).json({ error: message });
  return false;
}

function conflict(message: string): never {
  throw new HouseholdScopedOperationError(message, 409);
}

function requireCanonicalTargetRole(
  target: { role: string; accessPassExpiresAt?: Date | string | null },
  now: Date,
): HouseholdMemberRole {
  const authority = resolveHouseholdMembershipAuthority({
    role: target.role,
    accessPassExpiresAt: target.accessPassExpiresAt ?? null,
    now,
  });
  if (authority.state === "invalid" || !authority.role) {
    return conflict(HOUSEHOLD_SCOPED_INTEGRITY_ERROR);
  }
  return authority.role;
}

function requireCanonicalInvitation<TInvitation extends HouseholdInvitationRecordLike>(
  invitation: TInvitation,
): TInvitation & { role: HouseholdMemberRole } {
  const role = parseHouseholdMemberRole(invitation.role);
  if (!role) return conflict(HOUSEHOLD_SCOPED_INTEGRITY_ERROR);
  return { ...invitation, role };
}

export function createHouseholdManagementRouter(
  dependencies: HouseholdManagementRouterDependencies,
): IRouter {
  const router: IRouter = Router();
  const {
    tables,
    queryOps,
    requireAuth,
    getUserId,
    runHouseholdScopedOperation,
    buildMeInTransaction,
  } = dependencies;
  const {
    householdsTable,
    householdAuditEventsTable,
    householdInvitationsTable,
    householdMembersTable,
  } = tables;
  const { and, desc, eq, inArray } = queryOps;

  router.patch("/household", requireAuth, async (req, res): Promise<void> => {
    const capability = parseExpectedHouseholdCapability(req, res);
    if (!capability) return;
    const userId = getUserId(req);
    const parsed = UpdateHouseholdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const name = parsed.data.name.trim();
    if (!name) {
      res.status(400).json({ error: "Household name cannot be blank." });
      return;
    }

    await runHouseholdScopedRouteOperation({
      res,
      userId,
      expectedHouseholdId: capability.expectedHouseholdId,
      runHouseholdScopedOperation,
      async operation(scope, reply) {
        if (
          !requireOwner(
            scope,
            "Only an owner/admin can rename the household.",
            reply,
          )
        ) {
          return;
        }
        const [updated] = await scope.database
          .update(householdsTable)
          .set({ name })
          .where(eq(householdsTable.id, scope.householdId))
          .returning({ id: householdsTable.id });
        if (!updated) {
          return conflict(
            "Household changed before the rename completed. Refresh household identity before retrying.",
          );
        }
        const me = await buildMeInTransaction(
          scope.database,
          userId,
          scope.householdId,
        );
        reply.json(GetMeResponse.parse(me));
      },
    });
  });

  router.get(
    "/household/invitations",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const parsed = ListHouseholdInvitationsQueryParams.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const filters = normalizeHouseholdInvitationListQuery(parsed.data);

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          if (
            !requireOwner(
              scope,
              "Only an owner/admin can review household invitations before caregiver memberships are created.",
              reply,
            )
          ) {
            return;
          }
          const conditions = [
            eq(householdInvitationsTable.householdId, scope.householdId),
          ];
          if (filters.lifecycleState) {
            conditions.push(
              eq(
                householdInvitationsTable.lifecycleState,
                filters.lifecycleState,
              ),
            );
          }
          const rows = await scope.database
            .select()
            .from(householdInvitationsTable)
            .where(and(...conditions))
            .orderBy(desc(householdInvitationsTable.createdAt))
            .limit(filters.limit);

          reply.json(
            ListHouseholdInvitationsResponse.parse({
              invitations: rows.map((row: HouseholdInvitationRecordLike) =>
                buildHouseholdInvitationView(
                  requireCanonicalInvitation(row),
                  scope.now,
                ),
              ),
              limit: filters.limit,
              filters: {
                ...(filters.lifecycleState
                  ? { lifecycleState: filters.lifecycleState }
                  : {}),
              },
              boundary: HOUSEHOLD_INVITATION_BOUNDARY,
            }),
          );
        },
      });
    },
  );

  router.post(
    "/household/invitations/:id/revoke",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
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

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          let result;
          let lockedInvitation: PersistedHouseholdInvitation | null = null;
          try {
            result = await revokePreAcceptanceInvitation<
              HouseholdAuditEvent,
              PersistedHouseholdInvitation
            >({
              actorUserId: userId,
              householdId: scope.householdId,
              invitationId: params.data.id,
              reason: parsed.data.reason ?? null,
              now: scope.now,
              store: {
                transaction: (work) =>
                  work({
                    async lockActorMembership() {
                      return { role: scope.role };
                    },
                    async lockInvitation(invitationId, householdId) {
                      const [invitation] = await scope.database
                        .select()
                        .from(householdInvitationsTable)
                        .where(
                          and(
                            eq(householdInvitationsTable.id, invitationId),
                            eq(
                              householdInvitationsTable.householdId,
                              householdId,
                            ),
                          ),
                        )
                        .for("update");
                      if (!invitation) return null;
                      const role = parseHouseholdMemberRole(invitation.role);
                      if (!role) {
                        return conflict(HOUSEHOLD_SCOPED_INTEGRITY_ERROR);
                      }
                      lockedInvitation = { ...invitation, role };
                      return lockedInvitation;
                    },
                    async revokePendingInvitation(revokeInput) {
                      const [invitation] = await scope.database
                        .update(householdInvitationsTable)
                        .set({
                          lifecycleState: "revoked",
                          revokedByUserId: revokeInput.actorUserId,
                          revokedAt: revokeInput.now,
                          note:
                            revokeInput.reason ??
                            lockedInvitation?.note ??
                            null,
                          updatedAt: revokeInput.now,
                        })
                        .where(
                          and(
                            eq(
                              householdInvitationsTable.id,
                              revokeInput.invitationId,
                            ),
                            eq(
                              householdInvitationsTable.householdId,
                              revokeInput.householdId,
                            ),
                            inArray(
                              householdInvitationsTable.lifecycleState,
                              ["pending-approval", "approved"],
                            ),
                          ),
                        )
                        .returning();
                      return invitation
                        ? requireCanonicalInvitation(invitation)
                        : null;
                    },
                    async recordAudit(auditEvent) {
                      await scope.database
                        .insert(householdAuditEventsTable)
                        .values(buildHouseholdAuditInsert(auditEvent));
                    },
                  }),
              },
              buildAuditEvent({ invitation, revoked, now }) {
                return buildHouseholdAuditEvent(
                  {
                    action: "invitation-revoked",
                    actorUserId: userId,
                    householdId: scope.householdId,
                    targetRole: invitation.role,
                    reason:
                      parsed.data.reason ??
                      "Owner/admin revoked a household invitation before acceptance.",
                    expiresAt: revoked.expiresAt
                      ? new Date(revoked.expiresAt).toISOString()
                      : null,
                  },
                  now,
                );
              },
            });
          } catch (error) {
            if (error instanceof HouseholdInvitationRevocationError) {
              reply.status(error.status).json({ error: error.message });
              return;
            }
            throw error;
          }

          reply.json(
            HouseholdInvitationMutationResponse.parse({
              invitation: buildHouseholdInvitationView(
                result.invitation,
                scope.now,
              ),
              auditEvent: result.auditEvent,
            }),
          );
        },
      });
    },
  );

  router.get(
    "/household/sharing-cleanup",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const parsed = ListHouseholdSharingCleanupQueryParams.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const filters = normalizeHouseholdSharingCleanupQuery(parsed.data);

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          if (
            !requireOwner(
              scope,
              "Only an owner/admin can review expired household sharing cleanup candidates.",
              reply,
            )
          ) {
            return;
          }
          const invitations = await scope.database
            .select()
            .from(householdInvitationsTable)
            .where(
              eq(householdInvitationsTable.householdId, scope.householdId),
            )
            .orderBy(desc(householdInvitationsTable.createdAt))
            .limit(200);
          const members = await scope.database
            .select({
              id: householdMembersTable.id,
              householdId: householdMembersTable.householdId,
              userId: householdMembersTable.userId,
              role: householdMembersTable.role,
              displayName: householdMembersTable.displayName,
              accessPassExpiresAt:
                householdMembersTable.accessPassExpiresAt,
              createdAt: householdMembersTable.createdAt,
            })
            .from(householdMembersTable)
            .where(eq(householdMembersTable.householdId, scope.householdId))
            .limit(200);
          const candidates = buildHouseholdSharingCleanupCandidates(
            {
              invitations: invitations.map(
                (invitation: HouseholdInvitationRecordLike) =>
                  requireCanonicalInvitation(invitation),
              ),
              members: members.map((member: {
                role: string;
                accessPassExpiresAt?: Date | string | null;
              }) => ({
                ...member,
                role: requireCanonicalTargetRole(member, scope.now),
              })),
              now: scope.now,
            },
            filters,
          );
          reply.json(
            ListHouseholdSharingCleanupResponse.parse({
              candidates,
              limit: filters.limit,
              filters: {
                ...(filters.kind ? { kind: filters.kind } : {}),
              },
              pendingReviewCount: candidates.length,
              expiredInvitationCount: candidates.filter(
                (candidate) => candidate.kind === "expired-invitation",
              ).length,
              expiredAccessPassCount: candidates.filter(
                (candidate) => candidate.kind === "expired-access-pass",
              ).length,
              boundary: HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
            }),
          );
        },
      });
    },
  );

  router.get(
    "/household/audit-events",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const parsed = ListHouseholdAuditEventsQueryParams.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const filters = normalizeHouseholdAuditListQuery(parsed.data);

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          if (
            !requireOwner(
              scope,
              "Only an owner/admin can review durable household invite, role, and Access Pass audit events.",
              reply,
            )
          ) {
            return;
          }
          const conditions = [
            eq(householdAuditEventsTable.householdId, scope.householdId),
          ];
          if (filters.action) {
            conditions.push(
              eq(householdAuditEventsTable.action, filters.action),
            );
          }
          if (filters.lifecycleState) {
            conditions.push(
              eq(
                householdAuditEventsTable.lifecycleState,
                filters.lifecycleState,
              ),
            );
          }
          const rows = await scope.database
            .select()
            .from(householdAuditEventsTable)
            .where(and(...conditions))
            .orderBy(desc(householdAuditEventsTable.createdAt))
            .limit(filters.limit);
          reply.json(
            ListHouseholdAuditEventsResponse.parse({
              events: rows.map(buildHouseholdAuditEventFromRecord),
              limit: filters.limit,
              filters: {
                ...(filters.action ? { action: filters.action } : {}),
                ...(filters.lifecycleState
                  ? { lifecycleState: filters.lifecycleState }
                  : {}),
              },
              boundary:
                "Durable household audit review is provider-ready for owner/admin review; migration, RLS, retention, and export/deletion policy remain launch approval gates.",
            }),
          );
        },
      });
    },
  );

  router.patch(
    "/household/members/:id",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
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
      if (
        parsed.data.role === undefined &&
        parsed.data.displayName === undefined
      ) {
        res.status(400).json({
          error: "Provide a role or display name to update.",
        });
        return;
      }

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const [target] = await scope.database
            .select()
            .from(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, params.data.id),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .for("update");
          if (!target) {
            reply.status(404).json({ error: "Household member not found" });
            return;
          }
          const targetRole = requireCanonicalTargetRole(target, scope.now);
          const nextRole =
            parsed.data.role === undefined
              ? targetRole
              : parseHouseholdMemberRole(parsed.data.role);
          if (!nextRole) return conflict(HOUSEHOLD_SCOPED_INTEGRITY_ERROR);
          const policy = assertHouseholdMemberMutationAllowed({
            actorRole: scope.role,
            targetRole,
            nextRole,
            targetIsSelf: target.userId === userId,
            action: "update-role",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }
          const [updated] = await scope.database
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
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .returning({ id: householdMembersTable.id });
          if (!updated) {
            return conflict(
              "Household member changed before the update completed. Refresh household identity before retrying.",
            );
          }
          const auditEvent = buildHouseholdAuditEvent(
            {
              action: "member-role-updated",
              actorUserId: userId,
              householdId: scope.householdId,
              targetMemberId: target.id,
              targetUserId: target.userId,
              targetRole,
              nextRole,
              reason: policy.reason,
            },
            scope.now,
          );
          await scope.database
            .insert(householdAuditEventsTable)
            .values(buildHouseholdAuditInsert(auditEvent));
          const me = await buildMeInTransaction(
            scope.database,
            userId,
            scope.householdId,
          );
          reply.json(
            UpdateHouseholdMemberResponse.parse({ ...me, auditEvent }),
          );
        },
      });
    },
  );

  router.delete(
    "/household/members/:id",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const params = RevokeHouseholdMemberParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const [target] = await scope.database
            .select()
            .from(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, params.data.id),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .for("update");
          if (!target) {
            reply.status(404).json({ error: "Household member not found" });
            return;
          }
          const targetRole = requireCanonicalTargetRole(target, scope.now);
          const policy = assertHouseholdMemberMutationAllowed({
            actorRole: scope.role,
            targetRole,
            targetIsSelf: target.userId === userId,
            action: "revoke",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }
          const [deleted] = await scope.database
            .delete(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, params.data.id),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .returning({ id: householdMembersTable.id });
          if (!deleted) {
            return conflict(
              "Household member changed before revocation completed. Refresh household identity before retrying.",
            );
          }
          const auditEvent = buildHouseholdAuditEvent(
            {
              action: "member-revoked",
              actorUserId: userId,
              householdId: scope.householdId,
              targetMemberId: target.id,
              targetUserId: target.userId,
              targetRole,
              reason: policy.reason,
            },
            scope.now,
          );
          await scope.database
            .insert(householdAuditEventsTable)
            .values(buildHouseholdAuditInsert(auditEvent));
          const me = await buildMeInTransaction(
            scope.database,
            userId,
            scope.householdId,
          );
          reply.json(
            RevokeHouseholdMemberResponse.parse({ ...me, auditEvent }),
          );
        },
      });
    },
  );

  router.post(
    "/household/access-passes/activate",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const parsed = AccessPassActivationBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const [target] = await scope.database
            .select()
            .from(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, parsed.data.memberId),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .for("update");
          if (!target) {
            reply.status(404).json({ error: "Household member not found" });
            return;
          }
          const targetRole = requireCanonicalTargetRole(target, scope.now);
          const nextRole = normalizeAccessPassRole(parsed.data.role);
          const expiryPolicy = assertAccessPassExpiryAllowed(
            parsed.data.expiresAt,
            scope.now,
          );
          if (!expiryPolicy.allowed) {
            reply.status(400).json({ error: expiryPolicy.reason });
            return;
          }
          const policy = assertAccessPassMutationAllowed({
            actorRole: scope.role,
            targetRole,
            nextRole,
            targetIsSelf: target.userId === userId,
            action: "activate",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }
          const [updated] = await scope.database
            .update(householdMembersTable)
            .set({
              role: nextRole,
              accessPassExpiresAt: expiryPolicy.expiresAt
                ? new Date(expiryPolicy.expiresAt)
                : null,
              ...(parsed.data.displayName !== undefined
                ? { displayName: parsed.data.displayName ?? null }
                : {}),
            })
            .where(
              and(
                eq(householdMembersTable.id, parsed.data.memberId),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .returning({ id: householdMembersTable.id });
          if (!updated) {
            return conflict(
              "Household member changed before Access Pass activation completed. Refresh household identity before retrying.",
            );
          }
          const auditEvent = buildHouseholdAuditEvent(
            {
              action: "access-pass-activated",
              actorUserId: userId,
              householdId: scope.householdId,
              targetMemberId: target.id,
              targetUserId: target.userId,
              targetRole,
              nextRole,
              reason: policy.reason,
              note: parsed.data.note,
              expiresAt: expiryPolicy.expiresAt,
            },
            scope.now,
          );
          await scope.database
            .insert(householdAuditEventsTable)
            .values(buildHouseholdAuditInsert(auditEvent));
          const me = await buildMeInTransaction(
            scope.database,
            userId,
            scope.householdId,
          );
          reply.json(
            HouseholdAccessPassMutationResponse.parse({
              ...me,
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
        },
      });
    },
  );

  router.post(
    "/household/access-passes/revoke",
    requireAuth,
    async (req, res): Promise<void> => {
      const capability = parseExpectedHouseholdCapability(req, res);
      if (!capability) return;
      const userId = getUserId(req);
      const parsed = AccessPassRevocationBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      await runHouseholdScopedRouteOperation({
        res,
        userId,
        expectedHouseholdId: capability.expectedHouseholdId,
        runHouseholdScopedOperation,
        async operation(scope, reply) {
          const [target] = await scope.database
            .select()
            .from(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, parsed.data.memberId),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .for("update");
          if (!target) {
            reply.status(404).json({ error: "Household member not found" });
            return;
          }
          const targetRole = requireCanonicalTargetRole(target, scope.now);
          const policy = assertAccessPassMutationAllowed({
            actorRole: scope.role,
            targetRole,
            targetIsSelf: target.userId === userId,
            action: "revoke",
          });
          if (!policy.allowed) {
            reply.status(403).json({ error: policy.reason });
            return;
          }
          const [deleted] = await scope.database
            .delete(householdMembersTable)
            .where(
              and(
                eq(householdMembersTable.id, parsed.data.memberId),
                eq(householdMembersTable.householdId, scope.householdId),
              ),
            )
            .returning({ id: householdMembersTable.id });
          if (!deleted) {
            return conflict(
              "Household member changed before Access Pass revocation completed. Refresh household identity before retrying.",
            );
          }
          const auditEvent = buildHouseholdAuditEvent(
            {
              action: "access-pass-revoked",
              actorUserId: userId,
              householdId: scope.householdId,
              targetMemberId: target.id,
              targetUserId: target.userId,
              targetRole,
              reason: parsed.data.reason ?? policy.reason,
            },
            scope.now,
          );
          await scope.database
            .insert(householdAuditEventsTable)
            .values(buildHouseholdAuditInsert(auditEvent));
          const me = await buildMeInTransaction(
            scope.database,
            userId,
            scope.householdId,
          );
          reply.json(
            HouseholdAccessPassMutationResponse.parse({
              ...me,
              accessPass: {
                memberId: target.id,
                userId: target.userId,
                role: targetRole,
                status: "revoked",
                expiresAt: null,
                note: parsed.data.reason ?? null,
              },
              auditEvent,
            }),
          );
        },
      });
    },
  );

  return router;
}
