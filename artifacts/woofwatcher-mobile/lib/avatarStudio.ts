import { DEFAULT_PET_PLACEHOLDER } from "./petIdentity.ts";

export type PetAvatarStyle = "pixel";

export type AvatarTemplateId =
  | "shepherd"
  | "retriever"
  | "husky"
  | "bully"
  | "doodle"
  | "terrier"
  | "hound"
  | "dachshund"
  | "spaniel"
  | "toy"
  | "slender"
  | "mixed";

export type AvatarEarTypeId = "tall" | "floppy" | "button" | "rose" | "folded";
export type AvatarFaceMarkingId = "none" | "mask" | "blaze" | "muzzle" | "eyebrows" | "patch";
export type AvatarMuzzleTypeId = "dark" | "light" | "spotted" | "short" | "long";
export type AvatarCollarId = "forest-bandana" | "navy-collar" | "copper-collar" | "sage-bandana" | "none";
export type AvatarTagId = "heart" | "bone" | "shield" | "round" | "none";
export type AvatarEmotePackId =
  | "starter-care-twin"
  | "phoenix-shepherd"
  | "retriever-starter"
  | "husky-starter"
  | "bully-starter";
export type AvatarEmoteState =
  | "happy"
  | "calm"
  | "excited"
  | "bored"
  | "hungry"
  | "anxious"
  | "sleepy"
  | "proud"
  | "home_alone"
  | "not_feeling_well";

export interface AvatarAccessorySlots {
  head?: string;
  face?: string;
  neck?: string;
  body?: string;
  room?: string;
  fx?: string;
}

export interface PetAvatarConfig {
  version: 1;
  petName: string;
  templateId: AvatarTemplateId;
  style: PetAvatarStyle;
  coatPrimary: string;
  coatSecondary: string;
  faceMarkingId: AvatarFaceMarkingId;
  earTypeId: AvatarEarTypeId;
  muzzleTypeId: AvatarMuzzleTypeId;
  eyeColor: string;
  collarId: AvatarCollarId;
  tagId: AvatarTagId;
  bandanaId?: AvatarCollarId;
  accessorySlots: AvatarAccessorySlots;
  emotePackId: AvatarEmotePackId;
  updatedAt: string;
}

export interface AvatarTemplate {
  id: AvatarTemplateId;
  label: string;
  subtitle: string;
  bodyClass: "working" | "sporting" | "compact" | "long" | "small" | "slender" | "neutral";
  defaultEarTypeId: AvatarEarTypeId;
  defaultMuzzleTypeId: AvatarMuzzleTypeId;
  recommendedEmotePackId: AvatarEmotePackId;
  anchorNotes: string;
}

export interface AvatarAccessoryOption {
  id: string;
  label: string;
  slot: keyof AvatarAccessorySlots;
  tone: string;
  launchTier: "free" | "plus-ready";
}

export type AvatarAccessoryFitStatus = "template-fitted" | "inventory-ready";

export interface AvatarAccessoryFitModel {
  status: AvatarAccessoryFitStatus;
  label: "Template-fitted" | "Pack pending";
  detail: string;
  placementHint: string;
  needsDeviceQa: boolean;
}

export const AVATAR_EMOTE_STATES: AvatarEmoteState[] = [
  "happy",
  "calm",
  "excited",
  "bored",
  "hungry",
  "anxious",
  "sleepy",
  "proud",
  "home_alone",
  "not_feeling_well",
];

export const AVATAR_TEMPLATES: AvatarTemplate[] = [
  {
    id: "shepherd",
    label: "Shepherd",
    subtitle: "Tall ears, working-dog stance, loyal patrol energy.",
    bodyClass: "working",
    defaultEarTypeId: "tall",
    defaultMuzzleTypeId: "dark",
    recommendedEmotePackId: "phoenix-shepherd",
    anchorNotes: "Bottom-center standing pose; collar and bandana sit at neck slot.",
  },
  {
    id: "retriever",
    label: "Retriever",
    subtitle: "Balanced body, friendly face, soft family-dog expression.",
    bodyClass: "sporting",
    defaultEarTypeId: "floppy",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "retriever-starter",
    anchorNotes: "Bottom-center body with stable wagging tail anchor.",
  },
  {
    id: "husky",
    label: "Husky / Spitz",
    subtitle: "Pointed ears, plush coat, alert bright-eyed presence.",
    bodyClass: "working",
    defaultEarTypeId: "tall",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "husky-starter",
    anchorNotes: "Bottom-center anchor; tail and ruff need template-specific accessory clearances.",
  },
  {
    id: "bully",
    label: "Bully",
    subtitle: "Compact strength, broad chest, expressive soft face.",
    bodyClass: "compact",
    defaultEarTypeId: "rose",
    defaultMuzzleTypeId: "short",
    recommendedEmotePackId: "bully-starter",
    anchorNotes: "Bottom-center anchor; shorter body height and wider collar placement.",
  },
  {
    id: "doodle",
    label: "Doodle",
    subtitle: "Curly coat, friendly bounce, soft rounded silhouette.",
    bodyClass: "sporting",
    defaultEarTypeId: "floppy",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; coat texture is a template layer, not a filter.",
  },
  {
    id: "terrier",
    label: "Terrier",
    subtitle: "Small alert frame, scruffy face, huge personality.",
    bodyClass: "small",
    defaultEarTypeId: "button",
    defaultMuzzleTypeId: "short",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; smaller template scale keeps face readable at phone size.",
  },
  {
    id: "hound",
    label: "Hound",
    subtitle: "Long ears, scent-dog posture, calm curious energy.",
    bodyClass: "sporting",
    defaultEarTypeId: "floppy",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; ear animation needs extra room during walking and sniffing.",
  },
  {
    id: "dachshund",
    label: "Dachshund",
    subtitle: "Long body, short legs, cozy-room comic charm.",
    bodyClass: "long",
    defaultEarTypeId: "floppy",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; long-body walk cycle requires its own strip.",
  },
  {
    id: "spaniel",
    label: "Spaniel",
    subtitle: "Soft ears, bright eyes, gentle companion look.",
    bodyClass: "sporting",
    defaultEarTypeId: "floppy",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; ear and chest fur layers need clean collar visibility.",
  },
  {
    id: "toy",
    label: "Toy Breed",
    subtitle: "Tiny body, big eyes, lap-dog scale for small companions.",
    bodyClass: "small",
    defaultEarTypeId: "button",
    defaultMuzzleTypeId: "short",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; scaled larger on canvas so expressions remain readable.",
  },
  {
    id: "slender",
    label: "Slender",
    subtitle: "Long legs, elegant frame, quiet athletic posture.",
    bodyClass: "slender",
    defaultEarTypeId: "folded",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; leg motion needs separate gait timing.",
  },
  {
    id: "mixed",
    label: "Mixed Breed",
    subtitle: "Neutral body base designed for lovable real-life mixes.",
    bodyClass: "neutral",
    defaultEarTypeId: "button",
    defaultMuzzleTypeId: "long",
    recommendedEmotePackId: "starter-care-twin",
    anchorNotes: "Bottom-center anchor; flexible neutral default for mixed breeds and manual customization.",
  },
];

export const AVATAR_ACCESSORIES: AvatarAccessoryOption[] = [
  { id: "forest-bandana", label: "Forest bandana", slot: "neck", tone: "#2E5846", launchTier: "free" },
  { id: "navy-collar", label: "Navy collar", slot: "neck", tone: "#081424", launchTier: "free" },
  { id: "copper-collar", label: "Copper collar", slot: "neck", tone: "#CC5A2A", launchTier: "free" },
  { id: "heart-tag", label: "Heart tag", slot: "neck", tone: "#C96358", launchTier: "free" },
  { id: "trail-bandana", label: "Trail bandana", slot: "neck", tone: "#6DA36F", launchTier: "plus-ready" },
  { id: "birthday-hat", label: "Birthday hat", slot: "head", tone: "#E07A2F", launchTier: "plus-ready" },
  { id: "sleepy-mask", label: "Sleepy mask", slot: "face", tone: "#A8CBE8", launchTier: "plus-ready" },
  { id: "training-vest", label: "Training vest", slot: "body", tone: "#D8A852", launchTier: "plus-ready" },
  { id: "cozy-bed", label: "Cozy bed", slot: "room", tone: "#E5D2C4", launchTier: "free" },
  { id: "heart-sparkles", label: "Heart sparkles", slot: "fx", tone: "#C96358", launchTier: "plus-ready" },
];

const SHEPHERD_TEMPLATE_FITTED_ACCESSORY_IDS = new Set([
  "forest-bandana",
  "navy-collar",
  "birthday-hat",
  "sleepy-mask",
  "training-vest",
  "cozy-bed",
  "heart-sparkles",
]);

const TEMPLATE_FITTED_ACCESSORY_IDS: Partial<Record<AvatarTemplateId, Set<string>>> = {
  shepherd: SHEPHERD_TEMPLATE_FITTED_ACCESSORY_IDS,
};

const ACCESSORY_SLOT_COPY: Record<keyof AvatarAccessorySlots, string> = {
  head: "head slot above ears",
  face: "face slot across eyes and muzzle",
  neck: "neck slot under the jaw and above the chest",
  body: "body slot over shoulders and chest",
  room: "room slot behind or beneath the avatar",
  fx: "effect slot around the avatar silhouette",
};

export function getAvatarTemplate(templateId: AvatarTemplateId): AvatarTemplate {
  return AVATAR_TEMPLATES.find((template) => template.id === templateId) ?? AVATAR_TEMPLATES[0];
}

export function deriveAvatarAccessoryFit(
  templateId: AvatarTemplateId,
  accessory: AvatarAccessoryOption,
): AvatarAccessoryFitModel {
  const template = getAvatarTemplate(templateId);
  const placementHint = ACCESSORY_SLOT_COPY[accessory.slot];
  const hasTemplateOverlay = TEMPLATE_FITTED_ACCESSORY_IDS[templateId]?.has(accessory.id) ?? false;

  if (hasTemplateOverlay) {
    return {
      status: "template-fitted",
      label: "Template-fitted",
      detail: `${accessory.label} has a PixelLab ${template.label} overlay for the ${placementHint}. Confirm crop and motion on a real device before store screenshots.`,
      placementHint,
      needsDeviceQa: true,
    };
  }

  return {
    status: "inventory-ready",
    label: "Pack pending",
    detail: `${accessory.label} uses the shared inventory icon and procedural preview for ${template.label} until its template overlay pack ships.`,
    placementHint,
    needsDeviceQa: false,
  };
}

export function summarizeAvatarAccessoryFits(templateId: AvatarTemplateId): string {
  const template = getAvatarTemplate(templateId);
  const fittedCount = AVATAR_ACCESSORIES.filter((item) => deriveAvatarAccessoryFit(templateId, item).status === "template-fitted").length;
  const pendingCount = AVATAR_ACCESSORIES.length - fittedCount;
  const pendingCopy = pendingCount === 1 ? "1 stays" : `${pendingCount} stay`;

  return `${fittedCount}/${AVATAR_ACCESSORIES.length} accessories template-fitted for ${template.label}; ${pendingCopy} inventory-ready until their template overlay pack ships.`;
}

export function createDefaultAvatarConfig(
  petName = DEFAULT_PET_PLACEHOLDER,
  now = new Date().toISOString(),
): PetAvatarConfig {
  return {
    version: 1,
    petName,
    templateId: "shepherd",
    style: "pixel",
    coatPrimary: "#1B1714",
    coatSecondary: "#C99052",
    faceMarkingId: "mask",
    earTypeId: "tall",
    muzzleTypeId: "dark",
    eyeColor: "#6B4227",
    collarId: "forest-bandana",
    tagId: "heart",
    bandanaId: "forest-bandana",
    accessorySlots: {
      neck: "forest-bandana",
      room: "cozy-bed",
      fx: "heart-sparkles",
    },
    emotePackId: "phoenix-shepherd",
    updatedAt: now,
  };
}

export function normalizeAvatarConfig(
  input: unknown,
  petName = DEFAULT_PET_PLACEHOLDER,
): PetAvatarConfig {
  const fallback = createDefaultAvatarConfig(petName);
  if (!input || typeof input !== "object" || Array.isArray(input)) return fallback;

  const data = input as Partial<PetAvatarConfig>;
  const template = AVATAR_TEMPLATES.some((item) => item.id === data.templateId)
    ? data.templateId!
    : fallback.templateId;
  const templateDefaults = getAvatarTemplate(template);

  return {
    version: 1,
    petName: typeof data.petName === "string" && data.petName.trim() ? data.petName.trim() : petName,
    templateId: template,
    style: "pixel",
    coatPrimary: typeof data.coatPrimary === "string" ? data.coatPrimary : fallback.coatPrimary,
    coatSecondary: typeof data.coatSecondary === "string" ? data.coatSecondary : fallback.coatSecondary,
    faceMarkingId: isFaceMarking(data.faceMarkingId) ? data.faceMarkingId : fallback.faceMarkingId,
    earTypeId: isEarType(data.earTypeId) ? data.earTypeId : templateDefaults.defaultEarTypeId,
    muzzleTypeId: isMuzzleType(data.muzzleTypeId) ? data.muzzleTypeId : templateDefaults.defaultMuzzleTypeId,
    eyeColor: typeof data.eyeColor === "string" ? data.eyeColor : fallback.eyeColor,
    collarId: isCollar(data.collarId) ? data.collarId : fallback.collarId,
    tagId: isTag(data.tagId) ? data.tagId : fallback.tagId,
    bandanaId: isCollar(data.bandanaId) ? data.bandanaId : fallback.bandanaId,
    accessorySlots:
      data.accessorySlots && typeof data.accessorySlots === "object" && !Array.isArray(data.accessorySlots)
        ? { ...fallback.accessorySlots, ...data.accessorySlots }
        : fallback.accessorySlots,
    emotePackId:
      data.emotePackId === "starter-care-twin" ||
      data.emotePackId === "phoenix-shepherd" ||
      data.emotePackId === "retriever-starter" ||
      data.emotePackId === "husky-starter" ||
      data.emotePackId === "bully-starter"
        ? data.emotePackId
        : templateDefaults.recommendedEmotePackId,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : fallback.updatedAt,
  };
}

const AVATAR_ACCESSORY_SLOT_KEYS = [
  "head",
  "face",
  "neck",
  "body",
  "room",
  "fx",
] as const satisfies readonly (keyof AvatarAccessorySlots)[];

const MANUAL_AVATAR_FIELDS = [
  "templateId",
  "coatPrimary",
  "coatSecondary",
  "faceMarkingId",
  "earTypeId",
  "muzzleTypeId",
  "eyeColor",
  "collarId",
  "tagId",
  "bandanaId",
  "emotePackId",
] as const satisfies readonly (keyof PetAvatarConfig)[];

export function hasManualAvatarConfiguration(config: PetAvatarConfig): boolean {
  const baseline = createDefaultAvatarConfig(config.petName, config.updatedAt);
  return (
    MANUAL_AVATAR_FIELDS.some((field) => config[field] !== baseline[field]) ||
    AVATAR_ACCESSORY_SLOT_KEYS.some(
      (slot) => config.accessorySlots[slot] !== baseline.accessorySlots[slot],
    )
  );
}

export function shouldSyncAvatarStudioDraftFromContext(input: {
  draftDirty: boolean;
  persistenceInFlight: boolean;
}): boolean {
  return !input.draftDirty && !input.persistenceInFlight;
}

export function describeAvatarConfig(config: PetAvatarConfig): string {
  const template = getAvatarTemplate(config.templateId);
  return `${config.petName}: ${template.label}, ${config.faceMarkingId} face, ${config.earTypeId} ears, template-built`;
}

function isEarType(value: unknown): value is AvatarEarTypeId {
  return ["tall", "floppy", "button", "rose", "folded"].includes(String(value));
}

function isFaceMarking(value: unknown): value is AvatarFaceMarkingId {
  return ["none", "mask", "blaze", "muzzle", "eyebrows", "patch"].includes(String(value));
}

function isMuzzleType(value: unknown): value is AvatarMuzzleTypeId {
  return ["dark", "light", "spotted", "short", "long"].includes(String(value));
}

function isCollar(value: unknown): value is AvatarCollarId {
  return ["forest-bandana", "navy-collar", "copper-collar", "sage-bandana", "none"].includes(String(value));
}

function isTag(value: unknown): value is AvatarTagId {
  return ["heart", "bone", "shield", "round", "none"].includes(String(value));
}
