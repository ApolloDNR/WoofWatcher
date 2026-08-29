import { parseHouseholdMemberRole } from "./household-role-authority.ts";

export type HouseholdMemberMutationAction = "update-role" | "revoke";

export interface HouseholdMemberMutationInput {
  actorRole?: string | null;
  targetRole?: string | null;
  nextRole?: string | null;
  targetIsSelf?: boolean;
  action: HouseholdMemberMutationAction;
}

export interface HouseholdMemberMutationPolicy {
  allowed: boolean;
  reason?: string;
  nextRole?: string;
}

export const ACCESS_PASS_COMPATIBLE_ROLES = [
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const;

export function normalizeHouseholdMemberRole(role: string | null | undefined): string {
  return parseHouseholdMemberRole(role) ?? "";
}

function isOwnerAdminRole(role: string | null): boolean {
  return role === "owner";
}

function isProtectedOwnerRole(role: string | null): boolean {
  return role === "owner";
}

export function assertHouseholdMemberMutationAllowed(
  input: HouseholdMemberMutationInput,
): HouseholdMemberMutationPolicy {
  const actorRole = parseHouseholdMemberRole(input.actorRole);
  const targetRole = parseHouseholdMemberRole(input.targetRole);
  const nextRole = parseHouseholdMemberRole(input.nextRole ?? targetRole);

  if (!isOwnerAdminRole(actorRole)) {
    return {
      allowed: false,
      reason: "Only an owner/admin can change household roles or revoke helpers.",
      ...(nextRole ? { nextRole } : {}),
    };
  }

  if (!targetRole || !nextRole) {
    return {
      allowed: false,
      reason: "Household member role authority is invalid.",
      ...(nextRole ? { nextRole } : {}),
    };
  }

  if (input.targetIsSelf) {
    return {
      allowed: false,
      reason: "Owners cannot change or revoke their own household role from this helper-management flow.",
      nextRole,
    };
  }

  if (isProtectedOwnerRole(targetRole) && (input.action === "revoke" || nextRole !== "owner")) {
    return {
      allowed: false,
      reason: "Owner role changes need a last-owner-safe account flow before they can be changed.",
      nextRole,
    };
  }

  if (input.action === "revoke") {
    return {
      allowed: true,
      reason: "Owner/admin helper revocation is allowed for Access Pass and household helper cleanup.",
      nextRole: targetRole,
    };
  }

  return {
    allowed: true,
    reason:
      "Owner/admin role update is allowed for household helpers, sitter/trainer scopes, and vet viewer read-only access.",
    nextRole,
  };
}
