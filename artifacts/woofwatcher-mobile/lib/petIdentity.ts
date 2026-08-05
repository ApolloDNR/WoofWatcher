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

export function buildAuthAccountIdentityCopy(name: string | null | undefined): {
  previewSignIn: string;
  signIn: string;
  signUp: string;
} {
  const petName = resolvePetName(name);
  return {
    previewSignIn: `Accounts are not connected in this preview build. Review ${petName}'s care space in local-only mode and sign in once production auth is configured.`,
    signIn: `Return to your household care space, review ${petName}'s open loops, and keep the account layer ready for shared sync.`,
    signUp: `Create the account layer for ${petName}'s care twin. Care data stays local-first until production sync providers are configured.`,
  };
}

export function buildNotFoundIdentityCopy(name: string | null | undefined): string {
  const petName = resolvePetName(name);
  return `The screen you were looking for is not here. Head back to ${petName}'s room and pick up the day from there.`;
}

export function buildAvatarStudioIdentityCopy(name: string | null | undefined): string {
  return `Make me ${resolvePetName(name)}.`;
}

export function buildCareTwinAwayIdentityCopy(name: string | null | undefined): string {
  return `${resolvePetName(name)} is out exploring`;
}

export function buildCareTwinLiveTitle(name: string | null | undefined): string {
  return `${resolvePetName(name).toLocaleUpperCase()} TWIN`;
}
