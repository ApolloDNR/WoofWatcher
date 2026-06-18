import {
  AVATAR_ACCESSORIES,
  type AvatarTemplateId,
  type AvatarAccessoryOption,
  type AvatarAccessorySlots,
  type AvatarEmoteState,
  type PetAvatarConfig,
} from "./avatarStudio.ts";
import type { CareTwinSpriteAction } from "./avatarLifeEngine.ts";

export type AvatarPreviewLayerKind = "bandana" | "collar" | "hat" | "mask" | "vest" | "bed" | "sparkles";

const LIVE_TEMPLATE_PACKS = new Set<AvatarTemplateId>([
  "bully",
  "dachshund",
  "doodle",
  "hound",
  "husky",
  "retriever",
  "terrier",
]);

export interface AvatarPreviewAccessoryLayer {
  id: string;
  label: string;
  tone: string;
  slot: keyof AvatarAccessorySlots;
  kind: AvatarPreviewLayerKind;
}

export interface AvatarPreviewMoodModel {
  auraColor: string;
  chipColor: string;
  copy: string;
}

export interface AvatarPreviewMotionModel {
  mode: "sprite" | "still";
  label: string;
  spriteAction: CareTwinSpriteAction | null;
}

export function deriveAvatarPreviewAccessories(config: PetAvatarConfig): AvatarPreviewAccessoryLayer[] {
  const activeAccessoryIds = new Set(Object.values(config.accessorySlots).filter(Boolean));

  return AVATAR_ACCESSORIES.filter((item) => activeAccessoryIds.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    tone: item.tone,
    slot: item.slot,
    kind: deriveAccessoryLayerKind(item),
  }));
}

export function deriveAvatarPreviewMood(emote: AvatarEmoteState): AvatarPreviewMoodModel {
  switch (emote) {
    case "happy":
      return { auraColor: "rgba(216,168,82,0.18)", chipColor: "#D8A852", copy: "Tail ready." };
    case "calm":
      return { auraColor: "rgba(109,163,111,0.18)", chipColor: "#6DA36F", copy: "Steady and settled." };
    case "excited":
      return { auraColor: "rgba(224,122,47,0.2)", chipColor: "#E07A2F", copy: "Adventure mode." };
    case "bored":
      return { auraColor: "rgba(142,122,99,0.18)", chipColor: "#8E7A63", copy: "Needs a new cue." };
    case "hungry":
      return { auraColor: "rgba(201,144,82,0.2)", chipColor: "#C99052", copy: "Bowl on the mind." };
    case "anxious":
      return { auraColor: "rgba(168,203,232,0.22)", chipColor: "#A8CBE8", copy: "Stay close with me." };
    case "sleepy":
      return { auraColor: "rgba(109,163,111,0.16)", chipColor: "#6DA36F", copy: "Ready for rest." };
    case "proud":
      return { auraColor: "rgba(201,99,88,0.16)", chipColor: "#C96358", copy: "That was a good one." };
    case "home_alone":
      return { auraColor: "rgba(168,203,232,0.2)", chipColor: "#7DA4C7", copy: "Waiting by the door." };
    case "not_feeling_well":
      return { auraColor: "rgba(201,99,88,0.2)", chipColor: "#C96358", copy: "Take it gentle." };
    default:
      return { auraColor: "rgba(216,168,82,0.18)", chipColor: "#D8A852", copy: "Tail ready." };
  }
}

export function deriveAvatarPreviewMotion(
  templateId: AvatarTemplateId,
  emote: AvatarEmoteState,
): AvatarPreviewMotionModel {
  if (templateId !== "shepherd") {
    if (LIVE_TEMPLATE_PACKS.has(templateId)) {
      return {
        mode: "sprite",
        label: "Live template sprite pack",
        spriteAction: null,
      };
    }

    return {
      mode: "still",
      label: "Starter still preview",
      spriteAction: null,
    };
  }

  return {
    mode: "sprite",
    label: "Animated Phoenix pack",
    spriteAction: mapPreviewEmoteToSpriteAction(emote),
  };
}

function deriveAccessoryLayerKind(item: AvatarAccessoryOption): AvatarPreviewLayerKind {
  if (item.id.includes("bandana")) return "bandana";
  if (item.id.includes("collar")) return "collar";
  if (item.id.includes("hat")) return "hat";
  if (item.id.includes("mask")) return "mask";
  if (item.id.includes("vest")) return "vest";
  if (item.id.includes("bed")) return "bed";
  return "sparkles";
}

function mapPreviewEmoteToSpriteAction(emote: AvatarEmoteState): CareTwinSpriteAction {
  switch (emote) {
    case "happy":
    case "calm":
      return "tail-wag";
    case "excited":
    case "proud":
      return "celebrate-hop";
    case "bored":
      return "ear-perk";
    case "hungry":
      return "eat-loop";
    case "anxious":
    case "home_alone":
      return "comfort-loop";
    case "sleepy":
      return "sleep-loop";
    case "not_feeling_well":
      return "health-watch";
    default:
      return "idle-breathe";
  }
}
