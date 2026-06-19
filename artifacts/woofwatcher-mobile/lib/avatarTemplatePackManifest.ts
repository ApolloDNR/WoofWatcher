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

const FULL_TEMPLATE_PACK_ACCESSORY_IDS = [
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
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Retriever now has the full launch-pack contract: live overlays, all mood stills, and generated template strips for animated preview.",
  },
  husky: {
    templateId: "husky",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Husky now has live overlays, the full mood set, and template animation strips so preview motion no longer falls back to still-only review.",
  },
  bully: {
    templateId: "bully",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Bully now has live overlays, the full mood set, and generated preview strips that keep the compact body class animated in review.",
  },
  doodle: {
    templateId: "doodle",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Doodle now has live overlays, the full mood set, and generated template strips that keep the curly body class animated in preview.",
  },
  terrier: {
    templateId: "terrier",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Terrier now has live overlays, the full mood set, and generated preview strips sized to keep its smaller body class readable on phone.",
  },
  hound: {
    templateId: "hound",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Hound now has live overlays, the full mood set, and generated preview strips that keep its longer ears and sporting frame animated in review.",
  },
  dachshund: {
    templateId: "dachshund",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Dachshund now has live overlays, the full mood set, and generated preview strips that keep the long-body template animated without faking a separate walk cycle.",
  },
  spaniel: {
    templateId: "spaniel",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Spaniel now has live overlays, the full mood set, and generated preview strips that keep the soft-ear template animated in review.",
  },
  toy: {
    templateId: "toy",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Toy Breed now has live overlays, the full mood set, and generated preview strips scaled for small-companion readability.",
  },
  slender: {
    templateId: "slender",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Slender now has live overlays, the full mood set, and generated preview strips that keep the taller frame animated while final gait polish stays separate.",
  },
  mixed: {
    templateId: "mixed",
    hasBaseArt: true,
    liveAccessoryIds: [...FULL_TEMPLATE_PACK_ACCESSORY_IDS],
    liveEmoteIds: [...FULL_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Animated launch pack live",
    focusDetail: "Mixed Breed now has live overlays, the full mood set, and generated preview strips so the flexible default template no longer trails the named launch breeds.",
  },
} satisfies Record<AvatarTemplateId, AvatarTemplatePackManifestEntry>;

export function getAvatarTemplatePack(templateId: AvatarTemplateId): AvatarTemplatePackManifestEntry {
  return AVATAR_TEMPLATE_PACK_MANIFEST[templateId];
}
