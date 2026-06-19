import type { ImageSourcePropType } from "react-native";

import {
  CARE_TWIN_SPRITE_MANIFEST,
  type CareTwinSpriteAction,
} from "./avatarLifeEngine.ts";
import {
  getCareTwinSpriteAsset,
  type CareTwinSpriteAsset,
} from "./careTwinAssets.ts";
import type { AvatarTemplateId } from "./avatarStudio.ts";

export type AvatarTemplateSpriteAction = Extract<
  CareTwinSpriteAction,
  "tail-wag" | "ear-perk" | "eat-loop" | "sleep-loop" | "comfort-loop" | "celebrate-hop" | "health-watch"
>;

export interface AvatarTemplateSpriteAsset extends CareTwinSpriteAsset {
  path: string;
}

export interface AvatarTemplateSpriteSlot {
  action: AvatarTemplateSpriteAction;
  expectedPath: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  assetReady: boolean;
}

const AVATAR_TEMPLATE_PREVIEW_ACTIONS: readonly AvatarTemplateSpriteAction[] = [
  "tail-wag",
  "ear-perk",
  "eat-loop",
  "sleep-loop",
  "comfort-loop",
  "celebrate-hop",
  "health-watch",
];

function bundledAsset(path: string, source: () => ImageSourcePropType): ImageSourcePropType {
  return typeof require === "function" ? source() : { uri: path };
}

function createTemplateStripAsset(
  path: string,
  source: () => ImageSourcePropType,
  action: AvatarTemplateSpriteAction,
): AvatarTemplateSpriteAsset {
  const track = CARE_TWIN_SPRITE_MANIFEST[action];

  return {
    source: bundledAsset(path, source),
    path,
    columns: track.frameCount,
    rows: 1,
    frameWidth: track.slotSize,
    frameHeight: track.slotSize,
  };
}

export const AVATAR_TEMPLATE_SPRITE_ASSETS: Partial<
  Record<AvatarTemplateId, Partial<Record<AvatarTemplateSpriteAction, AvatarTemplateSpriteAsset>>>
> = {
  retriever: {
    "tail-wag": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/tail-wag-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/tail-wag-strip.png"),
      "tail-wag",
    ),
    "ear-perk": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/ear-perk-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/ear-perk-strip.png"),
      "ear-perk",
    ),
    "eat-loop": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/eat-loop-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/eat-loop-strip.png"),
      "eat-loop",
    ),
    "sleep-loop": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/sleep-loop-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/sleep-loop-strip.png"),
      "sleep-loop",
    ),
    "comfort-loop": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/comfort-loop-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/comfort-loop-strip.png"),
      "comfort-loop",
    ),
    "celebrate-hop": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/celebrate-hop-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/celebrate-hop-strip.png"),
      "celebrate-hop",
    ),
    "health-watch": createTemplateStripAsset(
      "assets/avatar/templates/retriever/sprites/health-watch-strip.png",
      () => require("@/assets/avatar/templates/retriever/sprites/health-watch-strip.png"),
      "health-watch",
    ),
  },
  husky: {
    "tail-wag": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/tail-wag-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/tail-wag-strip.png"),
      "tail-wag",
    ),
    "ear-perk": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/ear-perk-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/ear-perk-strip.png"),
      "ear-perk",
    ),
    "eat-loop": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/eat-loop-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/eat-loop-strip.png"),
      "eat-loop",
    ),
    "sleep-loop": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/sleep-loop-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/sleep-loop-strip.png"),
      "sleep-loop",
    ),
    "comfort-loop": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/comfort-loop-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/comfort-loop-strip.png"),
      "comfort-loop",
    ),
    "celebrate-hop": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/celebrate-hop-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/celebrate-hop-strip.png"),
      "celebrate-hop",
    ),
    "health-watch": createTemplateStripAsset(
      "assets/avatar/templates/husky/sprites/health-watch-strip.png",
      () => require("@/assets/avatar/templates/husky/sprites/health-watch-strip.png"),
      "health-watch",
    ),
  },
  doodle: {
    "tail-wag": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/tail-wag-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/tail-wag-strip.png"),
      "tail-wag",
    ),
    "ear-perk": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/ear-perk-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/ear-perk-strip.png"),
      "ear-perk",
    ),
    "eat-loop": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/eat-loop-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/eat-loop-strip.png"),
      "eat-loop",
    ),
    "sleep-loop": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/sleep-loop-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/sleep-loop-strip.png"),
      "sleep-loop",
    ),
    "comfort-loop": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/comfort-loop-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/comfort-loop-strip.png"),
      "comfort-loop",
    ),
    "celebrate-hop": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/celebrate-hop-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/celebrate-hop-strip.png"),
      "celebrate-hop",
    ),
    "health-watch": createTemplateStripAsset(
      "assets/avatar/templates/doodle/sprites/health-watch-strip.png",
      () => require("@/assets/avatar/templates/doodle/sprites/health-watch-strip.png"),
      "health-watch",
    ),
  },
};

export function getAvatarTemplateSpriteAsset(
  templateId: AvatarTemplateId,
  action: CareTwinSpriteAction,
): CareTwinSpriteAsset | null {
  if (templateId === "shepherd") {
    return getCareTwinSpriteAsset(action);
  }

  return AVATAR_TEMPLATE_SPRITE_ASSETS[templateId]?.[action as AvatarTemplateSpriteAction] ?? null;
}

export function listAvatarTemplateSpriteSlots(templateId: AvatarTemplateId): AvatarTemplateSpriteSlot[] {
  return AVATAR_TEMPLATE_PREVIEW_ACTIONS.map((action) => {
    const asset =
      templateId === "shepherd"
        ? getCareTwinSpriteAsset(action)
        : AVATAR_TEMPLATE_SPRITE_ASSETS[templateId]?.[action];
    const expectedPath =
      templateId === "shepherd"
        ? CARE_TWIN_SPRITE_MANIFEST[action].requiredAsset
        : `assets/avatar/templates/${templateId}/sprites/${action}-strip.png`;

    return {
      action,
      expectedPath,
      frameCount: CARE_TWIN_SPRITE_MANIFEST[action].frameCount,
      fps: CARE_TWIN_SPRITE_MANIFEST[action].fps,
      loop: CARE_TWIN_SPRITE_MANIFEST[action].loop,
      assetReady: Boolean(asset),
    };
  });
}
