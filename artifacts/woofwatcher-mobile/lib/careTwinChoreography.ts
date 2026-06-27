import {
  CARE_TWIN_SPRITE_MANIFEST,
  type AvatarLifePlan,
  type CareTwinSpriteAction,
} from "./avatarLifeEngine.ts";

export type CareTwinChoreographyRole = "primary" | "ambient" | "tap-reaction";

export interface CareTwinChoreographyStep {
  role: CareTwinChoreographyRole;
  action: CareTwinSpriteAction;
  label: string;
  durationMs: number;
  cadenceMs?: number;
  chance?: number;
  qaHint: string;
}

export interface CareTwinChoreography {
  primary: CareTwinChoreographyStep;
  ambient: CareTwinChoreographyStep[];
  tapReaction: CareTwinChoreographyStep;
  ambientCadenceMs: number | null;
  reactionDurationMs: number;
  qaSummary: string;
}

export interface CareTwinMotionRecipe {
  action: CareTwinSpriteAction;
  bodyBobPx: number;
  bodySwayPx: number;
  tiltDeg: number;
  scalePulse: number;
  shadowScalePulse: number;
  shadowOpacityPulse: number;
  qaHint: string;
}

const MOTION_RECIPES: Record<CareTwinSpriteAction, CareTwinMotionRecipe> = {
  "idle-breathe": {
    action: "idle-breathe",
    bodyBobPx: 1.4,
    bodySwayPx: 0.45,
    tiltDeg: 0.16,
    scalePulse: 0.72,
    shadowScalePulse: 0.04,
    shadowOpacityPulse: 0.05,
    qaHint: "Slow body breathing keeps the single care twin alive while paws stay grounded.",
  },
  "tail-wag": {
    action: "tail-wag",
    bodyBobPx: 1.8,
    bodySwayPx: 1.15,
    tiltDeg: 0.32,
    scalePulse: 0.84,
    shadowScalePulse: 0.06,
    shadowOpacityPulse: 0.07,
    qaHint: "Happy idle uses a readable body sway and tail-wag pulse on the main Phoenix sprite.",
  },
  "ear-perk": {
    action: "ear-perk",
    bodyBobPx: 1,
    bodySwayPx: 0.55,
    tiltDeg: 0.22,
    scalePulse: 0.58,
    shadowScalePulse: 0.04,
    shadowOpacityPulse: 0.05,
    qaHint: "Attention cues stay small and alert without replacing the main dog.",
  },
  "walk-loop": {
    action: "walk-loop",
    bodyBobPx: 2.8,
    bodySwayPx: 7.8,
    tiltDeg: 1.15,
    scalePulse: 0.5,
    shadowScalePulse: 0.11,
    shadowOpacityPulse: 0.09,
    qaHint: "Walk states add side-to-side travel and footfall bob on the single sprite rig.",
  },
  "eat-loop": {
    action: "eat-loop",
    bodyBobPx: 1.2,
    bodySwayPx: 0.35,
    tiltDeg: 0.34,
    scalePulse: 0.5,
    shadowScalePulse: 0.04,
    shadowOpacityPulse: 0.05,
    qaHint: "Meal states keep Phoenix anchored at the bowl with a tiny chew bob.",
  },
  "drink-loop": {
    action: "drink-loop",
    bodyBobPx: 1.1,
    bodySwayPx: 0.3,
    tiltDeg: 0.28,
    scalePulse: 0.48,
    shadowScalePulse: 0.04,
    shadowOpacityPulse: 0.05,
    qaHint: "Hydration states keep Phoenix anchored at the bowl with a gentle lap rhythm.",
  },
  "sleep-loop": {
    action: "sleep-loop",
    bodyBobPx: 0.35,
    bodySwayPx: 0.12,
    tiltDeg: 0.04,
    scalePulse: 0.34,
    shadowScalePulse: 0.02,
    shadowOpacityPulse: 0.03,
    qaHint: "Sleep uses the quietest breathing recipe so the room stays calm.",
  },
  "comfort-loop": {
    action: "comfort-loop",
    bodyBobPx: 0.75,
    bodySwayPx: 0.25,
    tiltDeg: 0.12,
    scalePulse: 0.42,
    shadowScalePulse: 0.03,
    shadowOpacityPulse: 0.04,
    qaHint: "Comfort stays low-motion and reassuring without diagnostic drama.",
  },
  "celebrate-hop": {
    action: "celebrate-hop",
    bodyBobPx: 6.5,
    bodySwayPx: 2.4,
    tiltDeg: 1.45,
    scalePulse: 1.05,
    shadowScalePulse: 0.14,
    shadowOpacityPulse: 0.11,
    qaHint: "Care wins use a short hop and stronger shadow pulse tied to real care only.",
  },
  "health-watch": {
    action: "health-watch",
    bodyBobPx: 0.6,
    bodySwayPx: 0.18,
    tiltDeg: 0.08,
    scalePulse: 0.38,
    shadowScalePulse: 0.025,
    shadowOpacityPulse: 0.035,
    qaHint: "Health Watch stays calm and low-motion so it never feels like a diagnosis.",
  },
  "bark-loop": {
    action: "bark-loop",
    bodyBobPx: 3,
    bodySwayPx: 1.4,
    tiltDeg: 1.1,
    scalePulse: 0.82,
    shadowScalePulse: 0.09,
    shadowOpacityPulse: 0.08,
    qaHint: "Tap reactions animate the same Phoenix sprite instead of adding another avatar.",
  },
};

function formatAction(action: CareTwinSpriteAction): string {
  return action.replace(/-loop$/, "").replace(/-hop$/, " hop").replace(/-/g, " ");
}

export function motionRecipeForSpriteAction(action: CareTwinSpriteAction): CareTwinMotionRecipe {
  return MOTION_RECIPES[action];
}

function durationFor(action: CareTwinSpriteAction): number {
  const track = CARE_TWIN_SPRITE_MANIFEST[action];
  return Math.max(650, Math.round((track.frameCount / Math.max(1, track.fps)) * 1000));
}

function step(
  role: CareTwinChoreographyRole,
  action: CareTwinSpriteAction,
  qaHint: string,
  cadenceMs?: number,
  label?: string,
  chance?: number,
): CareTwinChoreographyStep {
  return {
    role,
    action,
    label: label ?? `${role === "primary" ? "Primary" : role === "ambient" ? "Ambient" : "Tap"} ${formatAction(action)}`,
    durationMs: durationFor(action),
    cadenceMs,
    chance,
    qaHint,
  };
}

function tapReactionFor(plan: AvatarLifePlan): CareTwinSpriteAction {
  if (plan.scenePhase === "rest") return "ear-perk";
  if (plan.priorityNeed === "health" || plan.spriteAction === "health-watch") return "comfort-loop";
  if (plan.scenePhase === "celebration") return "celebrate-hop";
  return "bark-loop";
}

function qaSummaryFor(
  plan: AvatarLifePlan,
  primary: CareTwinChoreographyStep,
  ambient: readonly CareTwinChoreographyStep[],
  tapReaction: CareTwinChoreographyStep,
): string {
  if (plan.scenePhase === "rest") {
    return `Rest suppresses awake ambient swaps; ${primary.label.toLowerCase()} stays anchored and taps use ${formatAction(tapReaction.action)}.`;
  }

  if (plan.priorityNeed === "health") {
    return `Health Watch uses ${formatAction(primary.action)} as the primary loop with a calm ${formatAction(tapReaction.action)} tap response.`;
  }

  const ambientSummary = ambient.length
    ? `ambient ${ambient.map((item) => formatAction(item.action)).join(", ")}`
    : "no ambient swaps";

  return `${primary.label} leads; ${ambientSummary}; tap reaction ${formatAction(tapReaction.action)}.`;
}

export function deriveCareTwinChoreography(plan: AvatarLifePlan): CareTwinChoreography {
  const primary = step(
    "primary",
    plan.spriteAction,
    `${plan.activityLabel} should read clearly in the ${plan.zoneLabel.toLowerCase()} zone.`,
  );

  const ambient = plan.scenePhase === "rest"
    ? []
    : plan.idleBehaviors
        .filter((behavior) => behavior.action !== plan.spriteAction)
        .map((behavior) =>
          step(
            "ambient",
            behavior.action,
            `Use as a subtle micro-loop after ${Math.round(behavior.everyMs / 1000)}s without replacing the main care state.`,
            behavior.everyMs,
            undefined,
            behavior.chance,
          ),
        );

  const tapAction = tapReactionFor(plan);
  const tapReaction = step(
    "tap-reaction",
    tapAction,
    tapAction === "bark-loop"
      ? "Use for playful attention only; never spawn a second dog."
      : "Use as a state-aware response so sleeping, comfort, and health-watch states stay gentle.",
    undefined,
    tapAction === "ear-perk" ? "Soft check-in" : undefined,
  );

  return {
    primary,
    ambient,
    tapReaction,
    ambientCadenceMs: ambient.length ? Math.min(...ambient.map((item) => item.cadenceMs ?? item.durationMs)) : null,
    reactionDurationMs: Math.min(1800, Math.max(900, tapReaction.durationMs + 420)),
    qaSummary: qaSummaryFor(plan, primary, ambient, tapReaction),
  };
}
