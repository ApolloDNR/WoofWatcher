import { AVATAR_ACCESSORIES, AVATAR_EMOTE_STATES, type AvatarTemplateId } from "./avatarStudio.ts";
import { getAvatarTemplatePack } from "./avatarTemplatePackManifest.ts";

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
  const pack = getAvatarTemplatePack(templateId);
  const totalAccessoryCount = AVATAR_ACCESSORIES.length;
  const liveAccessoryIds = new Set(pack.liveAccessoryIds);
  const liveAccessoryCount = AVATAR_ACCESSORIES.filter((accessory) => liveAccessoryIds.has(accessory.id)).length;
  const totalEmoteCount = AVATAR_EMOTE_STATES.length;
  const liveEmoteIds = new Set(pack.liveEmoteIds);
  const liveEmoteCount = AVATAR_EMOTE_STATES.filter((emote) => liveEmoteIds.has(emote)).length;
  const hasAnimatedPreview = pack.hasAnimatedPreview;
  const packStage: AvatarTemplatePackStage = hasAnimatedPreview
    ? "animated"
    : liveAccessoryCount > 0 || liveEmoteCount > 0
    ? "art-partial"
    : "base";

  return {
    packStage,
    hasBaseArt: pack.hasBaseArt,
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
  return Boolean(getAvatarTemplatePack(templateId).liveAccessoryIds.includes(accessoryId));
}

export function isAvatarTemplateEmoteLive(templateId: AvatarTemplateId, emote: string): boolean {
  return Boolean(getAvatarTemplatePack(templateId).liveEmoteIds.includes(emote as (typeof AVATAR_EMOTE_STATES)[number]));
}
