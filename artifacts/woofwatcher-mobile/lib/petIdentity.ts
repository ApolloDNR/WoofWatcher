/**
 * One canonical rule for the pet's display name so every surface agrees.
 *
 * The stored default profile name is "My Dog" (a placeholder), but Home,
 * Pack, Story, and More all present the dog as "Phoenix" until the owner
 * personalizes it. Care Pass, the care-twin roster, and any other surface
 * must resolve the name the same way, or the same dog reads as "Phoenix"
 * on one tab and "My Dog" on the next.
 */
export const DEFAULT_PET_PLACEHOLDER = "My Dog";
export const DEFAULT_PET_DISPLAY_NAME = "Phoenix";

export function resolvePetName(
  name: string | null | undefined,
  fallback: string = DEFAULT_PET_DISPLAY_NAME,
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === DEFAULT_PET_PLACEHOLDER) return fallback;
  return trimmed;
}

export function buildAuthGatewayIdentityCopy(name: string | null | undefined): {
  setupDetail: string;
  stageLabel: string;
} {
  const petName = resolvePetName(name);
  return {
    setupDetail: `Set up ${petName}, then invite your household when providers are live.`,
    stageLabel: `${petName} care starts here`,
  };
}
