import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PixelIcon, type PixelIconName } from "@/components/PixelIcon";
import { SpriteSheetPlayer } from "@/components/SpriteSheetPlayer";
import { useColors } from "@/hooks/useColors";
import {
  getCareTwinLayerReadiness,
  getCareTwinRoomLayer,
  getCareTwinSpriteAsset,
} from "@/lib/careTwinAssets";
import { zoneForSpriteAction } from "@/lib/careTwinStage";
import {
  deriveCareTwinChoreography,
  motionRecipeForSpriteAction,
} from "@/lib/careTwinChoreography";
import {
  CARE_TWIN_SPRITE_MANIFEST,
  deriveCareTwinScene,
  type AvatarLifePlan,
  type AvatarRoomZone,
  type CareTwinHudTone,
  type CareTwinSpriteAction,
} from "@/lib/avatarLifeEngine";
import { deriveAvatarRoomRuntime } from "@/lib/avatarRoomRuntime";
import type { PetAvatarConfig } from "@/lib/avatarStudio";
import type { AvatarMotionModel } from "@/lib/avatarMotion";
import {
  careTwinCanRoam,
  deriveCareTwinRoamPlan,
  resolveRoamingTwinSpriteAction,
  type RoamFacing,
  type RoamPlan,
} from "@/lib/careTwinRoam";
import { pixelImageStyle } from "@/lib/pixelRendering";
import type { Mood } from "@/lib/phoenixStatus";

// Constant ink for text on the fixed cream overlay chips/bubbles: the
// overlays keep their light surface in both color schemes, so their text
// must not flip with the theme.
const OVERLAY_INK = "#26221C";
const OVERLAY_MUTED_INK = "#6E6753";

// Dogless room so the dog is ALWAYS the layered sprite (never baked in),
// which keeps the cuter twin consistent and avoids a second dog showing
// behind it in non-transparent stages like Avatar Studio.
const ROOM_SCENE = require("@/assets/avatar/rooms/phoenix-room-storybook-day.png");

const STATE_SCENES: Record<Mood, ImageSourcePropType> = {
  happy: ROOM_SCENE,
  excited: ROOM_SCENE,
  calm: ROOM_SCENE,
  anxious: ROOM_SCENE,
  unwell: ROOM_SCENE,
};

// Storybook German Shepherd stills, matched to the mock-board room art so
// the static fallback layer never breaks the environment's illusion.
const PHOENIX_FALLBACK_AVATARS: Record<Mood, ImageSourcePropType> = {
  happy: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  excited: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  calm: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  anxious: require("@/assets/avatar/phoenix/storybook/storybook-still-sit.png"),
  unwell: require("@/assets/avatar/phoenix/storybook/storybook-still-sleep.png"),
};

export interface PhoenixRoomReaction {
  id: number;
  icon: PixelIconName;
  label: string;
  detail?: string;
  tone?: string;
  spriteAction?: CareTwinSpriteAction;
}

export interface PhoenixRoomStat {
  label: string;
  value: string;
  icon: PixelIconName;
  tone?: string;
  progress?: number;
}

interface Props {
  mood: Mood;
  motion: AvatarMotionModel;
  speech: string;
  energy: number;
  presenceLabel: string;
  nextLabel: string;
  reaction?: PhoenixRoomReaction | null;
  statusReadouts?: readonly PhoenixRoomStat[];
  avatarConfig?: PetAvatarConfig;
  petName?: string;
  /** A walk session is open: the twin is out of the room with their person. */
  awayOnWalk?: boolean;
  awayMinutes?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  presentation?: "home" | "studio";
  chromeDensity?: "full" | "compact";
  /** Skip the baked room scene so the living sprite layer floats over a
      full-screen background owned by the host screen. */
  transparentScene?: boolean;
}

type PercentString = `${number}%`;
type SpriteStageZone = {
  left: PercentString;
  top: PercentString;
  width: number;
  height: number;
};

const MOOD_THEME: Record<
  Mood,
  { glow: string; wash: string; accent: string; status: PixelIconName }
> = {
  happy: {
    glow: "rgba(255, 216, 122, 0.38)",
    wash: "rgba(255, 248, 226, 0.03)",
    accent: "#D8A852",
    status: "mood_great",
  },
  excited: {
    glow: "rgba(224, 122, 47, 0.4)",
    wash: "rgba(255, 229, 189, 0.05)",
    accent: "#E07A2F",
    status: "mood_great",
  },
  calm: {
    glow: "rgba(109, 163, 111, 0.34)",
    wash: "rgba(232, 243, 231, 0.05)",
    accent: "#6DA36F",
    status: "mood_good",
  },
  anxious: {
    glow: "rgba(141, 170, 204, 0.34)",
    wash: "rgba(221, 232, 246, 0.08)",
    accent: "#7A98C6",
    status: "mood_meh",
  },
  unwell: {
    glow: "rgba(201, 99, 88, 0.36)",
    wash: "rgba(255, 224, 218, 0.08)",
    accent: "#C96358",
    status: "mood_rough",
  },
};

const ROOM_ZONES: Record<
  AvatarRoomZone,
  { x: number; y: number; scale: number; icon: PixelIconName; label: string }
> = {
  rug: { x: 0, y: 0, scale: 1, icon: "heart", label: "On the rug" },
  door: { x: -18, y: -4, scale: 1.015, icon: "walk", label: "Door check" },
  bowl: { x: 16, y: 9, scale: 1.01, icon: "meal", label: "Bowl time" },
  bed: { x: 18, y: 11, scale: 0.995, icon: "clock", label: "Soft rest" },
  window: { x: -11, y: -9, scale: 1.008, icon: "happy", label: "Window watch" },
};

const FOCUS_SPOTS: Record<
  AvatarRoomZone,
  {
    left: PercentString;
    top: PercentString;
    width: PercentString;
    height: PercentString;
  }
> = {
  rug: { left: "18%", top: "25%", width: "47%", height: "55%" },
  door: { left: "10%", top: "24%", width: "45%", height: "54%" },
  bowl: { left: "48%", top: "59%", width: "38%", height: "24%" },
  bed: { left: "62%", top: "36%", width: "34%", height: "36%" },
  window: { left: "30%", top: "8%", width: "42%", height: "32%" },
};

const SPRITE_STAGE_ZONES: Record<
  AvatarRoomZone,
  SpriteStageZone
> = {
  rug: { left: "17%", top: "23%", width: 248, height: 248 },
  door: { left: "7%", top: "23%", width: 246, height: 246 },
  bowl: { left: "34%", top: "32%", width: 224, height: 224 },
  bed: { left: "7%", top: "31%", width: 224, height: 224 },
  window: { left: "21%", top: "24%", width: 238, height: 238 },
};

function getCompactSpriteZone(zone: SpriteStageZone): SpriteStageZone {
  return {
    ...zone,
    left: "42%",
    top: "28%",
    width: 150,
    height: 150,
  };
}

// Immersive Home stage: the twin is sized to sit believably inside the
// full-bleed storybook room rather than dominate it (a larger rig read as
// ~2x the window and overlapped the plant/shelf). 112px keeps the dog the
// clear focal point while the room objects breathe; top 42% plants its paws
// on the rug instead of floating above it.
function getImmersiveSpriteZone(zone: SpriteStageZone): SpriteStageZone {
  return {
    ...zone,
    left: "35%",
    top: "42%",
    width: 112,
    height: 112,
  };
}

const HUD_TONE_COLOR: Record<CareTwinHudTone, string> = {
  steady: "#6DA36F",
  happy: "#D8A852",
  urgent: "#C96358",
  soft: "#A8CBE8",
  reward: "#E07A2F",
};

const PIXEL_SPARKS: {
  left: PercentString;
  top: PercentString;
  size: number;
}[] = [
  { left: "8%", top: "19%", size: 4 },
  { left: "18%", top: "63%", size: 3 },
  { left: "42%", top: "12%", size: 4 },
  { left: "69%", top: "21%", size: 3 },
  { left: "84%", top: "55%", size: 4 },
  { left: "58%", top: "75%", size: 3 },
];

const PIXEL_SCANLINES = Array.from({ length: 8 }).map(
  (_, index) => `${10 + index * 11}%` as PercentString,
);

function energyBlocks(value: number): boolean[] {
  const filled = Math.max(
    1,
    Math.min(8, Math.round((Math.max(0, Math.min(100, value)) / 100) * 8)),
  );
  return Array.from({ length: 8 }).map((_, index) => index < filled);
}

function readoutBlocks(value?: number): boolean[] {
  const normalized = Math.max(0, Math.min(100, value ?? 0));
  const filled = Math.max(0, Math.min(7, Math.round((normalized / 100) * 7)));
  return Array.from({ length: 7 }).map((_, index) => index < filled);
}

function speechLines(speech: string): string[] {
  return speech
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Ambience cap: dust sparks and soft glows step their animation driver onto
 * a coarse grid (~20-30 style updates/sec) so an idle room is not repainting
 * at a full 60fps just for shimmer. The steps are far below what the eye can
 * see on these slow sine loops; real motion (walk travel, bob, the sprite
 * frame clock) stays per-frame smooth and untouched.
 */
const AMBIENT_STEPS = 64;
function stepAmbient(value: number): number {
  "worklet";
  return Math.round(value * AMBIENT_STEPS) / AMBIENT_STEPS;
}

/**
 * How long a care-event scene (a fresh meal/water/treat/walk log deriving a
 * "care-action" or "celebration" plan) owns the stage before the twin
 * settles back onto the idle track. Without this window the event loop was
 * pinned for the whole 45-minute recent-entry derivation window while the
 * ambient scheduler kept interleaving idle strips over it — the post-meal
 * eat/wag flip-flop (a hard swap every ~1s, 21 in 24s, never settling).
 */
const CARE_EVENT_WINDOW_MS = 8000;

// Pose swaps on BOTH twin rigs (anchored stage and roaming) ride through a
// brief opacity settle (dip out, swap at the trough, ease back) so a
// behavior change reads as a beat instead of a hard sprite cut.
const POSE_SETTLE_OUT_MS = 70;
const POSE_SETTLE_IN_MS = 110;

/**
 * The settled shape of a care-event plan: same zone, copy, and care cues
 * (the meal-outcome prompt stays honest), but the motion rests on the calm
 * idle track until a NEW event re-opens the window.
 */
function settledCareEventPlan(plan: AvatarLifePlan): AvatarLifePlan {
  return {
    ...plan,
    animation: "idle",
    spriteAction: "tail-wag",
    spriteTrack: CARE_TWIN_SPRITE_MANIFEST["tail-wag"],
    breathLift: 5,
    breathScale: 0.018,
    paceMs: 2800,
  };
}

export function LivingPhoenixRoom({
  mood,
  motion,
  speech,
  energy,
  presenceLabel,
  nextLabel,
  reaction,
  statusReadouts,
  avatarConfig,
  petName,
  awayOnWalk = false,
  awayMinutes,
  onPress,
  onLongPress,
  accessibilityHint,
  presentation = "home",
  chromeDensity = "full",
  transparentScene = false,
}: Props) {
  const colors = useColors();
  const theme = MOOD_THEME[mood];
  const scenePlan = useMemo(() => deriveCareTwinScene(motion), [motion]);

  // --- One-way care-event lifecycle ---------------------------------------
  // A care-event scene (eat/drink/celebrate/walk from a fresh log) plays its
  // loop for one short reaction window and then settles to the idle track
  // until a NEW event. The transition is one-way per event: the signature
  // ref only re-opens the window when the derived event actually changes,
  // and it initializes to the mount-time signature so a scene derived from
  // stored history (an app reload minutes after a meal) never replays.
  // An open walk session is a live activity, not a past event, so the away
  // scene keeps walking for as long as the session runs.
  const careEventSignature =
    !awayOnWalk &&
    (scenePlan.scenePhase === "care-action" ||
      scenePlan.scenePhase === "celebration")
      ? `${scenePlan.scenePhase}:${scenePlan.spriteAction}`
      : null;
  const [careEventSettled, setCareEventSettled] = useState(true);
  const careEventSignatureRef = useRef(careEventSignature);
  const careEventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (careEventSignature === careEventSignatureRef.current) return;
    careEventSignatureRef.current = careEventSignature;
    if (careEventTimer.current) clearTimeout(careEventTimer.current);
    if (!careEventSignature) {
      setCareEventSettled(true);
      return;
    }
    setCareEventSettled(false);
    careEventTimer.current = setTimeout(
      () => setCareEventSettled(true),
      CARE_EVENT_WINDOW_MS,
    );
  }, [careEventSignature]);
  useEffect(
    () => () => {
      if (careEventTimer.current) clearTimeout(careEventTimer.current);
    },
    [],
  );
  const careEventActive = Boolean(careEventSignature) && !careEventSettled;
  const plan = useMemo(
    () =>
      careEventSignature && careEventSettled
        ? settledCareEventPlan(scenePlan)
        : scenePlan,
    [careEventSettled, careEventSignature, scenePlan],
  );

  const choreography = useMemo(() => deriveCareTwinChoreography(plan), [plan]);
  const isStudio = presentation === "studio";
  const compactChrome = chromeDensity === "compact";
  const sceneSource = STATE_SCENES[mood];
  const fallbackAvatarSource = PHOENIX_FALLBACK_AVATARS[mood];
  const lines = useMemo(() => speechLines(speech), [speech]);
  const hudAccent = HUD_TONE_COLOR[plan.hudTone] ?? theme.accent;
  const [activeReaction, setActiveReaction] =
    useState<PhoenixRoomReaction | null>(reaction ?? null);
  const [ambientSpriteAction, setAmbientSpriteAction] =
    useState<CareTwinSpriteAction | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReactionIdRef = useRef<number | null>(null);
  const activeSpriteAction =
    activeReaction?.spriteAction ?? ambientSpriteAction ?? plan.spriteAction;
  // Immersive mode keeps the real care actions; only framed compact stages
  // (no full-screen backdrop) pin the twin to a calm tail wag.
  const stageSpriteAction: CareTwinSpriteAction =
    compactChrome && !transparentScene ? "tail-wag" : activeSpriteAction;

  // Stage pose settle: anchored-rig sprite swaps ride the same short
  // opacity trough the roaming rig uses — dip out, swap the strip (and the
  // restart key) at the bottom of the dip, ease back in — so a post-meal
  // eat-to-idle handoff or a night sleep-to-eat wake-up reads as the dog
  // settling into the next beat instead of a single-frame hard cut. The
  // whole visual stack (sprite, accessory layers, zone pin) derives from
  // the displayed pose, so position re-pins land in lockstep with the swap
  // at the trough; only the pose stack fades — the ground shadow stays
  // planted so the beat reads as settling, not blinking.
  const stageReactionKey = activeReaction?.spriteAction
    ? `${activeReaction.id}-${activeReaction.spriteAction}`
    : null;
  const [displayedStagePose, setDisplayedStagePose] = useState<{
    action: CareTwinSpriteAction;
    reactionKey: string | null;
  }>({ action: stageSpriteAction, reactionKey: stageReactionKey });
  const stagePoseOpacity = useSharedValue(1);
  const stagePoseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (
      displayedStagePose.action === stageSpriteAction &&
      displayedStagePose.reactionKey === stageReactionKey
    ) {
      stagePoseOpacity.value = withTiming(1, {
        duration: POSE_SETTLE_IN_MS,
        easing: Easing.out(Easing.quad),
      });
      return;
    }
    stagePoseOpacity.value = withTiming(0, {
      duration: POSE_SETTLE_OUT_MS,
      easing: Easing.in(Easing.quad),
    });
    stagePoseTimer.current = setTimeout(() => {
      setDisplayedStagePose({
        action: stageSpriteAction,
        reactionKey: stageReactionKey,
      });
    }, POSE_SETTLE_OUT_MS);
    return () => {
      if (stagePoseTimer.current) clearTimeout(stagePoseTimer.current);
    };
  }, [displayedStagePose, stagePoseOpacity, stageReactionKey, stageSpriteAction]);
  const stagePoseAction = displayedStagePose.action;
  const stagePoseFadeStyle = useAnimatedStyle(() => ({
    opacity: stagePoseOpacity.value,
  }));

  const shouldUseAvatarRuntime =
    Boolean(avatarConfig) && (!compactChrome || transparentScene);
  const avatarRoomRuntime = useMemo(
    () =>
      shouldUseAvatarRuntime && avatarConfig
        ? deriveAvatarRoomRuntime(avatarConfig, stagePoseAction)
        : null,
    [avatarConfig, shouldUseAvatarRuntime, stagePoseAction],
  );
  const avatarAccessoryCount = avatarRoomRuntime?.activeSlots.length ?? 0;
  const roomLiveTitle = isStudio ? "STUDIO RIG" : "PHOENIX TWIN";
  const roomLiveDetail = avatarRoomRuntime
    ? avatarAccessoryCount > 0
      ? `${avatarRoomRuntime.templateLabel} - ${avatarAccessoryCount} add-ons`
      : `${avatarRoomRuntime.templateLabel} rig`
    : "Pixel room";
  const activeZoneKey =
    compactChrome && !transparentScene
      ? "rug"
      : zoneForSpriteAction(stagePoseAction, plan.zone);
  const zone = ROOM_ZONES[activeZoneKey];
  const focusSpot = FOCUS_SPOTS[activeZoneKey];
  const spriteZone = SPRITE_STAGE_ZONES[activeZoneKey];
  const activeSpriteZone = transparentScene
    ? getImmersiveSpriteZone(spriteZone)
    : compactChrome
      ? getCompactSpriteZone(spriteZone)
      : spriteZone;
  const spriteAsset = useMemo(
    () =>
      avatarRoomRuntime?.spriteAsset ??
      getCareTwinSpriteAsset(stagePoseAction),
    [avatarRoomRuntime?.spriteAsset, stagePoseAction],
  );
  const roomLayer = useMemo(
    () => getCareTwinRoomLayer(mood, stagePoseAction),
    [mood, stagePoseAction],
  );
  const layerReadiness = useMemo(
    () => getCareTwinLayerReadiness(stagePoseAction, mood),
    [mood, stagePoseAction],
  );
  const activeSpriteTrack =
    avatarRoomRuntime?.spriteTrack ??
    CARE_TWIN_SPRITE_MANIFEST[stagePoseAction] ??
    plan.spriteTrack;
  // Accessory art is fitted to the template sprite-pack geometry; over the
  // Phoenix action strips it lands at the wrong scale, so it only renders
  // when the runtime actually uses the template pack.
  const showStageAccessoryLayers =
    avatarRoomRuntime?.spriteMode === "template-idle-walk-pack";
  const activeSpriteAsset =
    avatarRoomRuntime?.spriteAsset ??
    getCareTwinSpriteAsset(stagePoseAction) ??
    spriteAsset;
  const layeredStageReady =
    (!compactChrome || transparentScene) &&
    layerReadiness.roomReady &&
    Boolean(activeSpriteAsset && roomLayer && activeSpriteTrack);
  const roomStageReady = Boolean(roomLayer);
  const stageSource = roomLayer?.source ?? sceneSource;
  // Exactly one twin layer may render: the layered sprite stage when its
  // assets are ready, otherwise the static fallback avatar.
  const useFallbackAvatarLayer = roomStageReady && !layeredStageReady;
  const animateBakedScene = !roomStageReady && !layeredStageReady;
  const roomStats = useMemo<PhoenixRoomStat[]>(
    () =>
      statusReadouts?.slice(0, 4) ?? [
        {
          label: "Mood",
          value: plan.moodLabel,
          icon: theme.status,
          tone: theme.accent,
          progress: mood === "unwell" ? 42 : mood === "anxious" ? 58 : 86,
        },
        {
          label: "Energy",
          value: `${Math.round(energy)}%`,
          icon: "energy",
          tone: theme.accent,
          progress: energy,
        },
        {
          label: "Cue",
          value: plan.recommendedActionLabel,
          icon: zone.icon,
          tone: hudAccent,
          progress: plan.scenePhase === "idle" ? 72 : 88,
        },
      ],
    [
      energy,
      hudAccent,
      mood,
      plan.moodLabel,
      plan.recommendedActionLabel,
      plan.scenePhase,
      statusReadouts,
      theme.accent,
      theme.status,
      zone.icon,
    ],
  );
  const motionRecipe = useMemo(
    () => motionRecipeForSpriteAction(stagePoseAction),
    [stagePoseAction],
  );

  // Roam mode: on the immersive Home stage the twin physically walks the
  // floor band between waypoints whenever the scene is calm. Care actions,
  // rest, and watch phases stay anchored to their zones.
  const roamSeed = useRef(Math.floor(Math.random() * 1_000_000_000));
  const [stageSize, setStageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const roamBaseAction = ambientSpriteAction ?? plan.spriteAction;
  const roamDwellAction: CareTwinSpriteAction =
    roamBaseAction === "walk-loop" ? "tail-wag" : roamBaseAction;
  const roamEligible = careTwinCanRoam({
    transparentScene,
    isStudio,
    scenePhase: plan.scenePhase,
    awayOnWalk,
    hasWalkSprite: Boolean(getCareTwinSpriteAsset("walk-loop")),
    hasDwellSprite: Boolean(
      getCareTwinSpriteAsset(roamDwellAction) ?? avatarConfig,
    ),
  });
  const roamPlan = useMemo(
    () =>
      roamEligible
        ? deriveCareTwinRoamPlan({
            anchorZone: plan.zone,
            seed: roamSeed.current,
          })
        : null,
    [plan.zone, roamEligible],
  );
  // While a walk session is open the host screen swaps the scene to the
  // park, so the twin stays visible and walks it - the away cue narrates
  // the live session on top.
  const roamActive = Boolean(roamPlan && stageSize);
  const handleStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize((prev) =>
      prev && prev.width === width && prev.height === height
        ? prev
        : { width, height },
    );
  };

  const breath = useSharedValue(0);
  const walkCycle = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const tap = useSharedValue(0);
  const zoneX = useSharedValue(zone.x);
  const zoneY = useSharedValue(zone.y);
  const zoneScale = useSharedValue(zone.scale);
  const reactionProgress = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    zoneX.value = withSpring(zone.x, { damping: 17, stiffness: 72 });
    zoneY.value = withSpring(zone.y, { damping: 17, stiffness: 72 });
    zoneScale.value = withSpring(zone.scale, { damping: 17, stiffness: 82 });
  }, [plan.zone, zone.x, zone.y, zone.scale, zoneScale, zoneX, zoneY]);

  useEffect(() => {
    breath.value = 0;
    walkCycle.value = 0;
    // Reduce Motion: hold a calm, still pose instead of the perpetual
    // breathing / walk-cycle loops.
    if (reduced) return;
    breath.value = withRepeat(
      withTiming(1, {
        duration: plan.paceMs,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );

    walkCycle.value = withRepeat(
      withTiming(1, {
        duration: Math.max(760, Math.round(plan.paceMs * 0.62)),
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [breath, plan.animation, plan.paceMs, walkCycle, reduced]);

  useEffect(() => {
    shimmer.value = 0;
    // Reduce Motion: no ambient light shimmer loop.
    if (reduced) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [shimmer, reduced]);

  useEffect(() => {
    if (!reaction) return;
    // The host never nulls the reaction prop, so replay only genuinely new
    // reactions — otherwise a scene-phase change re-runs this effect and
    // resurrects a stale banner (and re-freezes the roaming twin).
    if (reaction.id === lastReactionIdRef.current) return;
    lastReactionIdRef.current = reaction.id;
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    setAmbientSpriteAction(null);
    setActiveReaction(reaction);
    reactionProgress.value = 0;
    reactionProgress.value = withSequence(
      withSpring(1, { damping: 9, stiffness: 120 }),
      withDelay(1250, withTiming(0, { duration: 260 })),
    );
    reactionTimer.current = setTimeout(
      () => setActiveReaction(null),
      choreography.reactionDurationMs,
    );
    return () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
  }, [choreography.reactionDurationMs, reaction, reactionProgress]);

  // Petting is affection-only feedback - hearts, a wag, a soft buzz. It never
  // touches care stats: every number in WoofWatcher stays earned by real care.
  const petLineIndex = useRef(0);
  const triggerPetReaction = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const petLines = [
      "So loved.",
      "Happy wiggles!",
      "Tail says thanks.",
      "Best friend ever.",
    ];
    const label = petLines[petLineIndex.current % petLines.length];
    petLineIndex.current += 1;
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    setAmbientSpriteAction(null);
    setActiveReaction({
      id: Date.now(),
      icon: "heart",
      label,
      spriteAction: "tail-wag",
    });
    reactionProgress.value = 0;
    reactionProgress.value = withSequence(
      withSpring(1, { damping: 9, stiffness: 120 }),
      withDelay(1250, withTiming(0, { duration: 260 })),
    );
    reactionTimer.current = setTimeout(() => setActiveReaction(null), 1900);
  };

  useEffect(() => {
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    setAmbientSpriteAction(null);
    if (!choreography.ambient.length || plan.scenePhase === "rest") return;
    // A live care-event beat owns the stage: ambient micro-loops hold until
    // the event settles so eat/drink/celebrate plays unbroken instead of
    // flip-flopping against idle strips every scheduler tick.
    if (careEventActive) return;
    // Reduce Motion: no periodic ambient pose changes - hold the idle pose.
    if (reduced) return;

    const shortestCadence = choreography.ambientCadenceMs ?? 2600;
    const id = setInterval(
      () => {
        if (activeReaction) return;
        const available = choreography.ambient.filter(
          (behavior) => Math.random() <= (behavior.chance ?? 1),
        );
        const next = available[Math.floor(Math.random() * available.length)];
        if (!next || next.action === plan.spriteAction) return;

        setAmbientSpriteAction(next.action);
        if (ambientTimer.current) clearTimeout(ambientTimer.current);
        ambientTimer.current = setTimeout(
          () => setAmbientSpriteAction(null),
          Math.min(1700, Math.max(900, next.durationMs)),
        );
      },
      Math.max(1800, shortestCadence),
    );

    return () => {
      clearInterval(id);
      if (ambientTimer.current) clearTimeout(ambientTimer.current);
    };
  }, [
    activeReaction,
    careEventActive,
    choreography.ambient,
    choreography.ambientCadenceMs,
    plan.scenePhase,
    plan.spriteAction,
    reduced,
  ]);

  const isWalking = plan.animation === "walk";
  const isEating =
    !compactChrome && (plan.animation === "eat" || plan.animation === "drink");
  const isSleeping = !compactChrome && plan.animation === "sleep";
  const isCelebrate = !compactChrome && plan.animation === "celebrate";
  const isComfort = !compactChrome && plan.animation === "comfort";
  const stageBreathLift = compactChrome ? 3.5 : plan.breathLift;
  const stageBreathScale = compactChrome ? 0.018 : plan.breathScale;

  const sceneMotionStyle = useAnimatedStyle(() => {
    const wave = Math.sin(walkCycle.value * Math.PI * 2);
    const travel = wave * motionRecipe.bodySwayPx * 0.34;
    const bob = Math.abs(wave) * motionRecipe.bodyBobPx * 0.28;
    const chew = isEating ? Math.sin(walkCycle.value * Math.PI * 4) : 0;
    const celebration = isCelebrate ? Math.abs(wave) : 0;
    const comfortTilt = isComfort ? -0.45 : 0;
    const sleepDrift = isSleeping ? breath.value * 1.2 : 0;

    return {
      transform: [
        { translateX: zoneX.value * 0.1 + travel },
        {
          translateY:
            zoneY.value * 0.08 -
            breath.value *
              stageBreathLift *
              (0.18 + motionRecipe.scalePulse * 0.08) -
            bob -
            celebration * 1.5 +
            chew * 0.8 +
            sleepDrift -
            tap.value * 3,
        },
        {
          scale:
            zoneScale.value *
            (1.018 +
              breath.value *
                stageBreathScale *
                (0.52 + motionRecipe.scalePulse * 0.16) +
              tap.value * 0.01),
        },
        {
          rotate: `${wave * motionRecipe.tiltDeg * 0.32 + chew * 0.18 + comfortTilt + tap.value * -0.55}deg`,
        },
      ],
    };
  }, [
    isCelebrate,
    isComfort,
    isEating,
    isSleeping,
    motionRecipe.bodyBobPx,
    motionRecipe.bodySwayPx,
    motionRecipe.scalePulse,
    motionRecipe.tiltDeg,
    stageBreathLift,
    stageBreathScale,
  ]);

  const spriteRigStyle = useAnimatedStyle(() => {
    const wave = Math.sin(walkCycle.value * Math.PI * 2);
    const travel = wave * motionRecipe.bodySwayPx;
    const bob = Math.abs(wave) * motionRecipe.bodyBobPx;
    const chew = isEating ? Math.sin(walkCycle.value * Math.PI * 4) : 0;
    const celebration = isCelebrate ? Math.abs(wave) : 0;
    const comfortTilt = isComfort ? -1.2 : 0;
    const sleepDrift = isSleeping ? breath.value * 2.2 : 0;

    return {
      transform: [
        { translateX: zoneX.value * 0.55 + travel },
        {
          translateY:
            zoneY.value * 0.32 -
            breath.value *
              stageBreathLift *
              (0.78 + motionRecipe.scalePulse * 0.32) -
            bob -
            celebration * 4 +
            chew * 2 +
            sleepDrift -
            tap.value * 8,
        },
        {
          scale:
            zoneScale.value *
            (1 +
              breath.value *
                stageBreathScale *
                (0.82 + motionRecipe.scalePulse * 0.28) +
              tap.value * 0.025),
        },
        {
          rotate: `${wave * motionRecipe.tiltDeg + chew * 0.6 + comfortTilt + tap.value * -1.4}deg`,
        },
      ],
    };
  }, [
    isCelebrate,
    isComfort,
    isEating,
    isSleeping,
    motionRecipe.bodyBobPx,
    motionRecipe.bodySwayPx,
    motionRecipe.scalePulse,
    motionRecipe.tiltDeg,
    stageBreathLift,
    stageBreathScale,
  ]);

  const spriteShadowStyle = useAnimatedStyle(
    () => {
      const pulse = stepAmbient(breath.value);
      return {
        opacity: 0.28 + pulse * motionRecipe.shadowOpacityPulse,
        transform: [
          { scaleX: 1.16 + pulse * motionRecipe.shadowScalePulse },
          { scaleY: 1 - pulse * 0.05 },
        ],
      };
    },
    [motionRecipe.shadowOpacityPulse, motionRecipe.shadowScalePulse],
  );

  const dogFocusGlow = useAnimatedStyle(() => {
    const glow = stepAmbient(breath.value);
    return {
      opacity: interpolate(
        glow,
        [0, 0.5, 1],
        [0.16, plan.showCareAura ? 0.46 : 0.28, 0.16],
      ),
      transform: [{ scale: interpolate(glow, [0, 1], [0.96, 1.08]) }],
    };
  });

  const activeZoneStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(stepAmbient(breath.value), [0, 1], [1, 1.08]) },
    ],
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const drift = stepAmbient(shimmer.value);
    return {
      opacity: interpolate(drift, [0, 1], [0.18, 0.58]),
      transform: [{ translateY: interpolate(drift, [0, 1], [4, -7]) }],
    };
  });

  const reactionStyle = useAnimatedStyle(() => ({
    opacity: reactionProgress.value,
    transform: [
      { translateY: interpolate(reactionProgress.value, [0, 1], [14, 0]) },
      { scale: interpolate(reactionProgress.value, [0, 1], [0.9, 1]) },
    ],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reactionProgress.value, [0, 0.25, 1], [0, 1, 0.72]),
    transform: [
      { translateY: interpolate(reactionProgress.value, [0, 1], [8, -15]) },
      {
        scale: interpolate(
          reactionProgress.value,
          [0, 0.35, 1],
          [0.8, 1.15, 1],
        ),
      },
    ],
  }));

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    tap.value = withSequence(
      withSpring(1, { damping: 7, stiffness: 180 }),
      withSpring(0, { damping: 10, stiffness: 120 }),
    );
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Phoenix room. ${avatarRoomRuntime?.templateLabel ?? "Shepherd"} care twin. ${motion.label}. ${plan.tapVerb}. ${speech}`}
      accessibilityHint={accessibilityHint}
      onPress={handlePress}
      onLongPress={onLongPress}
      onLayout={handleStageLayout}
      style={[
        styles.root,
        transparentScene ? styles.rootTransparent : null,
      ]}
    >
      {transparentScene ? null : (
        <>
          <View pointerEvents="none" style={styles.pixelFrame}>
            <View style={[styles.frameCorner, styles.frameCornerTopLeft]} />
            <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
          </View>
          <Animated.Image
            source={stageSource}
            resizeMode="cover"
            style={[
              styles.scene,
              pixelImageStyle,
              animateBakedScene ? sceneMotionStyle : null,
            ]}
          />
          <LinearGradient
            colors={[theme.wash, "rgba(255,249,239,0)", "rgba(8,20,36,0.28)"]}
            locations={[0, 0.58, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      )}

      {roamActive ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dogFocus,
            focusSpot,
            { backgroundColor: theme.glow, borderColor: theme.accent },
            dogFocusGlow,
          ]}
        />
      )}

      {roamActive && roamPlan && stageSize ? (
        <RoamingTwinRig
          plan={roamPlan}
          stageWidth={stageSize.width}
          stageHeight={stageSize.height}
          dwellAction={roamDwellAction}
          overrideAction={activeReaction?.spriteAction ?? null}
          overrideKey={activeReaction?.id ?? null}
          avatarConfig={avatarConfig}
          glowColor={theme.glow}
          petName={petName}
          onPet={triggerPetReaction}
        />
      ) : null}

      {awayOnWalk ? (
        <View pointerEvents="none" style={styles.awayCue}>
          <View style={styles.awayCueCard}>
            <PixelIcon name="walk" size={18} />
            <View>
              <Text style={styles.awayCueTitle}>
                {petName ?? "Phoenix"} is out exploring
              </Text>
              <Text style={styles.awayCueDetail}>
                {typeof awayMinutes === "number" && awayMinutes >= 0
                  ? `On a walk - ${awayMinutes} min so far`
                  : "On a walk right now"}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* The stationary rig also covers the roam gap: if roamActive flips
          while roamPlan/stageSize momentarily reset (a welcome-card
          collapse re-layout does this), the roaming rig renders nothing
          and the dog blinked out of the room entirely. */}
      {layeredStageReady && (!roamActive || !roamPlan || !stageSize) ? (
        <Animated.View
          pointerEvents="none"
          style={[
              styles.spriteRig,
              {
                left: activeSpriteZone.left,
                top: activeSpriteZone.top,
                width: activeSpriteZone.width,
                height: activeSpriteZone.height,
              },
              spriteRigStyle,
          ]}
          testID="care-twin-layered-sprite-rig"
        >
          <Animated.View
            style={[
              styles.spriteGroundShadow,
              { backgroundColor: "rgba(8,20,36,0.55)" },
              spriteShadowStyle,
            ]}
          />
          {/* The settle dip wraps the pose stack only — the ground shadow
              above stays put so a swap reads as the dog settling into the
              next beat, not blinking out of the room. */}
          <Animated.View style={[styles.poseSettleFade, stagePoseFadeStyle]}>
            {showStageAccessoryLayers
              ? avatarRoomRuntime?.underlayLayers.map((layer) =>
                  layer.source ? (
                    <Animated.Image
                      key={`avatar-underlay-${layer.id}`}
                      source={layer.source}
                      resizeMode="contain"
                      style={[
                        styles.avatarAccessoryLayer,
                        styles.avatarAccessoryUnderlay,
                        pixelImageStyle,
                      ]}
                      testID={`care-twin-avatar-underlay-${layer.id}`}
                    />
                  ) : null,
                )
              : null}
            <SpriteSheetPlayer
              key={displayedStagePose.reactionKey ?? activeSpriteTrack.key}
              asset={activeSpriteAsset}
              height={activeSpriteZone.height}
              testID={
                avatarRoomRuntime?.spriteMode === "template-idle-walk-pack"
                  ? "care-twin-template-sprite-player"
                  : "care-twin-sprite-player"
              }
              track={activeSpriteTrack}
              width={activeSpriteZone.width}
            />
            {showStageAccessoryLayers
              ? avatarRoomRuntime?.overlayLayers.map((layer) =>
                  layer.source ? (
                    <Animated.Image
                      key={`avatar-overlay-${layer.id}`}
                      source={layer.source}
                      resizeMode="contain"
                      style={[
                        styles.avatarAccessoryLayer,
                        styles.avatarAccessoryOverlay,
                        pixelImageStyle,
                      ]}
                      testID={`care-twin-avatar-overlay-${layer.id}`}
                    />
                  ) : null,
                )
              : null}
          </Animated.View>
        </Animated.View>
      ) : null}

      {useFallbackAvatarLayer && (!roamActive || !roamPlan || !stageSize) ? (
        <Animated.View
          pointerEvents="none"
          style={[
              styles.spriteRig,
              {
                left: activeSpriteZone.left,
                top: activeSpriteZone.top,
                width: activeSpriteZone.width,
                height: activeSpriteZone.height,
              },
              spriteRigStyle,
          ]}
          testID="care-twin-fallback-avatar-rig"
        >
          <Animated.View
            style={[
              styles.spriteGroundShadow,
              { backgroundColor: "rgba(8,20,36,0.55)" },
              spriteShadowStyle,
            ]}
          />
          <Animated.Image
            source={fallbackAvatarSource}
            resizeMode="contain"
            style={[styles.fallbackAvatar, pixelImageStyle]}
          />
        </Animated.View>
      ) : null}

      {PIXEL_SPARKS.map((spark, index) => (
        <Animated.View
          key={`spark-${index}`}
          pointerEvents="none"
          style={[
            styles.spark,
            {
              left: spark.left,
              top: spark.top,
              width: spark.size,
              height: spark.size,
              borderRadius: 1,
              backgroundColor: index % 2 ? "#FFF9EF" : theme.accent,
            },
            shimmerStyle,
          ]}
        />
      ))}

      <View style={styles.topHud} pointerEvents="none">
        {transparentScene ? null : (
          <View
            style={[
              styles.liveChip,
              {
                backgroundColor: "rgba(8, 26, 42, 0.88)",
                borderColor: "rgba(255,249,239,0.22)",
              },
            ]}
          >
            <Animated.View
              style={[
                styles.liveDot,
                { backgroundColor: hudAccent },
                activeZoneStyle,
              ]}
            />
            <View style={styles.liveCopy}>
              <Text style={styles.liveText}>{roomLiveTitle}</Text>
              <Text numberOfLines={1} style={styles.liveSubText}>
                {roomLiveDetail}
              </Text>
            </View>
          </View>
        )}
        {!isStudio && !compactChrome ? (
          <Animated.View
            style={[
              styles.zoneChip,
              {
                backgroundColor: "rgba(255,249,239,0.93)",
                borderColor: theme.accent,
              },
              activeZoneStyle,
            ]}
          >
            <PixelIcon name={zone.icon} size={15} />
            <Text style={[styles.zoneChipText, { color: OVERLAY_INK }]}>
              {zone.label}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      {!isStudio && !compactChrome ? (
        <View
          style={[
            styles.roomStatsPanel,
            {
              backgroundColor: "rgba(255,249,239,0.93)",
              borderColor: "rgba(8,26,42,0.18)",
            },
          ]}
        >
          <View style={styles.roomStatsHeader}>
            <Text style={[styles.roomStatsTitle, { color: OVERLAY_INK }]}>
              STATUS
            </Text>
            <View style={styles.roomStatsSignalWrap}>
              <View
                style={[styles.roomStatsSignal, { backgroundColor: hudAccent }]}
              />
              <View
                style={[
                  styles.roomStatsSignal,
                  { backgroundColor: hudAccent, opacity: 0.58 },
                ]}
              />
              <View
                style={[
                  styles.roomStatsSignal,
                  { backgroundColor: hudAccent, opacity: 0.28 },
                ]}
              />
            </View>
          </View>
          {roomStats.map((stat) => (
            <View key={stat.label} style={styles.roomStatRow}>
              <PixelIcon name={stat.icon} size={15} />
              <View style={styles.roomStatCopy}>
                <View style={styles.roomStatTop}>
                  <Text
                    numberOfLines={1}
                    style={[styles.roomStatLabel, { color: OVERLAY_INK }]}
                  >
                    {stat.label}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.roomStatValue,
                      { color: stat.tone ?? hudAccent },
                    ]}
                  >
                    {stat.value}
                  </Text>
                </View>
                <View style={styles.roomStatBlocks}>
                  {readoutBlocks(stat.progress).map((active, index) => (
                    <View
                      key={`${stat.label}-${index}`}
                      style={[
                        styles.roomStatBlock,
                        {
                          backgroundColor: active
                            ? (stat.tone ?? hudAccent)
                            : colors.muted,
                          borderColor: active
                            ? (stat.tone ?? hudAccent)
                            : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!isStudio ? (
        <View
          style={[
            styles.speechBubble,
            compactChrome ? styles.speechBubbleCompact : null,
            {
              backgroundColor: "rgba(255,249,239,0.94)",
              borderColor: OVERLAY_INK,
            },
          ]}
        >
          {(lines.length ? lines : ["I'm ready."]).map((line) => (
            <Text
              key={line}
              style={[
                styles.speechText,
                compactChrome ? styles.speechTextCompact : null,
                { color: OVERLAY_INK },
              ]}
            >
              {line}
            </Text>
          ))}
          <View
            style={[
              styles.speechTail,
              {
                backgroundColor: "rgba(255,249,239,0.94)",
                borderColor: OVERLAY_INK,
              },
            ]}
          />
        </View>
      ) : null}

      {!isStudio && !compactChrome ? (
        <View
          style={[
            styles.statusPatch,
            {
              backgroundColor: "rgba(8,26,42,0.78)",
              borderColor: "rgba(255,249,239,0.2)",
            },
          ]}
        >
          <PixelIcon name={theme.status} size={22} />
          <View style={styles.statusPatchCopy}>
            <Text style={styles.statusPatchKicker}>
              {plan.scenePhase.replace("-", " ")}
            </Text>
            <Text style={styles.statusPatchValue}>{plan.moodLabel}</Text>
          </View>
        </View>
      ) : null}

      {isWalking ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.walkMarks, shimmerStyle]}
        >
          <View style={[styles.walkMark, { backgroundColor: theme.accent }]} />
          <View
            style={[
              styles.walkMark,
              styles.walkMarkShort,
              { backgroundColor: theme.accent },
            ]}
          />
          <View
            style={[
              styles.walkMark,
              styles.walkMarkTiny,
              { backgroundColor: theme.accent },
            ]}
          />
        </Animated.View>
      ) : null}

      {plan.showHearts ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.heartTrail, shimmerStyle]}
        >
          <PixelIcon name="heart" size={18} />
          <PixelIcon name="heart" size={12} />
        </Animated.View>
      ) : null}

      {plan.showSleep ? (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          pointerEvents="none"
          style={[styles.sleepBubble, shimmerStyle]}
        >
          <Text style={styles.sleepText}>Zz</Text>
        </Animated.View>
      ) : null}

      {activeReaction ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reaction,
            reactionStyle,
            {
              backgroundColor: activeReaction.tone ?? colors.brandNavy,
              borderColor: "rgba(255,249,239,0.32)",
            },
          ]}
        >
          <PixelIcon name={activeReaction.icon} size={24} />
          <View style={styles.reactionTextWrap}>
            <Text style={styles.reactionTitle}>{activeReaction.label}</Text>
            {activeReaction.detail ? (
              <Text style={styles.reactionDetail}>{activeReaction.detail}</Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      {activeReaction ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.actionBurst, burstStyle]}
        >
          <View
            style={[styles.actionSpark, { backgroundColor: theme.accent }]}
          />
          <Text style={[styles.actionBurstText, { color: theme.accent }]}>
            + care
          </Text>
          <View style={[styles.actionSpark, { backgroundColor: "#FFF9EF" }]} />
        </Animated.View>
      ) : null}

      {!isStudio && !compactChrome ? (
        <View
          style={[
            styles.roomDock,
            {
              backgroundColor: "rgba(255,249,239,0.94)",
              borderColor: "rgba(8,26,42,0.12)",
            },
          ]}
        >
          <View style={styles.dockColumn}>
            <Text
              style={[styles.dockKicker, { color: OVERLAY_MUTED_INK }]}
            >
              Presence
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.dockText, { color: OVERLAY_INK }]}
            >
              {presenceLabel}
            </Text>
          </View>
          <View
            style={[styles.dockDivider, { backgroundColor: colors.border }]}
          />
          <View style={styles.dockColumn}>
            <Text
              style={[styles.dockKicker, { color: OVERLAY_MUTED_INK }]}
            >
              Care cue
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.dockText, { color: OVERLAY_INK }]}
            >
              {plan.recommendedActionLabel}
            </Text>
          </View>
          <View
            style={[styles.dockDivider, { backgroundColor: colors.border }]}
          />
          <View style={styles.energyDock}>
            <Text
              style={[styles.dockKicker, { color: OVERLAY_MUTED_INK }]}
            >
              Energy
            </Text>
            <View style={styles.energyBlocks}>
              {energyBlocks(energy).map((active, index) => (
                <View
                  key={`energy-${index}`}
                  style={[
                    styles.energyBlock,
                    {
                      backgroundColor: active ? theme.accent : colors.muted,
                      borderColor: active ? theme.accent : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {!isStudio && !compactChrome ? (
        <View
          style={[
            styles.nextChip,
            {
              backgroundColor: "rgba(8,26,42,0.86)",
              borderColor: "rgba(255,249,239,0.2)",
            },
          ]}
        >
          <PixelIcon name={zone.icon} size={18} />
          <Text numberOfLines={1} style={styles.nextText}>
            {plan.activityLabel} - {nextLabel}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// The roaming twin matches the resting twin's scale (getImmersiveSpriteZone)
// so the dog is one consistent size whether it is curled up or pacing the
// floor. ROAM_RIG_BASELINE is the size the floor waypoints were originally
// tuned against; the rig is bottom-aligned, so nudging its `top` by the
// (baseline - size) delta keeps the paws planted on the floor line when the
// size shrinks (see styles.roamRig).
const ROAM_RIG_BASELINE = 150;
const ROAM_RIG_SIZE = 112;
const ROAM_BOB_MS = 340;

/**
 * Duration for a non-walk position correction (plan re-anchor, dwell pin):
 * distance-based so short fixes stay snappy while a cross-room re-anchor
 * glides — never the old single-frame ~70px teleport.
 */
function roamGlideMs(distancePx: number): number {
  return Math.round(Math.min(620, Math.max(200, distancePx * 6)));
}

interface RoamingTwinRigProps {
  plan: RoamPlan;
  stageWidth: number;
  stageHeight: number;
  dwellAction: CareTwinSpriteAction;
  /** A reaction pauses the walk in place and plays over the rig. */
  overrideAction: CareTwinSpriteAction | null;
  overrideKey: number | null;
  avatarConfig?: PetAvatarConfig;
  glowColor: string;
  petName?: string;
  onPet?: () => void;
}

/** One floating heart of the petting burst: rises, blooms, and fades. */
function PetHeart({ dx, delayMs, size }: { dx: number; delayMs: number; size: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withTiming(1, { duration: 1150, easing: Easing.out(Easing.quad) }),
    );
  }, [delayMs, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.75, 1], [0, 1, 0.85, 0]),
    transform: [
      { translateX: dx },
      { translateY: interpolate(progress.value, [0, 1], [4, -40]) },
      { scale: interpolate(progress.value, [0, 0.3, 1], [0.5, 1.05, 0.9]) },
    ],
  }));
  return (
    <Animated.View style={[styles.petHeart, style]}>
      <PixelIcon name="heart" size={size} />
    </Animated.View>
  );
}

/** Affection-only feedback for petting: pure delight, never a care stat. */
function PetHeartsBurst() {
  return (
    <View pointerEvents="none" style={styles.petHearts}>
      <PetHeart dx={-26} delayMs={0} size={15} />
      <PetHeart dx={2} delayMs={110} size={21} />
      <PetHeart dx={26} delayMs={220} size={14} />
    </View>
  );
}

/**
 * The traveling care twin: walks the roam plan's floor waypoints with the
 * side-profile walk strip (mirrored when heading right), idles on arrival,
 * and holds position while a reaction plays.
 */
function RoamingTwinRig({
  plan,
  stageWidth,
  stageHeight,
  dwellAction,
  overrideAction,
  overrideKey,
  avatarConfig,
  glowColor,
  petName,
  onPet,
}: RoamingTwinRigProps) {
  const [legIndex, setLegIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  const [facing, setFacing] = useState<RoamFacing>("left");
  const [petBurstId, setPetBurstId] = useState<number | null>(null);
  const petBurstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paused = Boolean(overrideAction);
  // Reduce Motion: freeze the roam - the twin holds its anchor instead of
  // walking the room (and the walk-bob below stays settled).
  const reduced = useReducedMotion();

  useEffect(
    () => () => {
      if (petBurstTimer.current) clearTimeout(petBurstTimer.current);
    },
    [],
  );

  const handlePet = () => {
    setPetBurstId(Date.now());
    if (petBurstTimer.current) clearTimeout(petBurstTimer.current);
    petBurstTimer.current = setTimeout(() => setPetBurstId(null), 1500);
    onPet?.();
  };

  const toPx = (xPct: number, yPct: number) => ({
    x: (xPct / 100) * stageWidth,
    y: (yPct / 100) * stageHeight,
  });

  const anchorPx = toPx(plan.anchor.xPct, plan.anchor.yPct);
  const xPx = useSharedValue(anchorPx.x);
  const yPx = useSharedValue(anchorPx.y);
  const depth = useSharedValue(plan.anchor.scale);
  const walkBob = useSharedValue(0);

  useEffect(() => {
    setLegIndex(0);
    setMoving(false);
    setFacing("left");
    // A new plan re-anchors the twin. Glide there instead of snapping -
    // the instant reassignment here was the single-frame ~70px teleport
    // whenever the scene or behavior changed mid-walk. withTiming also
    // cancels any stale walk tween from the previous plan.
    const anchorX = (plan.anchor.xPct / 100) * stageWidth;
    const anchorY = (plan.anchor.yPct / 100) * stageHeight;
    const glide = {
      duration: roamGlideMs(
        Math.hypot(anchorX - xPx.value, anchorY - yPx.value),
      ),
      easing: Easing.inOut(Easing.quad),
    };
    xPx.value = withTiming(anchorX, glide);
    yPx.value = withTiming(anchorY, glide);
    depth.value = withTiming(plan.anchor.scale, glide);
  }, [depth, plan, stageHeight, stageWidth, xPx, yPx]);

  useEffect(() => {
    if (paused || reduced) {
      cancelAnimation(xPx);
      cancelAnimation(yPx);
      cancelAnimation(depth);
      setMoving(false);
      return;
    }
    const leg = plan.legs[legIndex % plan.legs.length];
    setFacing(leg.facing);
    if (leg.kind === "walk") {
      setMoving(true);
      const target = (leg.to.xPct / 100) * stageWidth;
      const targetY = (leg.to.yPct / 100) * stageHeight;
      const timing = { duration: leg.durationMs, easing: Easing.linear };
      xPx.value = withTiming(target, timing);
      yPx.value = withTiming(targetY, timing);
      depth.value = withTiming(leg.to.scale, timing);
    } else {
      setMoving(false);
      // Ground the dwell pose with a short glide: a plan reset can land
      // here while a stale walk tween from the previous plan is still
      // running, and withTiming both cancels it and eases out any residual
      // offset instead of snapping it away in a single frame.
      const targetX = (leg.from.xPct / 100) * stageWidth;
      const targetY = (leg.from.yPct / 100) * stageHeight;
      const glide = {
        duration: roamGlideMs(
          Math.hypot(targetX - xPx.value, targetY - yPx.value),
        ),
        easing: Easing.out(Easing.quad),
      };
      xPx.value = withTiming(targetX, glide);
      yPx.value = withTiming(targetY, glide);
      depth.value = withTiming(leg.from.scale, glide);
    }
    const timer = setTimeout(() => {
      setLegIndex((index) => (index + 1) % plan.legs.length);
    }, leg.durationMs);
    return () => clearTimeout(timer);
  }, [depth, legIndex, paused, plan, reduced, stageHeight, stageWidth, xPx, yPx]);

  useEffect(() => {
    if (moving && !paused && !reduced) {
      walkBob.value = 0;
      walkBob.value = withRepeat(
        withTiming(1, {
          duration: ROAM_BOB_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      );
      return;
    }
    cancelAnimation(walkBob);
    walkBob.value = withTiming(0, { duration: 220 });
  }, [moving, paused, reduced, walkBob]);

  const activeAction = resolveRoamingTwinSpriteAction({
    moving,
    dwellAction,
    overrideAction,
  });
  const runtime = useMemo(
    () =>
      avatarConfig
        ? deriveAvatarRoomRuntime(avatarConfig, activeAction)
        : null,
    [activeAction, avatarConfig],
  );
  const spriteAsset =
    runtime?.spriteAsset ?? getCareTwinSpriteAsset(activeAction);
  const spriteTrack =
    runtime?.spriteTrack ?? CARE_TWIN_SPRITE_MANIFEST[activeAction];
  // Accessory art is fitted to the template sprite-pack geometry; over the
  // Phoenix action strips it lands at the wrong scale, so it only rides
  // along when the runtime actually uses the template pack.
  const showAccessoryLayers = runtime?.spriteMode === "template-idle-walk-pack";

  const rigStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: xPx.value },
      { translateY: yPx.value - walkBob.value * 3 },
      { scale: depth.value },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.32 - walkBob.value * 0.07,
    transform: [
      { scaleX: 1.18 + walkBob.value * 0.07 },
      { scaleY: 1 - walkBob.value * 0.05 },
    ],
  }));

  if (!spriteAsset || !spriteTrack) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.roamRig, rigStyle]}
      testID="care-twin-roaming-rig"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.spriteGroundShadow,
          { backgroundColor: "rgba(8,20,36,0.55)" },
          shadowStyle,
        ]}
      />
      {petBurstId ? <PetHeartsBurst key={petBurstId} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Pet ${petName ?? "your dog"}`}
        accessibilityHint="A little affection - hearts and a tail wag."
        onPress={handlePet}
        style={[
          styles.roamFlip,
          facing === "right" ? styles.roamFlipMirrored : null,
        ]}
      >
        <Animated.View style={styles.poseSettleFade}>
          {showAccessoryLayers
            ? runtime?.underlayLayers.map((layer) =>
                layer.source ? (
                  <Animated.Image
                    key={`roam-underlay-${layer.id}`}
                    source={layer.source}
                    resizeMode="contain"
                    style={[
                      styles.avatarAccessoryLayer,
                      styles.avatarAccessoryUnderlay,
                      pixelImageStyle,
                    ]}
                  />
                ) : null,
              )
            : null}
          <SpriteSheetPlayer
            key={
              overrideKey !== null && activeAction === overrideAction
                ? `roam-${overrideKey}-${activeAction}`
                : `roam-${activeAction}`
            }
            asset={spriteAsset}
            height={ROAM_RIG_SIZE}
            testID="care-twin-roaming-sprite-player"
            track={spriteTrack}
            width={ROAM_RIG_SIZE}
          />
          {showAccessoryLayers
            ? runtime?.overlayLayers.map((layer) =>
                layer.source ? (
                  <Animated.Image
                    key={`roam-overlay-${layer.id}`}
                    source={layer.source}
                    resizeMode="contain"
                    style={[
                      styles.avatarAccessoryLayer,
                      styles.avatarAccessoryOverlay,
                      pixelImageStyle,
                    ]}
                  />
                ) : null,
              )
            : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#081A2A",
  },
  rootTransparent: {
    backgroundColor: "transparent",
  },
  pixelFrame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
    borderWidth: 2,
    borderColor: "rgba(8,26,42,0.72)",
  },
  frameCorner: {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "#FFF9EF",
    opacity: 0.82,
  },
  frameCornerTopLeft: {
    left: 8,
    top: 8,
    borderLeftWidth: 2,
    borderTopWidth: 2,
  },
  frameCornerTopRight: {
    right: 8,
    top: 8,
    borderRightWidth: 2,
    borderTopWidth: 2,
  },
  frameCornerBottomLeft: {
    left: 8,
    bottom: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
  },
  frameCornerBottomRight: {
    right: 8,
    bottom: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  scene: {
    position: "absolute",
    left: "-2%",
    top: "-2%",
    width: "104%",
    height: "104%",
  },
  scanline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(8,26,42,0.08)",
    zIndex: 3,
  },
  dogFocus: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#FFF9EF",
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  spriteRig: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 4,
  },
  roamRig: {
    position: "absolute",
    left: 0,
    // Bottom-aligned rig: shifting top by the size delta keeps the paws on the
    // same floor line as the old 150px rig now that the twin is smaller.
    top: ROAM_RIG_BASELINE - ROAM_RIG_SIZE,
    width: ROAM_RIG_SIZE,
    height: ROAM_RIG_SIZE,
    alignItems: "center",
    justifyContent: "flex-end",
    zIndex: 4,
  },
  roamFlip: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  roamFlipMirrored: {
    transform: [{ scaleX: -1 }],
  },
  poseSettleFade: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  petHearts: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -6,
    alignItems: "center",
    zIndex: 4,
  },
  petHeart: {
    position: "absolute",
    top: 0,
  },
  awayCue: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: 14,
    zIndex: 5,
  },
  awayCueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(251, 246, 231, 0.94)",
    borderColor: "rgba(38, 34, 28, 0.16)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  awayCueTitle: {
    color: OVERLAY_INK,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  awayCueDetail: {
    color: OVERLAY_MUTED_INK,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginTop: 1,
  },
  spriteGroundShadow: {
    position: "absolute",
    left: "18%",
    right: "18%",
    bottom: 6,
    height: 18,
    borderRadius: 999,
    opacity: 0.35,
    transform: [{ scaleX: 1.25 }],
  },
  avatarAccessoryLayer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  avatarAccessoryUnderlay: {
    zIndex: 1,
  },
  avatarAccessoryOverlay: {
    zIndex: 5,
  },
  fallbackAvatar: {
    width: "100%",
    height: "100%",
  },
  spark: {
    position: "absolute",
    shadowColor: "#FFF9EF",
    shadowOpacity: 0.82,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  topHud: {
    position: "absolute",
    top: 11,
    left: 11,
    right: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    zIndex: 6,
  },
  liveChip: {
    maxWidth: 178,
    minHeight: 38,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    color: "#FFF9EF",
    fontFamily: "Fredoka_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  liveCopy: {
    flex: 1,
    minWidth: 0,
  },
  liveSubText: {
    color: "rgba(255,249,239,0.72)",
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    marginTop: 1,
  },
  zoneChip: {
    minHeight: 29,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  zoneChipText: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 10,
  },
  speechBubble: {
    position: "absolute",
    top: 50,
    left: 18,
    maxWidth: "46%",
    alignSelf: "flex-start",
    justifyContent: "center",
    borderRadius: 2,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 5,
  },
  speechBubbleCompact: {
    top: 43,
    left: 20,
    maxWidth: "42%",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  speechText: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 14,
    lineHeight: 18,
  },
  speechTextCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  speechTail: {
    position: "absolute",
    left: 18,
    bottom: -9,
    width: 15,
    height: 15,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: "-45deg" }],
  },
  statusPatch: {
    position: "absolute",
    left: 12,
    bottom: 76,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  roomStatsPanel: {
    position: "absolute",
    top: 48,
    right: 12,
    width: 126,
    borderRadius: 4,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 7,
    zIndex: 6,
    shadowColor: "#081424",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  roomStatsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  roomStatsTitle: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 9,
    letterSpacing: 0.8,
  },
  roomStatsSignal: {
    width: 8,
    height: 7,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(8,26,42,0.2)",
  },
  roomStatsSignalWrap: {
    flexDirection: "row",
    gap: 2,
  },
  roomStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roomStatCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  roomStatTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  roomStatLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    textTransform: "uppercase",
  },
  roomStatValue: {
    maxWidth: 48,
    fontFamily: "Fredoka_700Bold",
    fontSize: 10,
  },
  roomStatBlocks: {
    flexDirection: "row",
    gap: 2,
  },
  roomStatBlock: {
    flex: 1,
    height: 8,
    minWidth: 4,
    borderRadius: 1,
    borderWidth: 1,
  },
  statusPatchCopy: {
    gap: 1,
  },
  statusPatchKicker: {
    color: "rgba(255,249,239,0.68)",
    fontFamily: "Inter_700Bold",
    fontSize: 8.5,
    textTransform: "uppercase",
  },
  statusPatchValue: {
    color: "#FFF9EF",
    fontFamily: "Fredoka_700Bold",
    fontSize: 12,
  },
  walkMarks: {
    position: "absolute",
    left: "14%",
    top: "58%",
    width: 56,
    height: 42,
    justifyContent: "center",
    gap: 5,
    zIndex: 4,
  },
  walkMark: {
    width: 38,
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(8,26,42,0.35)",
  },
  walkMarkShort: {
    width: 28,
    marginLeft: 10,
  },
  walkMarkTiny: {
    width: 17,
    marginLeft: 18,
  },
  heartTrail: {
    position: "absolute",
    top: "30%",
    right: "15%",
    gap: 4,
    zIndex: 6,
    alignItems: "center",
  },
  sleepBubble: {
    position: "absolute",
    right: "18%",
    top: "35%",
    minWidth: 42,
    minHeight: 32,
    borderRadius: 8,
    backgroundColor: "rgba(8,26,42,0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,249,239,0.26)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  sleepText: {
    color: "#FFF9EF",
    fontFamily: "Fredoka_700Bold",
    fontSize: 16,
  },
  reaction: {
    position: "absolute",
    left: 14,
    bottom: 74,
    right: 132,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 7,
  },
  reactionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  reactionTitle: {
    color: "#FFF9EF",
    fontFamily: "Fredoka_700Bold",
    fontSize: 15,
  },
  reactionDetail: {
    color: "rgba(255,249,239,0.76)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    marginTop: 1,
  },
  actionBurst: {
    position: "absolute",
    top: "37%",
    right: "18%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    zIndex: 8,
  },
  actionSpark: {
    width: 8,
    height: 8,
    borderRadius: 2,
    shadowColor: "#FFF9EF",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  actionBurstText: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 12,
    textShadowColor: "rgba(8,26,42,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  roomDock: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    zIndex: 6,
  },
  dockColumn: {
    flex: 1,
    minWidth: 0,
  },
  dockKicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dockText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    marginTop: 2,
  },
  dockDivider: {
    width: 1,
    height: 28,
  },
  energyDock: {
    width: 72,
    gap: 4,
  },
  energyBlocks: {
    flexDirection: "row",
    gap: 3,
  },
  energyBlock: {
    width: 6,
    height: 13,
    borderWidth: 1,
    borderRadius: 2,
  },
  nextChip: {
    position: "absolute",
    right: 14,
    bottom: 75,
    maxWidth: "55%",
    minHeight: 32,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    zIndex: 5,
  },
  nextText: {
    color: "#FFF9EF",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    flexShrink: 1,
  },
});
