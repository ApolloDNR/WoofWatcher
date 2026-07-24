/**
 * One canonical rule for the pet's display name so every surface agrees.
 *
 * The stored default profile name is "My Dog" (a placeholder). Production
 * surfaces present that as "Your dog" until the owner saves a real name.
 * Preview/demo callers may explicitly pass "Phoenix" as their fallback, but
 * an unconfigured account must never look like a configured Phoenix profile.
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
