import type { AvatarEmoteState, AvatarTemplateId } from "./avatarStudio.ts";

export type AvatarTemplatePackFocus = "live" | "next" | "queued";

export interface AvatarTemplatePackManifestEntry {
  templateId: AvatarTemplateId;
  hasBaseArt: boolean;
  liveAccessoryIds: string[];
  liveEmoteIds: AvatarEmoteState[];
  hasAnimatedPreview: boolean;
  productionFocus: AvatarTemplatePackFocus;
  focusLabel: string;
  focusDetail: string;
}

const SHEPHERD_ACCESSORY_IDS = [
  "forest-bandana",
  "navy-collar",
  "birthday-hat",
  "sleepy-mask",
  "training-vest",
  "cozy-bed",
  "heart-sparkles",
] as const;

const FULL_FAMILY_WAVE_ACCESSORY_IDS = [
  "forest-bandana",
  "navy-collar",
  "copper-collar",
  "heart-tag",
  "trail-bandana",
  "birthday-hat",
  "sleepy-mask",
  "training-vest",
  "cozy-bed",
  "heart-sparkles",
] as const;

const FULL_EMOTE_IDS = [
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
] as const satisfies readonly AvatarEmoteState[];

export const AVATAR_TEMPLATE_PACK_MANIFEST = {
  shepherd: {
    templateId: "shepherd",
    hasBaseArt: true,
    liveAccessoryIds: [...SHEPHERD_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Live Phoenix pack",
    focusDetail: "The shepherd pack remains the benchmark care twin with live overlays, moods, and the original Phoenix sprite preview.",
  },
  retriever: {
    templateId: "retriever",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_FAMILY_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated family pack live",
    focusDetail: "Retriever now has the full family-pack contract: live overlays, all mood stills, and generated template strips for animated preview.",
  },
  husky: {
    templateId: "husky",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_FAMILY_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated family pack live",
    focusDetail: "Husky now has live overlays, the full mood set, and template animation strips so preview motion no longer falls back to still-only review.",
  },
  bully: {
    templateId: "bully",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Bully keeps truthful base art now while the next production pass moves beyond the finished family-dog animated packs.",
  },
  doodle: {
    templateId: "doodle",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_FAMILY_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated family pack live",
    focusDetail: "Doodle now has live overlays, the full mood set, and generated template strips that keep the curly body class animated in preview.",
  },
  terrier: {
    templateId: "terrier",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Terrier stays on base art until the next live pack pass opens for smaller body classes after the family-dog promotion.",
  },
  hound: {
    templateId: "hound",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Hound remains base-art ready while the next production sprint moves from the family-dog trio into the rest of launch breeds.",
  },
  dachshund: {
    templateId: "dachshund",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Dachshund needs its own long-body strip pass, so it stays queued after the first animated family packs land.",
  },
  spaniel: {
    templateId: "spaniel",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Spaniel remains truthful base art while the next live pack work shifts to the remaining launch breeds after the family-dog promotion.",
  },
  toy: {
    templateId: "toy",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Toy Breed keeps its base pose live now; production overlays, moods, and strips wait until the broader launch queue opens.",
  },
  slender: {
    templateId: "slender",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Slender stays queued because its gait and accessory anchors still need a separate motion pass after the family-dog promotion.",
  },
  mixed: {
    templateId: "mixed",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued for the next wave",
    focusDetail: "Mixed Breed remains a trustworthy base-only fallback until the remaining named launch packs receive live overlays, moods, and strips.",
  },
} satisfies Record<AvatarTemplateId, AvatarTemplatePackManifestEntry>;

export function getAvatarTemplatePack(templateId: AvatarTemplateId): AvatarTemplatePackManifestEntry {
  return AVATAR_TEMPLATE_PACK_MANIFEST[templateId];
}
