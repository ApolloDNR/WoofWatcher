import type { ImageSourcePropType } from "react-native";

import type { AvatarAccessorySlots } from "@/lib/avatarStudio";

export type AvatarAccessoryAssetId =
  | "forest-bandana"
  | "navy-collar"
  | "copper-collar"
  | "heart-tag"
  | "trail-bandana"
  | "birthday-hat"
  | "sleepy-mask"
  | "training-vest"
  | "cozy-bed"
  | "heart-sparkles";

export interface AvatarAccessoryAsset {
  source: ImageSourcePropType;
  path: string;
  style: "pixellab-avatar-accessory";
  slot: keyof AvatarAccessorySlots;
  description: string;
}

export const AVATAR_ACCESSORY_ASSETS: Record<AvatarAccessoryAssetId, AvatarAccessoryAsset> = {
  "forest-bandana": {
    source: require("@/assets/avatar/accessories/forest-bandana.png"),
    path: "assets/avatar/accessories/forest-bandana.png",
    style: "pixellab-avatar-accessory",
    slot: "neck",
    description: "Forest green bandana inventory icon for Phoenix's neck slot.",
  },
  "navy-collar": {
    source: require("@/assets/avatar/accessories/navy-collar.png"),
    path: "assets/avatar/accessories/navy-collar.png",
    style: "pixellab-avatar-accessory",
    slot: "neck",
    description: "Navy collar inventory icon with a copper buckle.",
  },
  "copper-collar": {
    source: require("@/assets/avatar/accessories/copper-collar.png"),
    path: "assets/avatar/accessories/copper-collar.png",
    style: "pixellab-avatar-accessory",
    slot: "neck",
    description: "Copper collar inventory icon with a navy buckle.",
  },
  "heart-tag": {
    source: require("@/assets/avatar/accessories/heart-tag.png"),
    path: "assets/avatar/accessories/heart-tag.png",
    style: "pixellab-avatar-accessory",
    slot: "neck",
    description: "Copper heart tag charm inventory icon.",
  },
  "trail-bandana": {
    source: require("@/assets/avatar/accessories/trail-bandana.png"),
    path: "assets/avatar/accessories/trail-bandana.png",
    style: "pixellab-avatar-accessory",
    slot: "neck",
    description: "Sage trail bandana inventory icon with leaf detail.",
  },
  "birthday-hat": {
    source: require("@/assets/avatar/accessories/birthday-hat.png"),
    path: "assets/avatar/accessories/birthday-hat.png",
    style: "pixellab-avatar-accessory",
    slot: "head",
    description: "Birthday hat inventory icon for celebration moments.",
  },
  "sleepy-mask": {
    source: require("@/assets/avatar/accessories/sleepy-mask.png"),
    path: "assets/avatar/accessories/sleepy-mask.png",
    style: "pixellab-avatar-accessory",
    slot: "face",
    description: "Sleepy mask inventory icon for rest states.",
  },
  "training-vest": {
    source: require("@/assets/avatar/accessories/training-vest.png"),
    path: "assets/avatar/accessories/training-vest.png",
    style: "pixellab-avatar-accessory",
    slot: "body",
    description: "Training vest inventory icon for practice sessions.",
  },
  "cozy-bed": {
    source: require("@/assets/avatar/accessories/cozy-bed.png"),
    path: "assets/avatar/accessories/cozy-bed.png",
    style: "pixellab-avatar-accessory",
    slot: "room",
    description: "Cozy bed room accessory inventory icon.",
  },
  "heart-sparkles": {
    source: require("@/assets/avatar/accessories/heart-sparkles.png"),
    path: "assets/avatar/accessories/heart-sparkles.png",
    style: "pixellab-avatar-accessory",
    slot: "fx",
    description: "Heart sparkle effect inventory icon for bond moments.",
  },
};

export function getAvatarAccessoryAsset(id: string): AvatarAccessoryAsset | null {
  return AVATAR_ACCESSORY_ASSETS[id as AvatarAccessoryAssetId] ?? null;
}
