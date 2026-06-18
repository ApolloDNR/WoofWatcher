import { AVATAR_ACCESSORIES, AVATAR_EMOTE_STATES, type AvatarTemplateId } from "./avatarStudio.ts";

const LIVE_BASE_TEMPLATES: AvatarTemplateId[] = [
  "shepherd",
  "retriever",
  "husky",
  "bully",
  "doodle",
  "terrier",
  "hound",
  "dachshund",
  "spaniel",
  "toy",
  "slender",
  "mixed",
];

const LIVE_ACCESSORY_IDS: Partial<Record<AvatarTemplateId, string[]>> = {
  shepherd: [
    "forest-bandana",
    "navy-collar",
    "birthday-hat",
    "sleepy-mask",
    "training-vest",
    "cozy-bed",
    "heart-sparkles",
  ],
};

const LIVE_EMOTE_IDS: Partial<Record<AvatarTemplateId, string[]>> = {
  shepherd: [...AVATAR_EMOTE_STATES],
};

export type AvatarTemplatePackStage = "base" | "art-partial" | "animated";

export interface AvatarTemplateReadiness {
  packStage: AvatarTemplatePackStage;
  hasBaseArt: boolean;
  liveAccessoryCount: number;
  totalAccessoryCount: number;
  liveEmoteCount: number;
  totalEmoteCount: number;
  hasAnimatedPreview: boolean;
  previewLabel: string;
  stageLabel: string;
  stageDetail: string;
  accessoryStatus: string;
  emoteStatus: string;
}

export function getAvatarTemplateReadiness(templateId: AvatarTemplateId): AvatarTemplateReadiness {
  const totalAccessoryCount = AVATAR_ACCESSORIES.length;
  const liveAccessoryIds = new Set(LIVE_ACCESSORY_IDS[templateId] ?? []);
  const liveAccessoryCount = AVATAR_ACCESSORIES.filter((accessory) => liveAccessoryIds.has(accessory.id)).length;
  const totalEmoteCount = AVATAR_EMOTE_STATES.length;
  const liveEmoteIds = new Set(LIVE_EMOTE_IDS[templateId] ?? []);
  const liveEmoteCount = AVATAR_EMOTE_STATES.filter((emote) => liveEmoteIds.has(emote)).length;
  const hasAnimatedPreview = templateId === "shepherd";
  const packStage: AvatarTemplatePackStage = hasAnimatedPreview
    ? "animated"
    : liveAccessoryCount > 0 || liveEmoteCount > 0
    ? "art-partial"
    : "base";

  return {
    packStage,
    hasBaseArt: LIVE_BASE_TEMPLATES.includes(templateId),
    liveAccessoryCount,
    totalAccessoryCount,
    liveEmoteCount,
    totalEmoteCount,
    hasAnimatedPreview,
    previewLabel: hasAnimatedPreview ? "Animated Phoenix pack" : "Starter still preview",
    stageLabel:
      packStage === "animated"
        ? "Animated pack ready"
        : packStage === "art-partial"
        ? "Art pack in progress"
        : "Base art live",
    stageDetail:
      packStage === "animated"
        ? "Overlays, moods, and sprite preview are live."
        : packStage === "art-partial"
        ? "Some overlays or moods are live; sprite strips are still finishing."
        : "Base pose is live; overlays, moods, and sprite strips are still pending.",
    accessoryStatus:
      liveAccessoryCount > 0
        ? `${liveAccessoryCount}/${totalAccessoryCount} live overlays`
        : "Production overlays pending",
    emoteStatus:
      liveEmoteCount > 0
        ? `${liveEmoteCount}/${totalEmoteCount} live moods`
        : "Production moods pending",
  };
}

export function isAvatarTemplateAccessoryLive(templateId: AvatarTemplateId, accessoryId: string): boolean {
  return Boolean(LIVE_ACCESSORY_IDS[templateId]?.includes(accessoryId));
}

export function isAvatarTemplateEmoteLive(templateId: AvatarTemplateId, emote: string): boolean {
  return Boolean(LIVE_EMOTE_IDS[templateId]?.includes(emote));
}
