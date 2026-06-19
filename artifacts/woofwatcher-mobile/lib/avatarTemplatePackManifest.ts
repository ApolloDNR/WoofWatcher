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

const SHEPHERD_EMOTE_IDS = [
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

const NEXT_WAVE_ACCESSORY_IDS = [
  "forest-bandana",
  "trail-bandana",
  "navy-collar",
  "copper-collar",
  "heart-tag",
  "birthday-hat",
  "cozy-bed",
  "heart-sparkles",
] as const;

const NEXT_WAVE_EMOTE_IDS = [
  "happy",
  "calm",
  "excited",
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
    liveEmoteIds: [...SHEPHERD_EMOTE_IDS],
    hasAnimatedPreview: true,
    productionFocus: "live",
    focusLabel: "Live Phoenix pack",
    focusDetail: "The shepherd pack is the production benchmark with live overlays, moods, and sprite preview.",
  },
  retriever: {
    templateId: "retriever",
    hasBaseArt: true,
    liveAccessoryIds: [...NEXT_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...NEXT_WAVE_EMOTE_IDS],
    hasAnimatedPreview: false,
    productionFocus: "next",
    focusLabel: "Partial pack live",
    focusDetail: "Retriever now has file-backed overlays and mood stills; animated sprite strips are the next promotion step.",
  },
  husky: {
    templateId: "husky",
    hasBaseArt: true,
    liveAccessoryIds: [...NEXT_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...NEXT_WAVE_EMOTE_IDS],
    hasAnimatedPreview: false,
    productionFocus: "next",
    focusLabel: "Partial pack live",
    focusDetail: "Husky now has file-backed overlays and mood stills; tail and full animated strip clearance still need the next pass.",
  },
  bully: {
    templateId: "bully",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Bully keeps truthful base art now while the next live packs focus on the three highest-demand family-dog templates.",
  },
  doodle: {
    templateId: "doodle",
    hasBaseArt: true,
    liveAccessoryIds: [...NEXT_WAVE_ACCESSORY_IDS],
    liveEmoteIds: [...NEXT_WAVE_EMOTE_IDS],
    hasAnimatedPreview: false,
    productionFocus: "next",
    focusLabel: "Partial pack live",
    focusDetail: "Doodle now has file-backed overlays and mood stills; animated curls and motion strips are still the next pack step.",
  },
  terrier: {
    templateId: "terrier",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Terrier stays on base art until the next family-dog packs land and the pack queue opens for smaller body classes.",
  },
  hound: {
    templateId: "hound",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Hound remains base-art ready while the next production sprint finishes the family-dog launch templates first.",
  },
  dachshund: {
    templateId: "dachshund",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Dachshund needs a dedicated long-body animation pass, so it stays queued after the current family-dog pack targets.",
  },
  spaniel: {
    templateId: "spaniel",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Spaniel remains truthful base art while the next live pack work stays focused on Retriever, Husky, and Doodle.",
  },
  toy: {
    templateId: "toy",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Toy Breed keeps its base pose live now; production overlays and moods wait until the main family-dog pack wave is complete.",
  },
  slender: {
    templateId: "slender",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Slender stays queued because its gait and accessory anchors need a separate motion pass after the next priority wave.",
  },
  mixed: {
    templateId: "mixed",
    hasBaseArt: true,
    liveAccessoryIds: [],
    liveEmoteIds: [],
    hasAnimatedPreview: false,
    productionFocus: "queued",
    focusLabel: "Queued after family-dog wave",
    focusDetail: "Mixed Breed remains a trustworthy base-only fallback until the highest-demand named packs have live overlays and moods.",
  },
} satisfies Record<AvatarTemplateId, AvatarTemplatePackManifestEntry>;

export function getAvatarTemplatePack(templateId: AvatarTemplateId): AvatarTemplatePackManifestEntry {
  return AVATAR_TEMPLATE_PACK_MANIFEST[templateId];
}
