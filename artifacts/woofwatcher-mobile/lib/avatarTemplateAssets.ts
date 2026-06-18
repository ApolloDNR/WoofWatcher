import type { ImageSourcePropType } from "react-native";

import type { AvatarTemplateId } from "@/lib/avatarStudio";

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
