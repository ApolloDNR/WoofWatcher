import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAvatar } from "@/context/AvatarContext";
import type { Mood } from "@/lib/phoenixStatus";

// Soft ambient tint per mood — drives the floating light motes + scene wash.
const MOOD_TINT: Record<Mood, string> = {
  happy: "#FFE9A8",
  excited: "#FFD37A",
  calm: "#CFE7D2",
  anxious: "#CBD8EE",
  unwell: "#E6D6EC",
};

// Tap reactions per mood — playful one-liners.
const BARKS: Record<Mood, string[]> = {
  happy: ["Woof! 💛", "Hi friend!", "Boop!"],
  excited: ["Let's GO!", "Walk?! 🐾", "Zoomies!"],
  calm: ["Mmm, cozy.", "*tail wag*", "Hello."],
  anxious: ["Stay close?", "*nuzzles*", "Hi…"],
  unwell: ["I'm okay…", "*soft woof*", "Thanks."],
};

// ---- Time-of-day ambient wash -------------------------------------------------

function dayPhaseGradient(hour: number): [string, string, string] {
  // top → mid → bottom, low-alpha so the painted scene reads through.
  if (hour >= 5 && hour < 11) {
    // morning — warm peach light
    return ["rgba(255,214,153,0.30)", "rgba(255,236,210,0.05)", "rgba(255,196,140,0.16)"];
  }
  if (hour >= 11 && hour < 17) {
    // midday — bright airy
    return ["rgba(208,233,247,0.26)", "rgba(255,255,255,0.04)", "rgba(180,214,196,0.16)"];
  }
  if (hour >= 17 && hour < 21) {
    // evening — golden hour
    return ["rgba(255,176,110,0.30)", "rgba(255,210,170,0.06)", "rgba(150,96,60,0.24)"];
  }
  // night — deep indigo calm
  return ["rgba(70,86,140,0.34)", "rgba(40,52,96,0.08)", "rgba(22,30,60,0.34)"];
}

// ---- Floating light mote ------------------------------------------------------

interface MoteProps {
  index: number;
  tint: string;
}

function Mote({ index, tint }: MoteProps) {
  const progress = useSharedValue(0);
  const startLeft = 6 + ((index * 17) % 86);
  const size = 5 + (index % 4) * 4;
  const dur = 5200 + (index % 5) * 1100;
  const drift = (index % 2 === 0 ? 1 : -1) * (12 + (index % 3) * 9);
  const peak = 0.18 + (index % 3) * 0.08;

  useEffect(() => {
    progress.value = withDelay(
      index * 520,
      withRepeat(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [index, dur, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.2 ? (p / 0.2) * peak : p > 0.78 ? ((1 - p) / 0.22) * peak : peak;
    return {
      opacity,
      transform: [
        { translateY: -p * 130 },
        { translateX: Math.sin(p * Math.PI * 2) * drift },
        { scale: 0.6 + p * 0.7 },
      ],
    };
  });

  return (
    <Animated.View
      style={[{ pointerEvents: "none" }, 
        styles.mote,
        { left: `${startLeft}%`, width: size, height: size, borderRadius: size / 2, backgroundColor: tint },
        style,
      ]}
    />
  );
}

const MOTE_COUNT = 9;

// ---- Living avatar ------------------------------------------------------------

interface Props {
  mood: Mood;
  speech?: string;
  onTap?: () => void;
}

export function AnimatedAvatar({ mood, speech, onTap }: Props) {
  const { getAvatarSource } = useAvatar();

  // Mood cross-fade (the ONLY thing that moves on the dog: opacity).
  const fade = useSharedValue(1);
  const [displayMood, setDisplayMood] = useState<Mood>(mood);
  const prevMood = useRef<Mood>(mood);

  // Tap reaction — one-shot, no idle motion.
  const idle = useSharedValue(0);
  const tap = useSharedValue(0);

  const [bark, setBark] = useState<string | null>(null);
  const barkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hour = new Date().getHours();
  const phase = dayPhaseGradient(hour);
  const tint = MOOD_TINT[displayMood];

  useEffect(() => {
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1320, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1320, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(idle);
  }, [idle]);

  // Mood change cross-fade
  useEffect(() => {
    if (mood === displayMood) return;
    prevMood.current = displayMood;
    setDisplayMood(mood);
    fade.value = 0;
    fade.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [mood, displayMood, fade]);

  useEffect(() => {
    return () => {
      if (barkTimer.current) clearTimeout(barkTimer.current);
    };
  }, []);

  const showBark = () => {
    const lines = BARKS[displayMood];
    setBark(lines[Math.floor(Math.random() * lines.length)]);
    if (barkTimer.current) clearTimeout(barkTimer.current);
    barkTimer.current = setTimeout(() => setBark(null), 1400);
  };

  const handleTap = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    // gentle one-shot acknowledgement — dog is otherwise perfectly still
    tap.value = withSequence(
      withSpring(1, { damping: 7, stiffness: 240 }),
      withSpring(0, { damping: 10, stiffness: 170 }),
    );
    runOnJS(showBark)();
    onTap?.();
  };

  const tapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -idle.value * 3 - tap.value * 4 },
      { scaleX: 1 + idle.value * 0.012 + tap.value * 0.03 },
      { scaleY: 1 - idle.value * 0.008 + tap.value * 0.018 },
    ],
  }));

  const topStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const prevSource = getAvatarSource(prevMood.current);
  const currentSource = getAvatarSource(displayMood);
  const crossfading = prevMood.current !== displayMood;

  return (
    <Pressable onPress={handleTap} style={styles.root}>
      {/* still dog scene — previous emotion underneath, current fades in on top */}
      <Animated.View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }, tapStyle]}>
        {crossfading && (
          <Animated.Image source={prevSource} style={styles.scene} resizeMode="contain" />
        )}
        <Animated.Image
          source={currentSource}
          style={[styles.scene, StyleSheet.absoluteFill, topStyle]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* animated ambient background: time-of-day wash + drifting light motes */}
      <LinearGradient
        colors={phase}
        locations={[0, 0.5, 1]}
        style={[{ pointerEvents: "none" }, StyleSheet.absoluteFill]}
      />
      <View style={[{ pointerEvents: "none" }, styles.moteLayer]}>
        {Array.from({ length: MOTE_COUNT }).map((_, i) => (
          <Mote key={`${displayMood}-${i}`} index={i} tint={tint} />
        ))}
      </View>

      {/* speech bubble — persistent mood line, swapped for a fun bark on tap */}
      {(bark || speech) && (
        <View style={[{ pointerEvents: "none" }, styles.barkWrap]}>
          <View style={[styles.barkBubble, bark && styles.barkBubbleActive]}>
            <Text style={[styles.barkText, !bark && styles.speechText]}>{bark ?? speech}</Text>
          </View>
          <View style={[styles.barkTail, bark && styles.barkTailActive]} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  scene: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  moteLayer: { ...StyleSheet.absoluteFillObject },
  mote: {
    position: "absolute",
    bottom: "30%",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  barkWrap: {
    position: "absolute",
    top: "9%",
    right: "6%",
    alignItems: "flex-end",
    maxWidth: "62%",
  },
  barkBubble: {
    backgroundColor: "rgba(255,255,255,0.97)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#0F1F33",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  barkBubbleActive: { backgroundColor: "#2E5846" },
  barkTail: {
    width: 14,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    transform: [{ rotate: "45deg" }],
    marginTop: -7,
    marginRight: 22,
    borderRadius: 3,
  },
  barkTailActive: { backgroundColor: "#2E5846" },
  barkText: { fontSize: 14.5, color: "#FFFFFF", fontWeight: "700" },
  speechText: { color: "#1F2D27", fontWeight: "600" },
});
