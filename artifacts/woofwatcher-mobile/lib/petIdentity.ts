/**
 * One canonical rule for the pet's display name so every surface agrees.
 *
 * The stored default profile name is "My Dog" (a placeholder). Consumer
 * surfaces present it neutrally as "your dog" until the household supplies
 * a name. Phoenix remains the identity of specific sample artwork, never an
 * assumed household dog name.
 */
export const DEFAULT_PET_PLACEHOLDER = "My Dog";
export const DEFAULT_CONSUMER_PET_NAME = "your dog";
export const DEFAULT_PET_DISPLAY_NAME = DEFAULT_CONSUMER_PET_NAME;

export function resolvePetName(
  name: string | null | undefined,
  fallback: string = DEFAULT_PET_DISPLAY_NAME,
): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === DEFAULT_PET_PLACEHOLDER) return fallback;
  return trimmed;
}

/** Consumer release copy stays neutral until the household supplies a name. */
export function resolveConsumerPetName(
  name: string | null | undefined,
): string {
  return resolvePetName(name, DEFAULT_CONSUMER_PET_NAME);
}

export function buildPetPossessiveName(
  name: string | null | undefined,
): string {
  const displayName = resolveConsumerPetName(name);
  return displayName.toLocaleLowerCase().endsWith("s")
    ? `${displayName}'`
    : `${displayName}'s`;
}

export function buildPetSetupCopy(name: string | null | undefined): {
  displayName: string;
  title: string;
  actionLabel: string;
} {
  const displayName = resolveConsumerPetName(name);
  return {
    displayName,
    title: `Let's set up ${displayName}`,
    actionLabel: `Set up ${displayName}`,
  };
}

export function buildPetSummaryLine(
  name: string | null | undefined,
  breed: string | null | undefined,
): string {
  const displayName = resolveConsumerPetName(name);
  const trimmedBreed = (breed ?? "").trim();
  return trimmedBreed ? `${displayName} (${trimmedBreed})` : displayName;
}

function accessibilitySentencePart(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/[.!?]+$/u, "");
}

export function buildCareTwinRoomAccessibilityLabel(input: {
  name: string | null | undefined;
  templateLabel?: string | null;
  motionLabel: string;
  interactionLabel?: string | null;
  speech?: string | null;
}): string {
  const displayName = resolveConsumerPetName(input.name);
  const sentenceName =
    displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const possessiveName = buildPetPossessiveName(sentenceName);
  const templateLabel = accessibilitySentencePart(input.templateLabel);
  const parts = [
    `${possessiveName} room`,
    templateLabel ? `${templateLabel} care twin` : "Care twin",
    accessibilitySentencePart(input.motionLabel),
    accessibilitySentencePart(input.interactionLabel),
    accessibilitySentencePart(input.speech),
  ].filter(Boolean);

  return `${parts.join(". ")}.`;
}
