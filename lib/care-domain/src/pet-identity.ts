/**
 * One canonical rule for the pet's display name so every surface agrees.
 *
 * The stored default profile name is "My Dog" (a placeholder). Production
 * copy presents that as "Your dog" until the owner saves a real name. A
 * preview/demo caller may explicitly pass "Phoenix" as its fallback, but
 * shared artifacts must not invent a configured Phoenix profile.
 *
 * This mirrors artifacts/woofwatcher-mobile/lib/petIdentity.ts (the mobile
 * copy of the same rule); keep the placeholder, fallback, and resolution
 * logic in lockstep if either side changes.
 */
export const DEFAULT_PET_PLACEHOLDER = "My Dog";
export const DEFAULT_PET_DISPLAY_NAME = "Your dog";

export function resolvePetName(
  name: string | null | undefined,
  fallback: string = DEFAULT_PET_DISPLAY_NAME,
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === DEFAULT_PET_PLACEHOLDER) return fallback;
  return trimmed;
}
