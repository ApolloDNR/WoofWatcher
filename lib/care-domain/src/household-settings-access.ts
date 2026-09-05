export const HOUSEHOLD_SETTINGS_OWNER_REQUIRED_MESSAGE =
  "Only an owner/admin can change household settings.";

export interface HouseholdSettingsAccess {
  allowed: boolean;
  reason?: string;
}

export interface HouseholdSettingsMember {
  isSelf?: boolean | null;
  role?: string | null;
}

function normalizeHouseholdSettingsRole(
  role: string | null | undefined,
): string {
  return String(role ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function deriveHouseholdSettingsAccess(
  role: string | null | undefined,
): HouseholdSettingsAccess {
  const normalizedRole = normalizeHouseholdSettingsRole(role);
  if (
    normalizedRole === "owner" ||
    normalizedRole === "admin" ||
    normalizedRole === "adult admin"
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: HOUSEHOLD_SETTINGS_OWNER_REQUIRED_MESSAGE,
  };
}

export function canCurrentMemberManageHouseholdSettings(
  members: readonly HouseholdSettingsMember[] | null | undefined,
): boolean {
  if (!Array.isArray(members)) return false;
  const selfMembers = members.filter((member) => member?.isSelf === true);
  if (selfMembers.length !== 1) return false;
  return deriveHouseholdSettingsAccess(selfMembers[0]?.role).allowed;
}
