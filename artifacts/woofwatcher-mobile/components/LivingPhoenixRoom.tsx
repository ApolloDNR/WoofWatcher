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
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
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
import { deriveCareTwinScene, type AvatarRoomZone, type CareTwinHudTone } from "@/lib/avatarLifeEngine";
import type { AvatarMotionModel } from "@/lib/avatarMotion";
import type { Mood } from "@/lib/phoenixStatus";

const ROOM_SCENE = require("@/assets/board/hero.png");

const STATE_SCENES: Record<Mood, ImageSourcePropType> = {
  happy: ROOM_SCENE,
  excited: ROOM_SCENE,
  calm: ROOM_SCENE,
  anxious: ROOM_SCENE,
  unwell: ROOM_SCENE,
};

const PHOENIX_FALLBACK_AVATARS: Record<Mood, ImageSourcePropType> = {
  happy: require("@/assets/avatar/phoenix/approved/phoenix-main-avatar-v2.png"),
  excited: require("@/assets/avatar/phoenix/approved/phoenix-proud-happy-v2.png"),
  calm: require("@/assets/avatar/phoenix/approved/phoenix-main-avatar-v2.png"),
  anxious: require("@/assets/avatar/phoenix/approved/phoenix-home-alone-anxious-v2.png"),
  unwell: require("@/assets/avatar/phoenix/approved/phoenix-sleep-rest-v2.png"),
};

export interface PhoenixRoomReaction {
  id: number;
  icon: PixelIconName;
  label: string;
  detail?: string;
  tone?: string;
}

interface Props {
  mood: Mood;
  motion: AvatarMotionModel;
  speech: string;
  energy: number;
  presenceLabel: string;
  nextLabel: string;
  reaction?: PhoenixRoomReaction | null;
  onPress?: () => void;
}

type PercentString = `${number}%`;

const MOOD_THEME: Record<Mood, { glow: string; wash: string; accent: string; status: PixelIconName }> = {
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

const ROOM_ZONES: Record<AvatarRoomZone, { x: number; y: number; scale: number; icon: PixelIconName; label: string }> = {
  rug: { x: 0, y: 0, scale: 1, icon: "heart", label: "On the rug" },
  door: { x: -18, y: -4, scale: 1.015, icon: "walk", label: "Door check" },
  bowl: { x: 16, y: 9, scale: 1.01, icon: "meal", label: "Bowl time" },
  bed: { x: 18, y: 11, scale: 0.995, icon: "clock", label: "Soft rest" },
  window: { x: -11, y: -9, scale: 1.008, icon: "happy", label: "Window watch" },
};

const FOCUS_SPOTS: Record<AvatarRoomZone, { left: PercentString; top: PercentString; width: PercentString; height: PercentString }> = {
  rug: { left: "18%", top: "25%", width: "47%", height: "55%" },
  door: { left: "10%", top: "24%", width: "45%", height: "54%" },
  bowl: { left: "48%", top: "59%", width: "38%", height: "24%" },
  bed: { left: "62%", top: "36%", width: "34%", height: "36%" },
  window: { left: "30%", top: "8%", width: "42%", height: "32%" },
};

const SPRITE_STAGE_ZONES: Record<AvatarRoomZone, { left: PercentString; top: PercentString; width: number; height: number }> = {
  rug: { left: "29%", top: "36%", width: 164, height: 164 },
  door: { left: "18%", top: "34%", width: 164, height: 164 },
  bowl: { left: "49%", top: "48%", width: 148, height: 148 },
  bed: { left: "57%", top: "41%", width: 154, height: 154 },
  window: { left: "35%", top: "25%", width: 154, height: 154 },
};

const HUD_TONE_COLOR: Record<CareTwinHudTone, string> = {
  steady: "#6DA36F",
  happy: "#D8A852",
  urgent: "#C96358",
  soft: "#A8CBE8",
  reward: "#E07A2F",
};

const PIXEL_SPARKS: { left: PercentString; top: PercentString; size: number }[] = [
  { left: "8%", top: "19%", size: 4 },
  { left: "18%", top: "63%", size: 3 },
  { left: "42%", top: "12%", size: 4 },
  { left: "69%", top: "21%", size: 3 },
  { left: "84%", top: "55%", size: 4 },
  { left: "58%", top: "75%", size: 3 },
];

function energyBlocks(value: number): boolean[] {
  const filled = Math.max(1, Math.min(8, Math.round((Math.max(0, Math.min(100, value)) / 100) * 8)));
  return Array.from({ length: 8 }).map((_, index) => index < filled);
}

function speechLines(speech: string): string[] {
  return speech
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function LivingPhoenixRoom({
  mood,
  motion,
  speech,
  energy,
  presenceLabel,
  nextLabel,
  reaction,
  onPress,
}: Props) {
  const colors = useColors();
  const theme = MOOD_THEME[mood];
  const plan = useMemo(() => deriveCareTwinScene(motion), [motion]);
  const zone = ROOM_ZONES[plan.zone];
  const focusSpot = FOCUS_SPOTS[plan.zone];
  const spriteZone = SPRITE_STAGE_ZONES[plan.zone];
  const sceneSource = STATE_SCENES[mood];
  const spriteAsset = useMemo(() => getCareTwinSpriteAsset(plan.spriteAction), [plan.spriteAction]);
  const roomLayer = useMemo(() => getCareTwinRoomLayer(mood, plan.spriteAction), [mood, plan.spriteAction]);
  const layerReadiness = useMemo(() => getCareTwinLayerReadiness(plan.spriteAction, mood), [mood, plan.spriteAction]);
  const layeredStageReady = layerReadiness.layeredReady && Boolean(spriteAsset && roomLayer);
  const roomStageReady = Boolean(roomLayer);
  const stageSource = roomLayer?.source ?? sceneSource;
  const fallbackAvatarSource = PHOENIX_FALLBACK_AVATARS[mood];
  const useFallbackAvatarLayer = roomStageReady && !layeredStageReady;
  const animateBakedScene = !roomStageReady && !layeredStageReady;
  const lines = useMemo(() => speechLines(speech), [speech]);
  const hudAccent = HUD_TONE_COLOR[plan.hudTone] ?? theme.accent;
  const [activeReaction, setActiveReaction] = useState<PhoenixRoomReaction | null>(reaction ?? null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const breath = useSharedValue(0);
  const walkCycle = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const tap = useSharedValue(0);
  const zoneX = useSharedValue(zone.x);
  const zoneY = useSharedValue(zone.y);
  const zoneScale = useSharedValue(zone.scale);
  const reactionProgress = useSharedValue(0);

  useEffect(() => {
    zoneX.value = withSpring(zone.x, { damping: 17, stiffness: 72 });
    zoneY.value = withSpring(zone.y, { damping: 17, stiffness: 72 });
    zoneScale.value = withSpring(zone.scale, { damping: 17, stiffness: 82 });
  }, [plan.zone, zone.x, zone.y, zone.scale, zoneScale, zoneX, zoneY]);

  useEffect(() => {
    breath.value = 0;
    breath.value = withRepeat(
      withTiming(1, { duration: plan.paceMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );

    walkCycle.value = 0;
    walkCycle.value = withRepeat(
      withTiming(1, { duration: Math.max(760, Math.round(plan.paceMs * 0.62)), easing: Easing.linear }),
      -1,
      false,
    );
  }, [breath, plan.animation, plan.paceMs, walkCycle]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [shimmer]);

  useEffect(() => {
    if (!reaction) return;
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    setActiveReaction(reaction);
    reactionProgress.value = 0;
    reactionProgress.value = withSequence(
      withSpring(1, { damping: 9, stiffness: 120 }),
      withDelay(1250, withTiming(0, { duration: 260 })),
    );
    reactionTimer.current = setTimeout(() => setActiveReaction(null), 1680);
    return () => {
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
    };
  }, [reaction, reactionProgress]);

  const isWalking = plan.animation === "walk";
  const isEating = plan.animation === "eat" || plan.animation === "drink";
  const isSleeping = plan.animation === "sleep";
  const isCelebrate = plan.animation === "celebrate";
  const isComfort = plan.animation === "comfort";

  const sceneMotionStyle = useAnimatedStyle(() => {
    const wave = Math.sin(walkCycle.value * Math.PI * 2);
    const step = isWalking ? wave : 0;
    const chew = isEating ? Math.sin(walkCycle.value * Math.PI * 4) : 0;
    const celebration = isCelebrate ? Math.abs(wave) : 0;
    const comfortTilt = isComfort ? -0.45 : 0;
    const sleepDrift = isSleeping ? breath.value * 1.2 : 0;

    return {
      transform: [
        { translateX: zoneX.value * 0.1 + step * 3 },
        { translateY: zoneY.value * 0.08 - breath.value * plan.breathLift * 0.22 - celebration * 1.5 + chew * 0.8 + sleepDrift - tap.value * 3 },
        { scale: zoneScale.value * (1.018 + breath.value * plan.breathScale * 0.62 + tap.value * 0.01) },
        { rotate: `${step * 0.55 + chew * 0.18 + comfortTilt + tap.value * -0.55}deg` },
      ],
    };
  }, [isCelebrate, isComfort, isEating, isSleeping, isWalking, plan.breathLift, plan.breathScale]);

  const spriteRigStyle = useAnimatedStyle(() => {
    const wave = Math.sin(walkCycle.value * Math.PI * 2);
    const step = isWalking ? wave : 0;
    const chew = isEating ? Math.sin(walkCycle.value * Math.PI * 4) : 0;
    const celebration = isCelebrate ? Math.abs(wave) : 0;
    const comfortTilt = isComfort ? -1.2 : 0;
    const sleepDrift = isSleeping ? breath.value * 2.2 : 0;

    return {
      transform: [
        { translateX: zoneX.value * 0.55 + step * 8 },
        { translateY: zoneY.value * 0.32 - breath.value * plan.breathLift - celebration * 6 + chew * 2 + sleepDrift - tap.value * 8 },
        { scale: zoneScale.value * (1 + breath.value * plan.breathScale + tap.value * 0.025) },
        { rotate: `${step * 1.4 + chew * 0.6 + comfortTilt + tap.value * -1.4}deg` },
      ],
    };
  }, [isCelebrate, isComfort, isEating, isSleeping, isWalking, plan.breathLift, plan.breathScale]);

  const dogFocusGlow = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 0.5, 1], [0.16, plan.showCareAura ? 0.46 : 0.28, 0.16]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.96, 1.08]) }],
  }));

  const activeZoneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breath.value, [0, 1], [1, 1.08]) }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.18, 0.58]),
    transform: [{ translateY: interpolate(shimmer.value, [0, 1], [4, -7]) }],
  }));

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
      { scale: interpolate(reactionProgress.value, [0, 0.35, 1], [0.8, 1.15, 1]) },
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
      accessibilityLabel={`Phoenix room. ${motion.label}. ${plan.tapVerb}. ${speech}`}
      onPress={handlePress}
      style={styles.root}
    >
      <Animated.Image
        source={stageSource}
        resizeMode="cover"
        style={[styles.scene, animateBakedScene ? sceneMotionStyle : null]}
      />
      <LinearGradient
        colors={[theme.wash, "rgba(255,249,239,0)", "rgba(8,20,36,0.28)"]}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.dogFocus,
          focusSpot,
          { backgroundColor: theme.glow, borderColor: theme.accent },
          dogFocusGlow,
        ]}
      />

      {layeredStageReady ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.spriteRig,
            {
              left: spriteZone.left,
              top: spriteZone.top,
              width: spriteZone.width,
              height: spriteZone.height,
            },
            spriteRigStyle,
          ]}
          testID="care-twin-layered-sprite-rig"
        >
          <View style={[styles.spriteGroundShadow, { backgroundColor: theme.glow }]} />
          <SpriteSheetPlayer
            asset={spriteAsset}
            height={spriteZone.height}
            track={plan.spriteTrack}
            width={spriteZone.width}
          />
        </Animated.View>
      ) : null}

      {useFallbackAvatarLayer ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.spriteRig,
            {
              left: spriteZone.left,
              top: spriteZone.top,
              width: spriteZone.width,
              height: spriteZone.height,
            },
            spriteRigStyle,
          ]}
          testID="care-twin-fallback-avatar-rig"
        >
          <View style={[styles.spriteGroundShadow, { backgroundColor: theme.glow }]} />
          <Animated.Image
            source={fallbackAvatarSource}
            resizeMode="contain"
            style={styles.fallbackAvatar}
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
        <View style={[styles.liveChip, { backgroundColor: "rgba(8, 26, 42, 0.88)", borderColor: "rgba(255,249,239,0.22)" }]}>
          <Animated.View style={[styles.liveDot, { backgroundColor: hudAccent }, activeZoneStyle]} />
          <Text style={styles.liveText}>LIVE CARE TWIN</Text>
        </View>
        <Animated.View
          style={[
            styles.zoneChip,
            { backgroundColor: "rgba(255,249,239,0.93)", borderColor: theme.accent },
            activeZoneStyle,
          ]}
        >
          <PixelIcon name={zone.icon} size={15} />
          <Text style={[styles.zoneChipText, { color: colors.navy }]}>{zone.label}</Text>
        </Animated.View>
      </View>

      <View style={[styles.speechBubble, { backgroundColor: "rgba(255,249,239,0.94)", borderColor: colors.navy }]}>
        {(lines.length ? lines : ["I'm ready."]).map((line) => (
          <Text key={line} style={[styles.speechText, { color: colors.navy }]}>
            {line}
          </Text>
        ))}
        <View style={[styles.speechTail, { backgroundColor: "rgba(255,249,239,0.94)", borderColor: colors.navy }]} />
      </View>

      <View style={[styles.statusPatch, { backgroundColor: "rgba(8,26,42,0.78)", borderColor: "rgba(255,249,239,0.2)" }]}>
        <PixelIcon name={theme.status} size={22} />
        <View style={styles.statusPatchCopy}>
          <Text style={styles.statusPatchKicker}>{plan.scenePhase.replace("-", " ")}</Text>
          <Text style={styles.statusPatchValue}>{plan.moodLabel}</Text>
        </View>
      </View>

      {isWalking ? (
        <Animated.View pointerEvents="none" style={[styles.walkMarks, shimmerStyle]}>
          <View style={[styles.walkMark, { backgroundColor: theme.accent }]} />
          <View style={[styles.walkMark, styles.walkMarkShort, { backgroundColor: theme.accent }]} />
          <View style={[styles.walkMark, styles.walkMarkTiny, { backgroundColor: theme.accent }]} />
        </Animated.View>
      ) : null}

      {plan.showHearts ? (
        <Animated.View pointerEvents="none" style={[styles.heartTrail, shimmerStyle]}>
          <PixelIcon name="heart" size={18} />
          <PixelIcon name="heart" size={12} />
        </Animated.View>
      ) : null}

      {plan.showSleep ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} pointerEvents="none" style={[styles.sleepBubble, shimmerStyle]}>
          <Text style={styles.sleepText}>Zz</Text>
        </Animated.View>
      ) : null}

      {activeReaction ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.reaction,
            reactionStyle,
            { backgroundColor: activeReaction.tone ?? colors.brandNavy, borderColor: "rgba(255,249,239,0.32)" },
          ]}
        >
          <PixelIcon name={activeReaction.icon} size={24} />
          <View style={styles.reactionTextWrap}>
            <Text style={styles.reactionTitle}>{activeReaction.label}</Text>
            {activeReaction.detail ? <Text style={styles.reactionDetail}>{activeReaction.detail}</Text> : null}
          </View>
        </Animated.View>
      ) : null}

      {activeReaction ? (
        <Animated.View pointerEvents="none" style={[styles.actionBurst, burstStyle]}>
          <View style={[styles.actionSpark, { backgroundColor: theme.accent }]} />
          <Text style={[styles.actionBurstText, { color: theme.accent }]}>+ care</Text>
          <View style={[styles.actionSpark, { backgroundColor: "#FFF9EF" }]} />
        </Animated.View>
      ) : null}

      <View style={[styles.roomDock, { backgroundColor: "rgba(255,249,239,0.94)", borderColor: "rgba(8,26,42,0.12)" }]}>
        <View style={styles.dockColumn}>
          <Text style={[styles.dockKicker, { color: colors.mutedForeground }]}>Presence</Text>
          <Text numberOfLines={1} style={[styles.dockText, { color: colors.navy }]}>{presenceLabel}</Text>
        </View>
        <View style={[styles.dockDivider, { backgroundColor: colors.border }]} />
        <View style={styles.dockColumn}>
          <Text style={[styles.dockKicker, { color: colors.mutedForeground }]}>Care cue</Text>
          <Text numberOfLines={1} style={[styles.dockText, { color: colors.navy }]}>{plan.recommendedActionLabel}</Text>
        </View>
        <View style={[styles.dockDivider, { backgroundColor: colors.border }]} />
        <View style={styles.energyDock}>
          <Text style={[styles.dockKicker, { color: colors.mutedForeground }]}>Energy</Text>
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

      <View style={[styles.nextChip, { backgroundColor: "rgba(8,26,42,0.86)", borderColor: "rgba(255,249,239,0.2)" }]}>
        <PixelIcon name={zone.icon} size={18} />
        <Text numberOfLines={1} style={styles.nextText}>{plan.activityLabel} - {nextLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: "#081A2A",
  },
  scene: {
    position: "absolute",
    left: "-2%",
    top: "-2%",
    width: "104%",
    height: "104%",
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
    minHeight: 28,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
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
    letterSpacing: 0.7,
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
    top: "16%",
    right: "5%",
    width: "44%",
    minHeight: 82,
    borderRadius: 2,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
    zIndex: 5,
  },
  speechText: {
    fontFamily: "Fredoka_700Bold",
    fontSize: 14,
    lineHeight: 18,
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
