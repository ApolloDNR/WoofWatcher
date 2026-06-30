import {
  AVATAR_ACCESSORIES,
  type AvatarTemplateId,
  type AvatarAccessoryOption,
  type AvatarAccessoryFitStatus,
  type AvatarAccessorySlots,
  type AvatarEmoteState,
  type PetAvatarConfig,
  deriveAvatarAccessoryFit,
} from "./avatarStudio.ts";
import type { CareTwinSpriteAction } from "./avatarLifeEngine.ts";
import type { AvatarTemplateSpriteAction } from "./avatarTemplateSpriteAssets.ts";

export type AvatarPreviewLayerKind = "bandana" | "collar" | "hat" | "mask" | "vest" | "bed" | "sparkles";

const LIVE_TEMPLATE_PACKS = new Set<AvatarTemplateId>([
  "bully",
  "dachshund",
  "doodle",
  "hound",
  "husky",
  "mixed",
  "retriever",
  "slender",
  "spaniel",
  "terrier",
  "toy",
]);

export interface AvatarPreviewAccessoryLayer {
  id: string;
  label: string;
  tone: string;
  slot: keyof AvatarAccessorySlots;
  kind: AvatarPreviewLayerKind;
  fitStatus: AvatarAccessoryFitStatus;
  fitLabel: string;
  fitDetail: string;
  placementHint: string;
  needsDeviceQa: boolean;
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

export type AvatarStudioMotionPreviewId =
  | "idle"
  | "walk"
  | "meal"
  | "water"
  | "rest"
  | "comfort"
  | "health"
  | "celebrate";

export interface AvatarStudioMotionPreviewState {
  id: AvatarStudioMotionPreviewId;
  label: string;
  detail: string;
  statusLabel: string;
  emote: AvatarEmoteState;
  spriteAction: CareTwinSpriteAction;
  templateSpriteAction: AvatarTemplateSpriteAction;
  accessibilityLabel: string;
}

const AVATAR_STUDIO_MOTION_PREVIEW_STATES: readonly AvatarStudioMotionPreviewState[] = [
  {
    id: "idle",
    label: "Idle",
    detail: "Breathing and tail life for the default room state.",
    statusLabel: "Breathing",
    emote: "calm",
    spriteAction: "idle-breathe",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview idle breathing animation",
  },
  {
    id: "walk",
    label: "Walk",
    detail: "Side-view gait loop for walks, quests, and active routines.",
    statusLabel: "Gait loop",
    emote: "excited",
    spriteAction: "walk-loop",
    templateSpriteAction: "walk-loop",
    accessibilityLabel: "Preview walk animation",
  },
  {
    id: "meal",
    label: "Meal",
    detail: "Bowl-facing loop for meals served, grazing, and food outcomes.",
    statusLabel: "Bowl loop",
    emote: "hungry",
    spriteAction: "eat-loop",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview meal animation",
  },
  {
    id: "water",
    label: "Water",
    detail: "Hydration loop for water reminders and care confirmations.",
    statusLabel: "Hydration",
    emote: "calm",
    spriteAction: "drink-loop",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview water animation",
  },
  {
    id: "rest",
    label: "Rest",
    detail: "Settled sleep loop for bedtime, alone time, and recovery.",
    statusLabel: "Sleep loop",
    emote: "sleepy",
    spriteAction: "sleep-loop",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview rest animation",
  },
  {
    id: "comfort",
    label: "Comfort",
    detail: "Gentle loop for anxious, home-alone, or reassurance moments.",
    statusLabel: "Comfort",
    emote: "home_alone",
    spriteAction: "comfort-loop",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview comfort animation",
  },
  {
    id: "health",
    label: "Health",
    detail: "Low-posture health-watch loop for careful, non-diagnostic follow-up.",
    statusLabel: "Health watch",
    emote: "not_feeling_well",
    spriteAction: "health-watch",
    templateSpriteAction: "idle-tail-wag",
    accessibilityLabel: "Preview health watch animation",
  },
  {
    id: "celebrate",
    label: "Celebrate",
    detail: "Reward beat for care complete, training wins, and level ups.",
    statusLabel: "Reward",
    emote: "proud",
    spriteAction: "celebrate-hop",
    templateSpriteAction: "walk-loop",
    accessibilityLabel: "Preview celebration animation",
  },
];

export function listAvatarStudioMotionPreviewStates(): readonly AvatarStudioMotionPreviewState[] {
  return AVATAR_STUDIO_MOTION_PREVIEW_STATES;
}

export function getAvatarStudioMotionPreviewState(
  id: AvatarStudioMotionPreviewId,
): AvatarStudioMotionPreviewState {
  return (
    AVATAR_STUDIO_MOTION_PREVIEW_STATES.find((state) => state.id === id) ??
    AVATAR_STUDIO_MOTION_PREVIEW_STATES[0]
  );
}

export function deriveAvatarPreviewAccessories(config: PetAvatarConfig): AvatarPreviewAccessoryLayer[] {
  const activeAccessoryIds = new Set(Object.values(config.accessorySlots).filter(Boolean));

  return AVATAR_ACCESSORIES.filter((item) => activeAccessoryIds.has(item.id)).map((item) => {
    const fit = deriveAvatarAccessoryFit(config.templateId, item);

    return {
      id: item.id,
      label: item.label,
      tone: item.tone,
      slot: item.slot,
      kind: deriveAccessoryLayerKind(item),
      fitStatus: fit.status,
      fitLabel: fit.label,
      fitDetail: fit.detail,
      placementHint: fit.placementHint,
      needsDeviceQa: fit.needsDeviceQa,
    };
  });
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
