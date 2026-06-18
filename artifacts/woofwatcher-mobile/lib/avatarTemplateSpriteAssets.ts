import type { ImageSourcePropType } from "react-native";

import type { SpriteSheetTrack } from "@/components/SpriteSheetPlayer";
import type { AvatarEmoteState, AvatarTemplateId } from "@/lib/avatarStudio";
import type { CareTwinSpriteAsset } from "@/lib/careTwinAssets";

export type AvatarTemplateSpriteAction = "idle-tail-wag" | "walk-loop";

export interface AvatarTemplateSpritePackItem {
  action: AvatarTemplateSpriteAction;
  label: string;
  asset: CareTwinSpriteAsset;
  track: SpriteSheetTrack & {
    requiredAsset: string;
    anchor: "bottom-center";
    notes: string;
  };
}

function spriteAsset(source: ImageSourcePropType): CareTwinSpriteAsset {
  return {
    source,
    columns: 8,
    rows: 1,
    frameWidth: 256,
    frameHeight: 256,
  };
}

export const AVATAR_TEMPLATE_SPRITE_ASSETS: Partial<
  Record<AvatarTemplateId, Partial<Record<AvatarTemplateSpriteAction, AvatarTemplateSpritePackItem>>>
> = {
  bully: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Bully live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/bully/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "bully:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/bully/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Bully idle breathing and soft body/tail wiggle loop.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Bully walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/bully/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "bully:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/bully/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Bully standing-source walking-in-place loop for live Avatar Studio preview.",
      },
    },
  },
  doodle: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Doodle live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/doodle/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "doodle:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/doodle/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Doodle idle breathing and soft tail wag loop.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Doodle walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/doodle/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "doodle:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/doodle/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Doodle standing-source walking-in-place loop for live Avatar Studio preview.",
      },
    },
  },
  husky: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Husky live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/husky/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "husky:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/husky/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Husky/Spitz idle breathing and soft tail wag loop.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Husky walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/husky/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "husky:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/husky/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Husky/Spitz walking-in-place loop for live Avatar Studio preview.",
      },
    },
  },
  hound: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Hound live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/hound/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "hound:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/hound/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Hound idle breathing with soft ear and tail motion.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Hound walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/hound/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "hound:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/hound/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Hound standing-source side-view walk loop for live Avatar Studio preview.",
      },
    },
  },
  retriever: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Retriever live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/retriever/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "retriever:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/retriever/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Retriever idle breathing and soft tail wag loop.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Retriever walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/retriever/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "retriever:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/retriever/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Retriever walk loop for live Avatar Studio preview.",
      },
    },
  },
  terrier: {
    "idle-tail-wag": {
      action: "idle-tail-wag",
      label: "Terrier live idle",
      asset: spriteAsset(
        require("@/assets/avatar/templates/terrier/sprites/idle-tail-wag-strip.png"),
      ),
      track: {
        key: "terrier:idle-tail-wag",
        frameCount: 8,
        fps: 7,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/terrier/sprites/idle-tail-wag-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Terrier idle breathing and tiny tail/body wiggle loop.",
      },
    },
    "walk-loop": {
      action: "walk-loop",
      label: "Terrier walk loop",
      asset: spriteAsset(
        require("@/assets/avatar/templates/terrier/sprites/walk-loop-strip.png"),
      ),
      track: {
        key: "terrier:walk-loop",
        frameCount: 8,
        fps: 9,
        loop: true,
        slotSize: 256,
        requiredAsset: "assets/avatar/templates/terrier/sprites/walk-loop-strip.png",
        anchor: "bottom-center",
        notes: "Subscription-backed PixelLab Terrier standing-source trot loop for live Avatar Studio preview.",
      },
    },
  },
};

export function mapAvatarEmoteToTemplateSpriteAction(
  templateId: AvatarTemplateId,
  emote: AvatarEmoteState,
): AvatarTemplateSpriteAction | null {
  if (!AVATAR_TEMPLATE_SPRITE_ASSETS[templateId]) return null;
  switch (emote) {
    case "happy":
    case "calm":
    case "proud":
      return "idle-tail-wag";
    case "excited":
    case "bored":
      return "walk-loop";
    default:
      return null;
  }
}

export function getAvatarTemplateSpritePreview(
  templateId: AvatarTemplateId,
  emote: AvatarEmoteState,
): AvatarTemplateSpritePackItem | null {
  const action = mapAvatarEmoteToTemplateSpriteAction(templateId, emote);
  if (!action) return null;
  return AVATAR_TEMPLATE_SPRITE_ASSETS[templateId]?.[action] ?? null;
}

export function hasAvatarTemplateSpritePack(templateId: AvatarTemplateId): boolean {
  const pack = AVATAR_TEMPLATE_SPRITE_ASSETS[templateId];
  return Boolean(pack?.["idle-tail-wag"] && pack?.["walk-loop"]);
}

export function listAvatarTemplateSpriteSlots(): AvatarTemplateSpritePackItem[] {
  return Object.values(AVATAR_TEMPLATE_SPRITE_ASSETS).flatMap((pack) => Object.values(pack ?? {}));
}
