import type { ImageSourcePropType } from "react-native";

import type { SpriteSheetTrack } from "@/components/SpriteSheetPlayer";
import {
  type AvatarPreviewAccessoryLayer,
  deriveAvatarPreviewAccessories,
} from "./avatarPreviewModel.ts";
import {
  getAvatarTemplate,
  type AvatarAccessorySlots,
  type AvatarEmoteState,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "./avatarStudio.ts";
import {
  getAvatarTemplateBaseAsset,
  getAvatarTemplateAccessorySource,
  getAvatarTemplateEmoteAsset,
  type AvatarTemplateBaseAsset,
  type AvatarTemplateEmoteAsset,
} from "./avatarTemplateAssets.ts";
import {
  AVATAR_TEMPLATE_SPRITE_ASSETS,
  type AvatarTemplateSpriteAction,
} from "./avatarTemplateSpriteAssets.ts";
import {
  CARE_TWIN_SPRITE_MANIFEST,
  type CareTwinSpriteAction,
} from "./avatarLifeEngine.ts";
import {
  getCareTwinSpriteAsset,
  type CareTwinSpriteAsset,
} from "./careTwinAssets.ts";

export type AvatarRoomSpriteMode =
  | "phoenix-action-pack"
  | "template-idle-walk-pack";

/**
 * Template packs currently ship idle and walk strips.  A static fallback is
 * deliberately preferable to playing a tail-wag or walk loop that claims to
 * depict a meal, rest, or Health Watch state it does not actually depict.
 */
export type AvatarRoomMotionFidelity = "exact" | "static-fallback";

export interface AvatarRoomAccessoryLayer extends AvatarPreviewAccessoryLayer {
  source: ImageSourcePropType | undefined;
}

export type AvatarRoomStaticPoseAsset =
  | AvatarTemplateBaseAsset
  | AvatarTemplateEmoteAsset;

export interface AvatarRoomRuntime {
  templateId: AvatarTemplateId;
  templateLabel: string;
  spriteMode: AvatarRoomSpriteMode;
  motionFidelity: AvatarRoomMotionFidelity;
  spriteLabel: string;
  spriteAsset: CareTwinSpriteAsset | null;
  spriteTrack: SpriteSheetTrack & { key: string };
  templateSpriteAction: AvatarTemplateSpriteAction | null;
  staticPoseEmote: AvatarEmoteState | null;
  staticPoseAsset: AvatarRoomStaticPoseAsset | null;
  overlayLayers: AvatarRoomAccessoryLayer[];
  underlayLayers: AvatarRoomAccessoryLayer[];
  activeSlots: (keyof AvatarAccessorySlots)[];
}

const TEMPLATE_WALK_ACTIONS = new Set<CareTwinSpriteAction>(["walk-loop"]);

const TEMPLATE_EXACT_ACTIONS = new Set<CareTwinSpriteAction>([
  "idle-breathe",
  "tail-wag",
  "walk-loop",
]);

function mapRuntimeActionToTemplateAction(
  action: CareTwinSpriteAction,
): AvatarTemplateSpriteAction {
  return TEMPLATE_WALK_ACTIONS.has(action) ? "walk-loop" : "idle-tail-wag";
}

function staticPoseEmoteForAction(
  action: CareTwinSpriteAction,
): AvatarEmoteState | null {
  switch (action) {
    case "ear-perk": return "hungry";
    case "eat-loop": return "happy";
    case "drink-loop": return "calm";
    case "sleep-loop": return "sleepy";
    case "comfort-loop": return "anxious";
    case "celebrate-hop": return "proud";
    case "health-watch": return "not_feeling_well";
    case "bark-loop": return "excited";
    default: return null;
  }
}

function fittedTemplateLayers(
  config: PetAvatarConfig,
): AvatarRoomAccessoryLayer[] {
  return deriveAvatarPreviewAccessories(config)
    .map((layer) => ({
      ...layer,
      source: getAvatarTemplateAccessorySource(config.templateId, layer.id),
    }))
    .filter((layer) => Boolean(layer.source));
}

export function deriveAvatarRoomRuntime(
  config: PetAvatarConfig,
  action: CareTwinSpriteAction,
): AvatarRoomRuntime {
  const template = getAvatarTemplate(config.templateId);
  const templateAction = mapRuntimeActionToTemplateAction(action);
  const templateSprite =
    config.templateId === "shepherd"
      ? null
      : (AVATAR_TEMPLATE_SPRITE_ASSETS[config.templateId]?.[templateAction] ??
        null);
  const accessoryLayers = fittedTemplateLayers(config);
  const underlayLayers = accessoryLayers.filter(
    (layer) => layer.slot === "room",
  );
  const overlayLayers = accessoryLayers.filter(
    (layer) => layer.slot !== "room",
  );

  if (templateSprite) {
    const motionFidelity = TEMPLATE_EXACT_ACTIONS.has(action)
      ? "exact"
      : "static-fallback";
    const staticPoseEmote =
      motionFidelity === "static-fallback" ? staticPoseEmoteForAction(action) : null;
    const staticPoseAsset = staticPoseEmote
      ? (getAvatarTemplateEmoteAsset(config.templateId, staticPoseEmote) ??
        getAvatarTemplateBaseAsset(config.templateId) ??
        null)
      : null;
    return {
      templateId: config.templateId,
      templateLabel: template.label,
      spriteMode: "template-idle-walk-pack",
      motionFidelity,
      spriteLabel: templateSprite.label,
      spriteAsset: templateSprite.asset,
      spriteTrack: templateSprite.track,
      templateSpriteAction: templateAction,
      staticPoseEmote,
      staticPoseAsset,
      overlayLayers,
      underlayLayers,
      activeSlots: accessoryLayers.map((layer) => layer.slot),
    };
  }

  return {
    templateId: config.templateId,
    templateLabel: template.label,
    spriteMode: "phoenix-action-pack",
    motionFidelity: "exact",
    spriteLabel: CARE_TWIN_SPRITE_MANIFEST[action].notes,
    spriteAsset: getCareTwinSpriteAsset(action),
    spriteTrack: CARE_TWIN_SPRITE_MANIFEST[action],
    templateSpriteAction: null,
    staticPoseEmote: null,
    staticPoseAsset: null,
    overlayLayers,
    underlayLayers,
    activeSlots: accessoryLayers.map((layer) => layer.slot),
  };
}
