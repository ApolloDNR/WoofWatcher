import type { AvatarMotionModel, AvatarMotionState } from "./avatarMotion";

export type AvatarRoomZone = "rug" | "door" | "bowl" | "bed" | "window";
export type AvatarLifeAnimation = "idle" | "walk" | "eat" | "drink" | "sleep" | "comfort" | "celebrate";
export type CareTwinScenePhase = "idle" | "routine" | "care-action" | "watch" | "rest" | "celebration";
export type CareTwinNeed = "bond" | "activity" | "hunger" | "hydration" | "rest" | "comfort" | "health";
export type CareTwinHudTone = "steady" | "happy" | "urgent" | "soft" | "reward";
export type CareTwinSpriteAction =
  | "idle-breathe"
  | "tail-wag"
  | "ear-perk"
  | "walk-loop"
  | "eat-loop"
  | "drink-loop"
  | "sleep-loop"
  | "comfort-loop"
  | "celebrate-hop"
  | "health-watch"
  | "bark-loop";

export interface CareTwinSpriteTrack {
  key: CareTwinSpriteAction;
  frameCount: number;
  fps: number;
  loop: boolean;
  anchor: "bottom-center";
  slotSize: 256;
  requiredAsset: string;
  fallbackAnimation: AvatarLifeAnimation;
  notes: string;
}

export interface CareTwinIdleBehavior {
  action: CareTwinSpriteAction;
  everyMs: number;
  chance: number;
}

export interface AvatarLifePlan {
  zone: AvatarRoomZone;
  animation: AvatarLifeAnimation;
  zoneLabel: string;
  activityLabel: string;
  moodLabel: string;
  breathLift: number;
  breathScale: number;
  paceMs: number;
  showHearts: boolean;
  showSleep: boolean;
  showCareAura: boolean;
  scenePhase: CareTwinScenePhase;
  priorityNeed: CareTwinNeed;
  spriteAction: CareTwinSpriteAction;
  spriteTrack: CareTwinSpriteTrack;
  idleBehaviors: readonly CareTwinIdleBehavior[];
  tapVerb: string;
  hudTone: CareTwinHudTone;
  recommendedActionLabel: string;
}

export const CARE_TWIN_SPRITE_MANIFEST: Record<CareTwinSpriteAction, CareTwinSpriteTrack> = {
  "idle-breathe": {
    key: "idle-breathe",
    frameCount: 8,
    fps: 6,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-idle-tail-wag-strip.png",
    fallbackAnimation: "idle",
    notes: "Option B hard-pixel idle proof with subtle breathing/tail movement, stable paws, no scenery, transparent background.",
  },
  "tail-wag": {
    key: "tail-wag",
    frameCount: 8,
    fps: 8,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-idle-tail-wag-strip.png",
    fallbackAnimation: "idle",
    notes: "Option B happy idle loop with readable tail movement and stable head silhouette.",
  },
  "ear-perk": {
    key: "ear-perk",
    frameCount: 6,
    fps: 7,
    loop: false,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-ear-perk-strip.png",
    fallbackAnimation: "idle",
    notes: "Option B alert attention cue for upcoming routines, transparent background, stable bottom-center anchor.",
  },
  "walk-loop": {
    key: "walk-loop",
    frameCount: 8,
    // 12fps over the two-stride strip keeps a natural ~1.5 strides/sec dog
    // cadence; 10fps read as a choppy flipbook.
    fps: 12,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-walk-loop-strip.png",
    fallbackAnimation: "walk",
    notes: "Option B side-profile walk loop, same facing direction as the approved standing source, stable transparent strip.",
  },
  "eat-loop": {
    key: "eat-loop",
    frameCount: 8,
    fps: 7,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-eat-loop-strip.png",
    fallbackAnimation: "eat",
    notes: "Option B bowl-facing chew loop; tiny prop pixels are allowed, no room scenery.",
  },
  "drink-loop": {
    key: "drink-loop",
    frameCount: 8,
    fps: 7,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-drink-loop-strip.png",
    fallbackAnimation: "drink",
    notes: "Option B water-bowl lap loop with transparent background; keep body size stable with eat loop.",
  },
  "sleep-loop": {
    key: "sleep-loop",
    frameCount: 8,
    fps: 5,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-sleep-loop-strip.png",
    fallbackAnimation: "sleep",
    notes: "Option B curled/lying loop with slow breathing and stable bottom-center anchor.",
  },
  "comfort-loop": {
    key: "comfort-loop",
    frameCount: 8,
    fps: 6,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-comfort-loop-strip.png",
    fallbackAnimation: "comfort",
    notes: "Option B soft anxious/low-posture loop on a transparent background without medical certainty or distress exaggeration.",
  },
  "celebrate-hop": {
    key: "celebrate-hop",
    frameCount: 8,
    fps: 9,
    loop: false,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-celebrate-hop-strip.png",
    fallbackAnimation: "celebrate",
    notes: "Option B reward hop for care wins on a transparent background; no coins or fake game economy.",
  },
  "health-watch": {
    key: "health-watch",
    frameCount: 8,
    fps: 5,
    loop: true,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-health-watch-strip.png",
    fallbackAnimation: "comfort",
    notes: "Option B careful low-energy watch state; calm, non-diagnostic presentation.",
  },
  "bark-loop": {
    key: "bark-loop",
    frameCount: 6,
    fps: 10,
    loop: false,
    anchor: "bottom-center",
    slotSize: 256,
    requiredAsset: "assets/avatar/phoenix/storybook/storybook-bark-reaction-strip.png",
    fallbackAnimation: "idle",
    notes: "Option B happy bark/tap reaction with lifted head, open mouth, and stable seated anchor.",
  },
};

const SOFT_IDLE_BEHAVIORS: readonly CareTwinIdleBehavior[] = [
  { action: "idle-breathe", everyMs: 2200, chance: 1 },
  { action: "tail-wag", everyMs: 5200, chance: 0.42 },
  { action: "ear-perk", everyMs: 7400, chance: 0.28 },
];

const REST_IDLE_BEHAVIORS: readonly CareTwinIdleBehavior[] = [
  { action: "idle-breathe", everyMs: 3200, chance: 1 },
];

const WATCH_IDLE_BEHAVIORS: readonly CareTwinIdleBehavior[] = [
  { action: "idle-breathe", everyMs: 3400, chance: 1 },
  { action: "ear-perk", everyMs: 8600, chance: 0.18 },
];

const STATE_PLAN: Record<AvatarMotionState, Omit<AvatarLifePlan, "moodLabel" | "spriteTrack">> = {
  happy: {
    zone: "rug",
    animation: "idle",
    zoneLabel: "On the rug",
    activityLabel: "Tail watch",
    breathLift: 5,
    breathScale: 0.018,
    paceMs: 2800,
    showHearts: true,
    showSleep: false,
    showCareAura: false,
    scenePhase: "idle",
    priorityNeed: "bond",
    spriteAction: "tail-wag",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Pet Phoenix",
    hudTone: "happy",
    recommendedActionLabel: "Keep care moving",
  },
  excited: {
    zone: "door",
    animation: "celebrate",
    zoneLabel: "By the door",
    activityLabel: "Ready to go",
    breathLift: 10,
    breathScale: 0.032,
    paceMs: 1300,
    showHearts: true,
    showSleep: false,
    showCareAura: false,
    scenePhase: "routine",
    priorityNeed: "activity",
    spriteAction: "celebrate-hop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Start the next routine",
    hudTone: "reward",
    recommendedActionLabel: "Start next plan",
  },
  bored: {
    zone: "door",
    animation: "walk",
    zoneLabel: "Watching door",
    activityLabel: "Needs activity",
    breathLift: 7,
    breathScale: 0.022,
    paceMs: 1800,
    showHearts: false,
    showSleep: false,
    showCareAura: false,
    scenePhase: "routine",
    priorityNeed: "activity",
    spriteAction: "walk-loop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Open the routine board",
    hudTone: "steady",
    recommendedActionLabel: "Review activity",
  },
  annoyed: {
    zone: "bowl",
    animation: "comfort",
    zoneLabel: "Needs human",
    activityLabel: "Care due",
    breathLift: 5,
    breathScale: 0.018,
    paceMs: 2100,
    showHearts: false,
    showSleep: false,
    showCareAura: true,
    scenePhase: "routine",
    priorityNeed: "hunger",
    spriteAction: "ear-perk",
    idleBehaviors: WATCH_IDLE_BEHAVIORS,
    tapVerb: "Log the care outcome",
    hudTone: "urgent",
    recommendedActionLabel: "Update routine",
  },
  sad: {
    zone: "window",
    animation: "comfort",
    zoneLabel: "At the window",
    activityLabel: "Needs comfort",
    breathLift: 4,
    breathScale: 0.012,
    paceMs: 3000,
    showHearts: false,
    showSleep: false,
    showCareAura: true,
    scenePhase: "watch",
    priorityNeed: "comfort",
    spriteAction: "comfort-loop",
    idleBehaviors: WATCH_IDLE_BEHAVIORS,
    tapVerb: "Check in",
    hudTone: "soft",
    recommendedActionLabel: "Add a note",
  },
  tired: {
    zone: "bed",
    animation: "sleep",
    zoneLabel: "Resting",
    activityLabel: "Low energy",
    breathLift: 3,
    breathScale: 0.01,
    paceMs: 3600,
    showHearts: false,
    showSleep: true,
    showCareAura: false,
    scenePhase: "rest",
    priorityNeed: "rest",
    spriteAction: "sleep-loop",
    idleBehaviors: REST_IDLE_BEHAVIORS,
    tapVerb: "Let Phoenix rest",
    hudTone: "soft",
    recommendedActionLabel: "Track rest",
  },
  sleeping: {
    zone: "bed",
    animation: "sleep",
    zoneLabel: "In bed",
    activityLabel: "Soft snooze",
    breathLift: 2,
    breathScale: 0.008,
    paceMs: 4200,
    showHearts: false,
    showSleep: true,
    showCareAura: false,
    scenePhase: "rest",
    priorityNeed: "rest",
    spriteAction: "sleep-loop",
    idleBehaviors: REST_IDLE_BEHAVIORS,
    tapVerb: "Keep it calm",
    hudTone: "soft",
    recommendedActionLabel: "Quiet mode",
  },
  eating: {
    zone: "bowl",
    animation: "eat",
    zoneLabel: "At the bowl",
    activityLabel: "Eating",
    breathLift: 4,
    breathScale: 0.018,
    paceMs: 1200,
    showHearts: true,
    showSleep: false,
    showCareAura: false,
    scenePhase: "care-action",
    priorityNeed: "hunger",
    spriteAction: "eat-loop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Update meal outcome",
    hudTone: "happy",
    recommendedActionLabel: "Confirm meal",
  },
  drinking: {
    zone: "bowl",
    animation: "drink",
    zoneLabel: "Water bowl",
    activityLabel: "Hydrating",
    breathLift: 4,
    breathScale: 0.014,
    paceMs: 1300,
    showHearts: false,
    showSleep: false,
    showCareAura: false,
    scenePhase: "care-action",
    priorityNeed: "hydration",
    spriteAction: "drink-loop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Log water context",
    hudTone: "steady",
    recommendedActionLabel: "Track hydration",
  },
  walking: {
    zone: "door",
    animation: "walk",
    zoneLabel: "Door check",
    activityLabel: "Walking",
    breathLift: 9,
    breathScale: 0.028,
    paceMs: 900,
    showHearts: true,
    showSleep: false,
    showCareAura: false,
    scenePhase: "care-action",
    priorityNeed: "activity",
    spriteAction: "walk-loop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Review walk",
    hudTone: "reward",
    recommendedActionLabel: "Save walk notes",
  },
  treat: {
    zone: "rug",
    animation: "celebrate",
    zoneLabel: "On the rug",
    activityLabel: "Treat dance",
    breathLift: 12,
    breathScale: 0.036,
    paceMs: 950,
    showHearts: true,
    showSleep: false,
    showCareAura: false,
    scenePhase: "celebration",
    priorityNeed: "bond",
    spriteAction: "celebrate-hop",
    idleBehaviors: SOFT_IDLE_BEHAVIORS,
    tapVerb: "Celebrate the care win",
    hudTone: "reward",
    recommendedActionLabel: "Great job",
  },
  sick: {
    zone: "bed",
    animation: "comfort",
    zoneLabel: "Care watch",
    activityLabel: "Taking it easy",
    breathLift: 2,
    breathScale: 0.006,
    paceMs: 3600,
    showHearts: false,
    showSleep: false,
    showCareAura: true,
    scenePhase: "watch",
    priorityNeed: "health",
    spriteAction: "health-watch",
    idleBehaviors: WATCH_IDLE_BEHAVIORS,
    tapVerb: "Review Health Watch",
    hudTone: "urgent",
    recommendedActionLabel: "Watch patterns",
  },
};

const MOOD_LABEL: Record<AvatarMotionModel["avatarMood"], string> = {
  happy: "Happy",
  excited: "Excited",
  calm: "Calm",
  anxious: "Anxious",
  unwell: "Not feeling well",
};

function withSpriteTrack(plan: Omit<AvatarLifePlan, "spriteTrack">): AvatarLifePlan {
  return {
    ...plan,
    spriteTrack: CARE_TWIN_SPRITE_MANIFEST[plan.spriteAction],
  };
}

export function deriveCareTwinScene(motion: AvatarMotionModel): AvatarLifePlan {
  const plan = STATE_PLAN[motion.state] ?? STATE_PLAN.happy;

  if (motion.cue === "health-watch") {
    return withSpriteTrack({
      ...STATE_PLAN.sick,
      moodLabel: MOOD_LABEL[motion.avatarMood],
    });
  }

  if (motion.cue === "walk-cycle") {
    return withSpriteTrack({
      ...STATE_PLAN.walking,
      moodLabel: MOOD_LABEL[motion.avatarMood],
    });
  }

  if (motion.cue === "chew") {
    return withSpriteTrack({
      ...STATE_PLAN.eating,
      moodLabel: MOOD_LABEL[motion.avatarMood],
    });
  }

  if (motion.cue === "lap") {
    return withSpriteTrack({
      ...STATE_PLAN.drinking,
      moodLabel: MOOD_LABEL[motion.avatarMood],
    });
  }

  return withSpriteTrack({
    ...plan,
    moodLabel: MOOD_LABEL[motion.avatarMood],
  });
}

export function deriveAvatarLifePlan(motion: AvatarMotionModel): AvatarLifePlan {
  return deriveCareTwinScene(motion);
}
