export const HOUSEHOLD_MEMBER_ROLES = [
  "owner",
  "adult",
  "teen",
  "kid",
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const;

export type HouseholdMemberRole = (typeof HOUSEHOLD_MEMBER_ROLES)[number];

export const HOUSEHOLD_ACCESS_PASS_ROLES = [
  "sitter",
  "trainer",
  "walker",
  "vet viewer",
] as const satisfies readonly HouseholdMemberRole[];

export type HouseholdAccessPassRole =
  (typeof HOUSEHOLD_ACCESS_PASS_ROLES)[number];

export type HouseholdMembershipAuthorityState =
  | "active"
  | "expired"
  | "invalid";

export type HouseholdAuthorizationRole =
  | HouseholdMemberRole
  | "expired access pass"
  | "invalid household role";

export interface HouseholdMembershipAuthority {
  state: HouseholdMembershipAuthorityState;
  role: HouseholdMemberRole | null;
  authorizationRole: HouseholdAuthorizationRole;
  accessPassExpiresAt: string | null;
  accessPassExpired: boolean;
  householdAccessAllowed: boolean;
}

const ROLE_ALIASES: Readonly<Record<string, HouseholdMemberRole>> = {
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

const ACCESS_PASS_ROLE_SET = new Set<HouseholdMemberRole>(
  HOUSEHOLD_ACCESS_PASS_ROLES,
);

function cleanRole(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizedExpiry(
  value: Date | string | null | undefined,
): { valid: true; iso: string | null } | { valid: false; iso: null } {
  if (value == null) return { valid: true, iso: null };
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime())
    ? { valid: false, iso: null }
    : { valid: true, iso: date.toISOString() };
}

export function parseHouseholdMemberRole(
  role: string | null | undefined,
): HouseholdMemberRole | null {
  return ROLE_ALIASES[cleanRole(role)] ?? null;
}

export function isHouseholdAccessPassRole(
  role: HouseholdMemberRole | string | null | undefined,
): role is HouseholdAccessPassRole {
  const parsed = parseHouseholdMemberRole(role);
  return parsed !== null && ACCESS_PASS_ROLE_SET.has(parsed);
}

export function resolveHouseholdMembershipAuthority(input: {
  role: string | null | undefined;
  accessPassExpiresAt?: Date | string | null;
  now: Date;
}): HouseholdMembershipAuthority {
  const role = parseHouseholdMemberRole(input.role);
  const expiry = normalizedExpiry(input.accessPassExpiresAt);
  if (!role || !expiry.valid || Number.isNaN(input.now.getTime())) {
    return {
      state: "invalid",
      role,
      authorizationRole: "invalid household role",
      accessPassExpiresAt: null,
      accessPassExpired: false,
      householdAccessAllowed: false,
    };
  }

  const accessPassExpired =
    isHouseholdAccessPassRole(role) &&
    expiry.iso !== null &&
    new Date(expiry.iso).getTime() <= input.now.getTime();
  if (accessPassExpired) {
    return {
      state: "expired",
      role,
      authorizationRole: "expired access pass",
      accessPassExpiresAt: expiry.iso,
      accessPassExpired: true,
      householdAccessAllowed: false,
    };
  }

  return {
    state: "active",
    role,
    authorizationRole: role,
    accessPassExpiresAt: expiry.iso,
    accessPassExpired: false,
    householdAccessAllowed: true,
  };
}
