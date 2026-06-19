import type { ImageSourcePropType } from "react-native";

import type { AvatarEmoteState, AvatarTemplateId } from "@/lib/avatarStudio";

export interface AvatarTemplatePreviewAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-template-preview";
}

export interface AvatarTemplateBaseAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-template-base";
}

export interface AvatarTemplateAccessoryAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-template-accessory";
}

export interface AvatarTemplateEmoteAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-template-emote";
}

export const AVATAR_TEMPLATE_PREVIEW_ASSETS: Record<AvatarTemplateId, AvatarTemplatePreviewAsset> = {
  shepherd: {
    source: require("@/assets/avatar/templates/shepherd/preview-crisp.png"),
    path: "assets/avatar/templates/shepherd/preview-crisp.png",
    style: "pixellab-template-preview",
  },
  retriever: {
    source: require("@/assets/avatar/templates/retriever/preview.png"),
    path: "assets/avatar/templates/retriever/preview.png",
    style: "pixellab-template-preview",
  },
  husky: {
    source: require("@/assets/avatar/templates/husky/preview.png"),
    path: "assets/avatar/templates/husky/preview.png",
    style: "pixellab-template-preview",
  },
  bully: {
    source: require("@/assets/avatar/templates/bully/preview.png"),
    path: "assets/avatar/templates/bully/preview.png",
    style: "pixellab-template-preview",
  },
  doodle: {
    source: require("@/assets/avatar/templates/doodle/preview.png"),
    path: "assets/avatar/templates/doodle/preview.png",
    style: "pixellab-template-preview",
  },
  terrier: {
    source: require("@/assets/avatar/templates/terrier/preview.png"),
    path: "assets/avatar/templates/terrier/preview.png",
    style: "pixellab-template-preview",
  },
  hound: {
    source: require("@/assets/avatar/templates/hound/preview.png"),
    path: "assets/avatar/templates/hound/preview.png",
    style: "pixellab-template-preview",
  },
  dachshund: {
    source: require("@/assets/avatar/templates/dachshund/preview.png"),
    path: "assets/avatar/templates/dachshund/preview.png",
    style: "pixellab-template-preview",
  },
  spaniel: {
    source: require("@/assets/avatar/templates/spaniel/preview.png"),
    path: "assets/avatar/templates/spaniel/preview.png",
    style: "pixellab-template-preview",
  },
  toy: {
    source: require("@/assets/avatar/templates/toy/preview.png"),
    path: "assets/avatar/templates/toy/preview.png",
    style: "pixellab-template-preview",
  },
  slender: {
    source: require("@/assets/avatar/templates/slender/preview.png"),
    path: "assets/avatar/templates/slender/preview.png",
    style: "pixellab-template-preview",
  },
  mixed: {
    source: require("@/assets/avatar/templates/mixed/preview.png"),
    path: "assets/avatar/templates/mixed/preview.png",
    style: "pixellab-template-preview",
  },
};

export const AVATAR_TEMPLATE_BASE_ASSETS: Partial<Record<AvatarTemplateId, AvatarTemplateBaseAsset>> = {
  shepherd: {
    source: require("@/assets/avatar/templates/shepherd/base-crisp.png"),
    path: "assets/avatar/templates/shepherd/base-crisp.png",
    style: "pixellab-template-base",
  },
  retriever: {
    source: require("@/assets/avatar/templates/retriever/base.png"),
    path: "assets/avatar/templates/retriever/base.png",
    style: "pixellab-template-base",
  },
  husky: {
    source: require("@/assets/avatar/templates/husky/base.png"),
    path: "assets/avatar/templates/husky/base.png",
    style: "pixellab-template-base",
  },
  doodle: {
    source: require("@/assets/avatar/templates/doodle/base.png"),
    path: "assets/avatar/templates/doodle/base.png",
    style: "pixellab-template-base",
  },
  bully: {
    source: require("@/assets/avatar/templates/bully/base.png"),
    path: "assets/avatar/templates/bully/base.png",
    style: "pixellab-template-base",
  },
  terrier: {
    source: require("@/assets/avatar/templates/terrier/base.png"),
    path: "assets/avatar/templates/terrier/base.png",
    style: "pixellab-template-base",
  },
  hound: {
    source: require("@/assets/avatar/templates/hound/base.png"),
    path: "assets/avatar/templates/hound/base.png",
    style: "pixellab-template-base",
  },
  toy: {
    source: require("@/assets/avatar/templates/toy/base.png"),
    path: "assets/avatar/templates/toy/base.png",
    style: "pixellab-template-base",
  },
  spaniel: {
    source: require("@/assets/avatar/templates/spaniel/base.png"),
    path: "assets/avatar/templates/spaniel/base.png",
    style: "pixellab-template-base",
  },
  dachshund: {
    source: require("@/assets/avatar/templates/dachshund/base.png"),
    path: "assets/avatar/templates/dachshund/base.png",
    style: "pixellab-template-base",
  },
  slender: {
    source: require("@/assets/avatar/templates/slender/base.png"),
    path: "assets/avatar/templates/slender/base.png",
    style: "pixellab-template-base",
  },
  mixed: {
    source: require("@/assets/avatar/templates/mixed/base.png"),
    path: "assets/avatar/templates/mixed/base.png",
    style: "pixellab-template-base",
  },
};

export const AVATAR_TEMPLATE_ACCESSORY_ASSETS: Partial<
  Record<AvatarTemplateId, Partial<Record<string, AvatarTemplateAccessoryAsset>>>
> = {
  shepherd: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/shepherd/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/shepherd/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/shepherd/accessories/navy-collar.png"),
      path: "assets/avatar/templates/shepherd/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/shepherd/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/shepherd/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/shepherd/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/shepherd/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/shepherd/accessories/training-vest.png"),
      path: "assets/avatar/templates/shepherd/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/shepherd/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/shepherd/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/shepherd/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/shepherd/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
};

export const AVATAR_TEMPLATE_EMOTE_ASSETS: Partial<
  Record<AvatarTemplateId, Partial<Record<AvatarEmoteState, AvatarTemplateEmoteAsset>>>
> = {
  shepherd: {
    happy: {
      source: require("@/assets/avatar/templates/shepherd/emotes/happy.png"),
      path: "assets/avatar/templates/shepherd/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/shepherd/emotes/calm.png"),
      path: "assets/avatar/templates/shepherd/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/shepherd/emotes/excited.png"),
      path: "assets/avatar/templates/shepherd/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/shepherd/emotes/bored.png"),
      path: "assets/avatar/templates/shepherd/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/shepherd/emotes/hungry.png"),
      path: "assets/avatar/templates/shepherd/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/shepherd/emotes/anxious.png"),
      path: "assets/avatar/templates/shepherd/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/shepherd/emotes/sleepy.png"),
      path: "assets/avatar/templates/shepherd/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/shepherd/emotes/proud.png"),
      path: "assets/avatar/templates/shepherd/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/shepherd/emotes/home_alone.png"),
      path: "assets/avatar/templates/shepherd/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/shepherd/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/shepherd/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  retriever: {
    happy: {
      source: require("@/assets/avatar/templates/retriever/emotes/happy.png"),
      path: "assets/avatar/templates/retriever/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/retriever/emotes/calm.png"),
      path: "assets/avatar/templates/retriever/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/retriever/emotes/excited.png"),
      path: "assets/avatar/templates/retriever/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/retriever/emotes/bored.png"),
      path: "assets/avatar/templates/retriever/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/retriever/emotes/hungry.png"),
      path: "assets/avatar/templates/retriever/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/retriever/emotes/anxious.png"),
      path: "assets/avatar/templates/retriever/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/retriever/emotes/sleepy.png"),
      path: "assets/avatar/templates/retriever/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/retriever/emotes/proud.png"),
      path: "assets/avatar/templates/retriever/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/retriever/emotes/home-alone.png"),
      path: "assets/avatar/templates/retriever/emotes/home-alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/retriever/emotes/not-feeling-well.png"),
      path: "assets/avatar/templates/retriever/emotes/not-feeling-well.png",
      style: "pixellab-template-emote",
    },
  },
  husky: {
    happy: {
      source: require("@/assets/avatar/templates/husky/emotes/happy.png"),
      path: "assets/avatar/templates/husky/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/husky/emotes/calm.png"),
      path: "assets/avatar/templates/husky/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/husky/emotes/excited.png"),
      path: "assets/avatar/templates/husky/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/husky/emotes/bored.png"),
      path: "assets/avatar/templates/husky/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/husky/emotes/hungry.png"),
      path: "assets/avatar/templates/husky/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/husky/emotes/anxious.png"),
      path: "assets/avatar/templates/husky/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/husky/emotes/sleepy.png"),
      path: "assets/avatar/templates/husky/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/husky/emotes/proud.png"),
      path: "assets/avatar/templates/husky/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/husky/emotes/home-alone.png"),
      path: "assets/avatar/templates/husky/emotes/home-alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/husky/emotes/not-feeling-well.png"),
      path: "assets/avatar/templates/husky/emotes/not-feeling-well.png",
      style: "pixellab-template-emote",
    },
  },
  bully: {
    happy: {
      source: require("@/assets/avatar/templates/bully/emotes/happy.png"),
      path: "assets/avatar/templates/bully/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/bully/emotes/calm.png"),
      path: "assets/avatar/templates/bully/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/bully/emotes/excited.png"),
      path: "assets/avatar/templates/bully/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/bully/emotes/bored.png"),
      path: "assets/avatar/templates/bully/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/bully/emotes/hungry.png"),
      path: "assets/avatar/templates/bully/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/bully/emotes/anxious.png"),
      path: "assets/avatar/templates/bully/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/bully/emotes/sleepy.png"),
      path: "assets/avatar/templates/bully/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/bully/emotes/proud.png"),
      path: "assets/avatar/templates/bully/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/bully/emotes/home-alone.png"),
      path: "assets/avatar/templates/bully/emotes/home-alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/bully/emotes/not-feeling-well.png"),
      path: "assets/avatar/templates/bully/emotes/not-feeling-well.png",
      style: "pixellab-template-emote",
    },
  },
};

export function getAvatarTemplatePreviewSource(templateId: AvatarTemplateId): ImageSourcePropType {
  return AVATAR_TEMPLATE_PREVIEW_ASSETS[templateId]?.source ?? AVATAR_TEMPLATE_PREVIEW_ASSETS.shepherd.source;
}

export function getAvatarTemplateBaseSource(templateId: AvatarTemplateId): ImageSourcePropType | undefined {
  return AVATAR_TEMPLATE_BASE_ASSETS[templateId]?.source;
}

export function getAvatarTemplateDisplaySource(templateId: AvatarTemplateId): ImageSourcePropType {
  return getAvatarTemplateBaseSource(templateId) ?? getAvatarTemplatePreviewSource(templateId);
}

export function getAvatarTemplateAccessoryAsset(
  templateId: AvatarTemplateId,
  accessoryId: string,
): AvatarTemplateAccessoryAsset | undefined {
  return AVATAR_TEMPLATE_ACCESSORY_ASSETS[templateId]?.[accessoryId];
}

export function getAvatarTemplateAccessorySource(
  templateId: AvatarTemplateId,
  accessoryId: string,
): ImageSourcePropType | undefined {
  return getAvatarTemplateAccessoryAsset(templateId, accessoryId)?.source;
}

export function getAvatarTemplateEmoteAsset(
  templateId: AvatarTemplateId,
  emote: AvatarEmoteState,
): AvatarTemplateEmoteAsset | undefined {
  return AVATAR_TEMPLATE_EMOTE_ASSETS[templateId]?.[emote];
}

export function getAvatarTemplateEmoteSource(
  templateId: AvatarTemplateId,
  emote: AvatarEmoteState,
): ImageSourcePropType | undefined {
  return getAvatarTemplateEmoteAsset(templateId, emote)?.source;
}
