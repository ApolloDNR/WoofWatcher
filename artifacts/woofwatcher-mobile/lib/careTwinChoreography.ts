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

function formatAction(action: CareTwinSpriteAction): string {
  return action.replace(/-loop$/, "").replace(/-hop$/, " hop").replace(/-/g, " ");
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
