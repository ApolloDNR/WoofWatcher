import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import type { Mood } from "@/lib/phoenixStatus";

const SCENE = require("@/assets/phoenix/scene.png");

const CUTOUTS: Record<Mood, any> = {
  happy: require("@/assets/phoenix/cutout/phoenix-happy.png"),
  excited: require("@/assets/phoenix/cutout/phoenix-excited.png"),
  calm: require("@/assets/phoenix/cutout/phoenix-calm.png"),
  anxious: require("@/assets/phoenix/cutout/phoenix-anxious.png"),
  unwell: require("@/assets/phoenix/cutout/phoenix-unwell.png"),
};

// Floating emotes per mood — small drifting glyphs that give life
const EMOTES: Record<Mood, string[]> = {
  happy: ["💚", "✨", "🐾"],
  excited: ["⚡", "🐾", "❗"],
  calm: ["☁️", "💤", "🍃"],
  anxious: ["💧", "🫧", "…"],
  unwell: ["🤍", "🌡️", "·"],
};

// Tap reactions per mood — playful one-liners
const BARKS: Record<Mood, string[]> = {
  happy: ["Woof! 💛", "Hi friend!", "Boop!"],
  excited: ["Let's GO!", "Walk?! 🐾", "Zoomies!"],
  calm: ["Mmm, cozy.", "*tail wag*", "Hello."],
  anxious: ["Stay close?", "*nuzzles*", "Hi…"],
  unwell: ["I'm okay…", "*soft woof*", "Thanks."],
};

interface EmoteProps {
  glyph: string;
  delay: number;
  startX: number;
}

function Emote({ glyph, delay, startX }: EmoteProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2900, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [glyph, delay, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
    return {
      opacity,
      transform: [
        { translateY: -p * 86 },
        { translateX: Math.sin(p * Math.PI * 2) * 10 },
        { scale: 0.7 + p * 0.5 },
      ],
    };
  });

  return (
    <Animated.Text
      style={[styles.emote, { left: startX }, style]}
      pointerEvents="none"
    >
      {glyph}
    </Animated.Text>
  );
}

interface Props {
  mood: Mood;
  speech?: string;
  onTap?: () => void;
}

export function AnimatedAvatar({ mood, speech, onTap }: Props) {
  // Idle life
  const breathe = useSharedValue(0);
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const sway = useSharedValue(0);
  // Tap reaction
  const pop = useSharedValue(0);
  const wobble = useSharedValue(0);
  // Mood cross-fade
  const fade = useSharedValue(1);
  const [displayMood, setDisplayMood] = useState<Mood>(mood);
  const prevMood = useRef<Mood>(mood);

  const [bark, setBark] = useState<string | null>(null);
  const barkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle loops
  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    bob.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    tilt.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(bob);
      cancelAnimation(tilt);
      cancelAnimation(sway);
    };
  }, [breathe, bob, tilt, sway]);

  // Mood change cross-fade
  useEffect(() => {
    if (mood === displayMood) return;
    prevMood.current = displayMood;
    setDisplayMood(mood);
    fade.value = 0;
    fade.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
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
    pop.value = withSequence(
      withSpring(1, { damping: 6, stiffness: 220 }),
      withSpring(0, { damping: 9, stiffness: 160 }),
    );
    wobble.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(-1, { duration: 120 }),
      withTiming(0, { duration: 110 }),
    );
    runOnJS(showBark)();
    onTap?.();
  };

  const dogStyle = useAnimatedStyle(() => {
    const breatheScale = 1 + breathe.value * 0.022 + pop.value * 0.07;
    const bobY = -bob.value * 5 - pop.value * 8;
    const tiltDeg = (tilt.value - 0.5) * 3 + wobble.value * 5;
    const swayX = (sway.value - 0.5) * 8;
    return {
      transform: [
        { translateX: swayX },
        { translateY: bobY },
        { scale: breatheScale },
        { rotate: `${tiltDeg}deg` },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const lift = bob.value + pop.value * 1.2;
    return {
      transform: [{ scaleX: 1 - lift * 0.12 }],
      opacity: 0.28 - lift * 0.08,
    };
  });

  const topStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const emoteGlyphs = EMOTES[displayMood];

  return (
    <Pressable onPress={handleTap} style={styles.root}>
      <Image source={SCENE} style={styles.scene} resizeMode="cover" />

      {/* floating emotes */}
      <View style={styles.emoteLayer} pointerEvents="none">
        {emoteGlyphs.map((g, i) => (
          <Emote
            key={`${displayMood}-${i}`}
            glyph={g}
            delay={i * 900}
            startX={`${24 + i * 26}%` as unknown as number}
          />
        ))}
      </View>

      {/* ground shadow */}
      <Animated.View style={[styles.shadow, shadowStyle]} pointerEvents="none" />

      {/* dog — previous mood underneath, current fades in on top */}
      <Animated.View style={[styles.dogWrap, dogStyle]} pointerEvents="none">
        {prevMood.current !== displayMood && (
          <Image source={CUTOUTS[prevMood.current]} style={styles.dog} resizeMode="contain" />
        )}
        <Animated.Image
          source={CUTOUTS[displayMood]}
          style={[styles.dog, StyleSheet.absoluteFill as object, topStyle]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* speech bubble — persistent mood line, swapped for a fun bark on tap */}
      {(bark || speech) && (
        <View style={styles.barkWrap} pointerEvents="none">
          <View style={[styles.barkBubble, bark && styles.barkBubbleActive]}>
            <Text style={[styles.barkText, !bark && styles.speechText]}>
              {bark ?? speech}
            </Text>
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
  emoteLayer: { ...StyleSheet.absoluteFillObject, bottom: "30%" },
  emote: { position: "absolute", bottom: "32%", fontSize: 22 },
  dogWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 0,
  },
  dog: { width: "92%", height: "98%", alignSelf: "center" },
  shadow: {
    position: "absolute",
    alignSelf: "center",
    bottom: "5%",
    width: "52%",
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(20,30,24,1)",
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
