/**
 * One canonical rule for the pet's display name so every surface agrees.
 *
 * The stored default profile name is "My Dog" (a placeholder), but consumer
 * copy presents that fresh-install identity neutrally as "your dog" until the
 * owner personalizes it. Care Pass and every other shared artifact built in
 * care-domain must resolve the name the same way, or different screens can
 * disagree about who the household is caring for.
 *
 * This mirrors artifacts/woofwatcher-mobile/lib/petIdentity.ts (the mobile
 * copy of the same rule); keep the placeholder, fallback, and resolution
 * logic in lockstep if either side changes.
 */
export const DEFAULT_PET_PLACEHOLDER = "My Dog";
export const DEFAULT_PET_DISPLAY_NAME = "your dog";

export function resolvePetName(
  name: string | null | undefined,
  fallback: string = DEFAULT_PET_DISPLAY_NAME,
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === DEFAULT_PET_PLACEHOLDER) return fallback;
  return trimmed;
}

export function buildPetPossessiveName(
  name: string | null | undefined,
): string {
  const displayName = resolvePetName(name);
  return displayName.toLocaleLowerCase().endsWith("s")
    ? `${displayName}'`
    : `${displayName}'s`;
}
