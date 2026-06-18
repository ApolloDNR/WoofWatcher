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

export interface AvatarTemplateReadiness {
  hasBaseArt: boolean;
  liveAccessoryCount: number;
  totalAccessoryCount: number;
  liveEmoteCount: number;
  totalEmoteCount: number;
  hasAnimatedPreview: boolean;
  previewLabel: string;
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

  return {
    hasBaseArt: LIVE_BASE_TEMPLATES.includes(templateId),
    liveAccessoryCount,
    totalAccessoryCount,
    liveEmoteCount,
    totalEmoteCount,
    hasAnimatedPreview,
    previewLabel: hasAnimatedPreview ? "Animated Phoenix pack" : "Starter still preview",
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
