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

export interface HouseholdOwnerActionPolicy {
  allowed: boolean;
  reason?: string;
}

export interface ActiveHouseholdSelectionPolicy {
  allowed: boolean;
  reason?: string;
}

const ROLE_ALIASES: Record<string, string> = {
  admin: "owner",
  "adult admin": "owner",
  owner: "owner",
  adult: "adult",
  member: "adult",
  "primary caregiver": "adult",
  teen: "teen",
  kid: "kid",
  child: "kid",
  minor: "kid",
  sitter: "sitter",
  trainer: "trainer",
  walker: "walker",
  helper: "sitter",
  "temporary helper": "sitter",
  viewer: "vet viewer",
  vet: "vet viewer",
  "vet viewer": "vet viewer",
  "veterinary viewer": "vet viewer",
  "read-only": "vet viewer",
  readonly: "vet viewer",
};

export const ACCESS_PASS_COMPATIBLE_ROLES = [
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const;

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeHouseholdMemberRole(role: string | null | undefined): string {
  const normalized = clean(role).toLowerCase();
  return ROLE_ALIASES[normalized] ?? "adult";
}

function isOwnerAdminRole(role: string): boolean {
  return role === "owner";
}

function isProtectedOwnerRole(role: string): boolean {
  return role === "owner";
}

export function assertHouseholdOwnerActionAllowed(
  actorRole: string | null | undefined,
  action: string,
): HouseholdOwnerActionPolicy {
  if (isOwnerAdminRole(normalizeHouseholdMemberRole(actorRole))) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Only an owner/admin can ${clean(action)}.`,
  };
}

export function assertActiveHouseholdSelectionAllowed(input: {
  hasMembership: boolean;
  accessPassExpired: boolean;
}): ActiveHouseholdSelectionPolicy {
  if (!input.hasMembership) {
    return {
      allowed: false,
      reason: "You can only select a household where you are a current member.",
    };
  }
  if (input.accessPassExpired) {
    return {
      allowed: false,
      reason: "An expired Access Pass cannot be selected as the active household.",
    };
  }
  return { allowed: true };
}

export function assertHouseholdMemberMutationAllowed(
  input: HouseholdMemberMutationInput,
): HouseholdMemberMutationPolicy {
  const actorRole = normalizeHouseholdMemberRole(input.actorRole);
  const targetRole = normalizeHouseholdMemberRole(input.targetRole);
  const nextRole = normalizeHouseholdMemberRole(input.nextRole ?? targetRole);

  if (!isOwnerAdminRole(actorRole)) {
    return {
      allowed: false,
      reason: "Only an owner/admin can change household roles or revoke helpers.",
      nextRole,
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
