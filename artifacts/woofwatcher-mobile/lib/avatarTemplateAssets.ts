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
    source: require("@/assets/avatar/templates/shepherd/preview.png"),
    path: "assets/avatar/templates/shepherd/preview.png",
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
    source: require("@/assets/avatar/templates/shepherd/base.png"),
    path: "assets/avatar/templates/shepherd/base.png",
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
  retriever: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/retriever/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/retriever/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/retriever/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/retriever/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/retriever/accessories/navy-collar.png"),
      path: "assets/avatar/templates/retriever/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/retriever/accessories/copper-collar.png"),
      path: "assets/avatar/templates/retriever/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/retriever/accessories/heart-tag.png"),
      path: "assets/avatar/templates/retriever/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/retriever/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/retriever/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/retriever/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/retriever/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/retriever/accessories/training-vest.png"),
      path: "assets/avatar/templates/retriever/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/retriever/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/retriever/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/retriever/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/retriever/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  husky: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/husky/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/husky/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/husky/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/husky/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/husky/accessories/navy-collar.png"),
      path: "assets/avatar/templates/husky/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/husky/accessories/copper-collar.png"),
      path: "assets/avatar/templates/husky/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/husky/accessories/heart-tag.png"),
      path: "assets/avatar/templates/husky/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/husky/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/husky/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/husky/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/husky/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/husky/accessories/training-vest.png"),
      path: "assets/avatar/templates/husky/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/husky/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/husky/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/husky/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/husky/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  doodle: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/doodle/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/doodle/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/doodle/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/doodle/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/doodle/accessories/navy-collar.png"),
      path: "assets/avatar/templates/doodle/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/doodle/accessories/copper-collar.png"),
      path: "assets/avatar/templates/doodle/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/doodle/accessories/heart-tag.png"),
      path: "assets/avatar/templates/doodle/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/doodle/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/doodle/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/doodle/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/doodle/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/doodle/accessories/training-vest.png"),
      path: "assets/avatar/templates/doodle/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/doodle/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/doodle/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/doodle/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/doodle/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  bully: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/bully/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/bully/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/bully/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/bully/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/bully/accessories/navy-collar.png"),
      path: "assets/avatar/templates/bully/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/bully/accessories/copper-collar.png"),
      path: "assets/avatar/templates/bully/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/bully/accessories/heart-tag.png"),
      path: "assets/avatar/templates/bully/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/bully/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/bully/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/bully/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/bully/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/bully/accessories/training-vest.png"),
      path: "assets/avatar/templates/bully/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/bully/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/bully/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/bully/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/bully/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  terrier: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/terrier/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/terrier/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/terrier/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/terrier/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/terrier/accessories/navy-collar.png"),
      path: "assets/avatar/templates/terrier/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/terrier/accessories/copper-collar.png"),
      path: "assets/avatar/templates/terrier/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/terrier/accessories/heart-tag.png"),
      path: "assets/avatar/templates/terrier/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/terrier/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/terrier/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/terrier/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/terrier/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/terrier/accessories/training-vest.png"),
      path: "assets/avatar/templates/terrier/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/terrier/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/terrier/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/terrier/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/terrier/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  hound: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/hound/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/hound/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/hound/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/hound/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/hound/accessories/navy-collar.png"),
      path: "assets/avatar/templates/hound/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/hound/accessories/copper-collar.png"),
      path: "assets/avatar/templates/hound/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/hound/accessories/heart-tag.png"),
      path: "assets/avatar/templates/hound/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/hound/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/hound/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/hound/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/hound/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/hound/accessories/training-vest.png"),
      path: "assets/avatar/templates/hound/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/hound/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/hound/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/hound/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/hound/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  dachshund: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/dachshund/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/dachshund/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/dachshund/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/dachshund/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/dachshund/accessories/navy-collar.png"),
      path: "assets/avatar/templates/dachshund/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/dachshund/accessories/copper-collar.png"),
      path: "assets/avatar/templates/dachshund/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/dachshund/accessories/heart-tag.png"),
      path: "assets/avatar/templates/dachshund/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/dachshund/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/dachshund/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/dachshund/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/dachshund/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/dachshund/accessories/training-vest.png"),
      path: "assets/avatar/templates/dachshund/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/dachshund/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/dachshund/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/dachshund/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/dachshund/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  spaniel: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/spaniel/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/spaniel/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/spaniel/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/spaniel/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/spaniel/accessories/navy-collar.png"),
      path: "assets/avatar/templates/spaniel/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/spaniel/accessories/copper-collar.png"),
      path: "assets/avatar/templates/spaniel/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/spaniel/accessories/heart-tag.png"),
      path: "assets/avatar/templates/spaniel/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/spaniel/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/spaniel/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/spaniel/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/spaniel/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/spaniel/accessories/training-vest.png"),
      path: "assets/avatar/templates/spaniel/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/spaniel/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/spaniel/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/spaniel/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/spaniel/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  toy: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/toy/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/toy/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/toy/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/toy/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/toy/accessories/navy-collar.png"),
      path: "assets/avatar/templates/toy/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/toy/accessories/copper-collar.png"),
      path: "assets/avatar/templates/toy/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/toy/accessories/heart-tag.png"),
      path: "assets/avatar/templates/toy/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/toy/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/toy/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/toy/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/toy/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/toy/accessories/training-vest.png"),
      path: "assets/avatar/templates/toy/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/toy/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/toy/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/toy/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/toy/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  slender: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/slender/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/slender/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/slender/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/slender/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/slender/accessories/navy-collar.png"),
      path: "assets/avatar/templates/slender/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/slender/accessories/copper-collar.png"),
      path: "assets/avatar/templates/slender/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/slender/accessories/heart-tag.png"),
      path: "assets/avatar/templates/slender/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/slender/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/slender/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/slender/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/slender/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/slender/accessories/training-vest.png"),
      path: "assets/avatar/templates/slender/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/slender/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/slender/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/slender/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/slender/accessories/heart-sparkles.png",
      style: "pixellab-template-accessory",
    },
  },
  mixed: {
    "forest-bandana": {
      source: require("@/assets/avatar/templates/mixed/accessories/forest-bandana.png"),
      path: "assets/avatar/templates/mixed/accessories/forest-bandana.png",
      style: "pixellab-template-accessory",
    },
    "trail-bandana": {
      source: require("@/assets/avatar/templates/mixed/accessories/trail-bandana.png"),
      path: "assets/avatar/templates/mixed/accessories/trail-bandana.png",
      style: "pixellab-template-accessory",
    },
    "navy-collar": {
      source: require("@/assets/avatar/templates/mixed/accessories/navy-collar.png"),
      path: "assets/avatar/templates/mixed/accessories/navy-collar.png",
      style: "pixellab-template-accessory",
    },
    "copper-collar": {
      source: require("@/assets/avatar/templates/mixed/accessories/copper-collar.png"),
      path: "assets/avatar/templates/mixed/accessories/copper-collar.png",
      style: "pixellab-template-accessory",
    },
    "heart-tag": {
      source: require("@/assets/avatar/templates/mixed/accessories/heart-tag.png"),
      path: "assets/avatar/templates/mixed/accessories/heart-tag.png",
      style: "pixellab-template-accessory",
    },
    "birthday-hat": {
      source: require("@/assets/avatar/templates/mixed/accessories/birthday-hat.png"),
      path: "assets/avatar/templates/mixed/accessories/birthday-hat.png",
      style: "pixellab-template-accessory",
    },
    "sleepy-mask": {
      source: require("@/assets/avatar/templates/mixed/accessories/sleepy-mask.png"),
      path: "assets/avatar/templates/mixed/accessories/sleepy-mask.png",
      style: "pixellab-template-accessory",
    },
    "training-vest": {
      source: require("@/assets/avatar/templates/mixed/accessories/training-vest.png"),
      path: "assets/avatar/templates/mixed/accessories/training-vest.png",
      style: "pixellab-template-accessory",
    },
    "cozy-bed": {
      source: require("@/assets/avatar/templates/mixed/accessories/cozy-bed.png"),
      path: "assets/avatar/templates/mixed/accessories/cozy-bed.png",
      style: "pixellab-template-accessory",
    },
    "heart-sparkles": {
      source: require("@/assets/avatar/templates/mixed/accessories/heart-sparkles.png"),
      path: "assets/avatar/templates/mixed/accessories/heart-sparkles.png",
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
      source: require("@/assets/avatar/templates/retriever/emotes/home_alone.png"),
      path: "assets/avatar/templates/retriever/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/retriever/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/retriever/emotes/not_feeling_well.png",
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
      source: require("@/assets/avatar/templates/husky/emotes/home_alone.png"),
      path: "assets/avatar/templates/husky/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/husky/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/husky/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  doodle: {
    happy: {
      source: require("@/assets/avatar/templates/doodle/emotes/happy.png"),
      path: "assets/avatar/templates/doodle/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/doodle/emotes/calm.png"),
      path: "assets/avatar/templates/doodle/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/doodle/emotes/excited.png"),
      path: "assets/avatar/templates/doodle/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/doodle/emotes/bored.png"),
      path: "assets/avatar/templates/doodle/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/doodle/emotes/hungry.png"),
      path: "assets/avatar/templates/doodle/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/doodle/emotes/anxious.png"),
      path: "assets/avatar/templates/doodle/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/doodle/emotes/sleepy.png"),
      path: "assets/avatar/templates/doodle/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/doodle/emotes/proud.png"),
      path: "assets/avatar/templates/doodle/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/doodle/emotes/home_alone.png"),
      path: "assets/avatar/templates/doodle/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/doodle/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/doodle/emotes/not_feeling_well.png",
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
      source: require("@/assets/avatar/templates/bully/emotes/home_alone.png"),
      path: "assets/avatar/templates/bully/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/bully/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/bully/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  terrier: {
    happy: {
      source: require("@/assets/avatar/templates/terrier/emotes/happy.png"),
      path: "assets/avatar/templates/terrier/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/terrier/emotes/calm.png"),
      path: "assets/avatar/templates/terrier/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/terrier/emotes/excited.png"),
      path: "assets/avatar/templates/terrier/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/terrier/emotes/bored.png"),
      path: "assets/avatar/templates/terrier/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/terrier/emotes/hungry.png"),
      path: "assets/avatar/templates/terrier/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/terrier/emotes/anxious.png"),
      path: "assets/avatar/templates/terrier/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/terrier/emotes/sleepy.png"),
      path: "assets/avatar/templates/terrier/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/terrier/emotes/proud.png"),
      path: "assets/avatar/templates/terrier/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/terrier/emotes/home_alone.png"),
      path: "assets/avatar/templates/terrier/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/terrier/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/terrier/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  hound: {
    happy: {
      source: require("@/assets/avatar/templates/hound/emotes/happy.png"),
      path: "assets/avatar/templates/hound/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/hound/emotes/calm.png"),
      path: "assets/avatar/templates/hound/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/hound/emotes/excited.png"),
      path: "assets/avatar/templates/hound/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/hound/emotes/bored.png"),
      path: "assets/avatar/templates/hound/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/hound/emotes/hungry.png"),
      path: "assets/avatar/templates/hound/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/hound/emotes/anxious.png"),
      path: "assets/avatar/templates/hound/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/hound/emotes/sleepy.png"),
      path: "assets/avatar/templates/hound/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/hound/emotes/proud.png"),
      path: "assets/avatar/templates/hound/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/hound/emotes/home_alone.png"),
      path: "assets/avatar/templates/hound/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/hound/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/hound/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  dachshund: {
    happy: {
      source: require("@/assets/avatar/templates/dachshund/emotes/happy.png"),
      path: "assets/avatar/templates/dachshund/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/dachshund/emotes/calm.png"),
      path: "assets/avatar/templates/dachshund/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/dachshund/emotes/excited.png"),
      path: "assets/avatar/templates/dachshund/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/dachshund/emotes/bored.png"),
      path: "assets/avatar/templates/dachshund/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/dachshund/emotes/hungry.png"),
      path: "assets/avatar/templates/dachshund/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/dachshund/emotes/anxious.png"),
      path: "assets/avatar/templates/dachshund/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/dachshund/emotes/sleepy.png"),
      path: "assets/avatar/templates/dachshund/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/dachshund/emotes/proud.png"),
      path: "assets/avatar/templates/dachshund/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/dachshund/emotes/home_alone.png"),
      path: "assets/avatar/templates/dachshund/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/dachshund/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/dachshund/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  spaniel: {
    happy: {
      source: require("@/assets/avatar/templates/spaniel/emotes/happy.png"),
      path: "assets/avatar/templates/spaniel/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/spaniel/emotes/calm.png"),
      path: "assets/avatar/templates/spaniel/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/spaniel/emotes/excited.png"),
      path: "assets/avatar/templates/spaniel/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/spaniel/emotes/bored.png"),
      path: "assets/avatar/templates/spaniel/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/spaniel/emotes/hungry.png"),
      path: "assets/avatar/templates/spaniel/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/spaniel/emotes/anxious.png"),
      path: "assets/avatar/templates/spaniel/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/spaniel/emotes/sleepy.png"),
      path: "assets/avatar/templates/spaniel/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/spaniel/emotes/proud.png"),
      path: "assets/avatar/templates/spaniel/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/spaniel/emotes/home_alone.png"),
      path: "assets/avatar/templates/spaniel/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/spaniel/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/spaniel/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  toy: {
    happy: {
      source: require("@/assets/avatar/templates/toy/emotes/happy.png"),
      path: "assets/avatar/templates/toy/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/toy/emotes/calm.png"),
      path: "assets/avatar/templates/toy/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/toy/emotes/excited.png"),
      path: "assets/avatar/templates/toy/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/toy/emotes/bored.png"),
      path: "assets/avatar/templates/toy/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/toy/emotes/hungry.png"),
      path: "assets/avatar/templates/toy/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/toy/emotes/anxious.png"),
      path: "assets/avatar/templates/toy/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/toy/emotes/sleepy.png"),
      path: "assets/avatar/templates/toy/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/toy/emotes/proud.png"),
      path: "assets/avatar/templates/toy/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/toy/emotes/home_alone.png"),
      path: "assets/avatar/templates/toy/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/toy/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/toy/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  slender: {
    happy: {
      source: require("@/assets/avatar/templates/slender/emotes/happy.png"),
      path: "assets/avatar/templates/slender/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/slender/emotes/calm.png"),
      path: "assets/avatar/templates/slender/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/slender/emotes/excited.png"),
      path: "assets/avatar/templates/slender/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/slender/emotes/bored.png"),
      path: "assets/avatar/templates/slender/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/slender/emotes/hungry.png"),
      path: "assets/avatar/templates/slender/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/slender/emotes/anxious.png"),
      path: "assets/avatar/templates/slender/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/slender/emotes/sleepy.png"),
      path: "assets/avatar/templates/slender/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/slender/emotes/proud.png"),
      path: "assets/avatar/templates/slender/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/slender/emotes/home_alone.png"),
      path: "assets/avatar/templates/slender/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/slender/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/slender/emotes/not_feeling_well.png",
      style: "pixellab-template-emote",
    },
  },
  mixed: {
    happy: {
      source: require("@/assets/avatar/templates/mixed/emotes/happy.png"),
      path: "assets/avatar/templates/mixed/emotes/happy.png",
      style: "pixellab-template-emote",
    },
    calm: {
      source: require("@/assets/avatar/templates/mixed/emotes/calm.png"),
      path: "assets/avatar/templates/mixed/emotes/calm.png",
      style: "pixellab-template-emote",
    },
    excited: {
      source: require("@/assets/avatar/templates/mixed/emotes/excited.png"),
      path: "assets/avatar/templates/mixed/emotes/excited.png",
      style: "pixellab-template-emote",
    },
    bored: {
      source: require("@/assets/avatar/templates/mixed/emotes/bored.png"),
      path: "assets/avatar/templates/mixed/emotes/bored.png",
      style: "pixellab-template-emote",
    },
    hungry: {
      source: require("@/assets/avatar/templates/mixed/emotes/hungry.png"),
      path: "assets/avatar/templates/mixed/emotes/hungry.png",
      style: "pixellab-template-emote",
    },
    anxious: {
      source: require("@/assets/avatar/templates/mixed/emotes/anxious.png"),
      path: "assets/avatar/templates/mixed/emotes/anxious.png",
      style: "pixellab-template-emote",
    },
    sleepy: {
      source: require("@/assets/avatar/templates/mixed/emotes/sleepy.png"),
      path: "assets/avatar/templates/mixed/emotes/sleepy.png",
      style: "pixellab-template-emote",
    },
    proud: {
      source: require("@/assets/avatar/templates/mixed/emotes/proud.png"),
      path: "assets/avatar/templates/mixed/emotes/proud.png",
      style: "pixellab-template-emote",
    },
    home_alone: {
      source: require("@/assets/avatar/templates/mixed/emotes/home_alone.png"),
      path: "assets/avatar/templates/mixed/emotes/home_alone.png",
      style: "pixellab-template-emote",
    },
    not_feeling_well: {
      source: require("@/assets/avatar/templates/mixed/emotes/not_feeling_well.png"),
      path: "assets/avatar/templates/mixed/emotes/not_feeling_well.png",
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
