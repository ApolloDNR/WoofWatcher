import {
  deriveAccessPassRuntimeStatus,
  isAccessPassHelperRole,
} from "./household-access-pass.ts";
import {
  buildHouseholdInvitationView,
  type HouseholdInvitationRecordLike,
} from "./household-invitations.ts";

export type HouseholdSharingCleanupKind =
  | "expired-invitation"
  | "expired-access-pass";

export type HouseholdSharingCleanupRecommendedAction =
  | "mark-invitation-expired"
  | "review-helper-access";

export interface HouseholdSharingCleanupQuery {
  limit: number;
  kind?: HouseholdSharingCleanupKind;
}

export interface HouseholdSharingCleanupMemberRecordLike {
  id: string;
  householdId: string;
  userId: string;
  role: string;
  displayName?: string | null;
  accessPassExpiresAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface HouseholdSharingCleanupInput {
  invitations: HouseholdInvitationRecordLike[];
  members: HouseholdSharingCleanupMemberRecordLike[];
  now?: Date;
}

export interface HouseholdSharingCleanupCandidate {
  id: string;
  kind: HouseholdSharingCleanupKind;
  targetId: string;
  householdId: string;
  title: string;
  detail: string;
  role: string;
  displayName: string | null;
  invitedEmail: string | null;
  inviteCode: string | null;
  userId: string | null;
  expiresAt: string;
  staleSince: string;
  recommendedAction: HouseholdSharingCleanupRecommendedAction;
  storage: "review-only";
  boundary: string;
}

const CLEANUP_KINDS = [
  "expired-invitation",
  "expired-access-pass",
] as const satisfies readonly HouseholdSharingCleanupKind[];
const CLEANUP_KIND_SET = new Set<string>(CLEANUP_KINDS);

export const HOUSEHOLD_SHARING_CLEANUP_BOUNDARY =
  "Owner/admin sharing cleanup review is provider-ready and non-destructive; applying cleanup, Supabase migration/RLS, retention/export/deletion policy, notification delivery, and legal/privacy approval remain launch gates.";

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function nullableClean(value: unknown): string | null {
  const cleaned = clean(value);
  return cleaned || null;
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = parseIsoDate(value);
  return date ? date.toISOString() : null;
}

function isCleanupKind(value: string): value is HouseholdSharingCleanupKind {
  return CLEANUP_KIND_SET.has(value);
}

function normalizeRoleLabel(role: string): string {
  return clean(role).toLowerCase() || "caregiver";
}

function makeCandidateId(
  kind: HouseholdSharingCleanupKind,
  targetId: string,
): string {
  const safeTargetId = clean(targetId).replace(/[^a-z0-9_-]/gi, "").slice(0, 80);
  return `sharing_cleanup_${kind}_${safeTargetId}`;
}

export function normalizeHouseholdSharingCleanupQuery(
  query: Record<string, unknown>,
): HouseholdSharingCleanupQuery {
  const requestedLimit = Number(query.limit ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
    : 50;
  const kind = clean(query.kind).toLowerCase();

  return {
    limit,
    ...(isCleanupKind(kind) ? { kind } : {}),
  };
}

export function buildHouseholdSharingCleanupCandidates(
  input: HouseholdSharingCleanupInput,
  query: HouseholdSharingCleanupQuery,
): HouseholdSharingCleanupCandidate[] {
  const now = input.now ?? new Date();
  const invitationCandidates = input.invitations.flatMap((invitation) => {
    const view = buildHouseholdInvitationView(invitation, now);
    if (!view.expired || view.runtimeLifecycleState !== "expired" || !view.expiresAt) {
      return [];
    }

    const role = normalizeRoleLabel(view.role);
    return [
      {
        id: makeCandidateId("expired-invitation", view.id),
        kind: "expired-invitation" as const,
        targetId: view.id,
        householdId: view.householdId,
        title: `Expired ${role} invitation`,
        detail:
          "Invitation expired before it was accepted. Review the row, then mark it expired or revoke it from owner/admin tools.",
        role,
        displayName: null,
        invitedEmail: view.invitedEmail,
        inviteCode: view.inviteCode,
        userId: view.invitedUserId,
        expiresAt: view.expiresAt,
        staleSince: view.expiresAt,
        recommendedAction: "mark-invitation-expired" as const,
        storage: "review-only" as const,
        boundary: HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
      },
    ];
  });

  const helperCandidates = input.members.flatMap((member) => {
    if (!isAccessPassHelperRole(member.role)) return [];
    const runtime = deriveAccessPassRuntimeStatus({
      role: member.role,
      accessPassExpiresAt: member.accessPassExpiresAt ?? null,
      now,
    });
    if (!runtime.accessPassExpired || !runtime.accessPassExpiresAt) return [];

    const role = normalizeRoleLabel(runtime.role);
    return [
      {
        id: makeCandidateId("expired-access-pass", member.id),
        kind: "expired-access-pass" as const,
        targetId: clean(member.id),
        householdId: clean(member.householdId),
        title: `Expired ${role} Access Pass`,
        detail:
          "Access Pass has expired and household access is blocked. Review whether to renew access or revoke helper membership.",
        role,
        displayName: nullableClean(member.displayName),
        invitedEmail: null,
        inviteCode: null,
        userId: nullableClean(member.userId),
        expiresAt: runtime.accessPassExpiresAt,
        staleSince: runtime.accessPassExpiresAt,
        recommendedAction: "review-helper-access" as const,
        storage: "review-only" as const,
        boundary: HOUSEHOLD_SHARING_CLEANUP_BOUNDARY,
      },
    ];
  });

  return [...invitationCandidates, ...helperCandidates]
    .filter((candidate) => !query.kind || candidate.kind === query.kind)
    .slice(0, query.limit);
}
