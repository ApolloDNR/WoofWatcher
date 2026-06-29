import type { ImageSourcePropType } from "react-native";

import type { SpriteSheetTrack } from "@/components/SpriteSheetPlayer";
import {
  type AvatarPreviewAccessoryLayer,
  deriveAvatarPreviewAccessories,
} from "./avatarPreviewModel.ts";
import {
  getAvatarTemplate,
  type AvatarAccessorySlots,
  type AvatarTemplateId,
  type PetAvatarConfig,
} from "./avatarStudio.ts";
import { getAvatarTemplateAccessorySource } from "./avatarTemplateAssets.ts";
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

export interface AvatarRoomAccessoryLayer extends AvatarPreviewAccessoryLayer {
  source: ImageSourcePropType | undefined;
}

export interface AvatarRoomRuntime {
  templateId: AvatarTemplateId;
  templateLabel: string;
  spriteMode: AvatarRoomSpriteMode;
  spriteLabel: string;
  spriteAsset: CareTwinSpriteAsset | null;
  spriteTrack: SpriteSheetTrack & { key: string };
  templateSpriteAction: AvatarTemplateSpriteAction | null;
  overlayLayers: AvatarRoomAccessoryLayer[];
  underlayLayers: AvatarRoomAccessoryLayer[];
  activeSlots: (keyof AvatarAccessorySlots)[];
}

const TEMPLATE_WALK_ACTIONS = new Set<CareTwinSpriteAction>([
  "walk-loop",
  "celebrate-hop",
  "bark-loop",
]);

function mapRuntimeActionToTemplateAction(
  action: CareTwinSpriteAction,
): AvatarTemplateSpriteAction {
  return TEMPLATE_WALK_ACTIONS.has(action) ? "walk-loop" : "idle-tail-wag";
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
    return {
      templateId: config.templateId,
      templateLabel: template.label,
      spriteMode: "template-idle-walk-pack",
      spriteLabel: templateSprite.label,
      spriteAsset: templateSprite.asset,
      spriteTrack: templateSprite.track,
      templateSpriteAction: templateAction,
      overlayLayers,
      underlayLayers,
      activeSlots: accessoryLayers.map((layer) => layer.slot),
    };
  }

  return {
    templateId: config.templateId,
    templateLabel: template.label,
    spriteMode: "phoenix-action-pack",
    spriteLabel: CARE_TWIN_SPRITE_MANIFEST[action].notes,
    spriteAsset: getCareTwinSpriteAsset(action),
    spriteTrack: CARE_TWIN_SPRITE_MANIFEST[action],
    templateSpriteAction: null,
    overlayLayers,
    underlayLayers,
    activeSlots: accessoryLayers.map((layer) => layer.slot),
  };
}
