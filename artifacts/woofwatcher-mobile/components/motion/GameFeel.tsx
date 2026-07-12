import * as Haptics from "expo-haptics";
import React, { type ReactNode, useEffect } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * WoofWatcher game-feel motion kit.
 *
 * One spring language for the whole app, tuned to Apollo's 2026-07 mock
 * boards: crisp, springy, alive - a little video game inside a care app.
 * Every value here derives from the shared motion spec:
 *   - default: snappy UI response (cards, rows, sheets)
 *   - pop:     playful overshoot (paw button, pips, celebrations)
 *   - gentle:  calm settles (meters, progress)
 * Honesty rule: motion only ever *presents* real state - it never invents
 * progress, counts, or delays that fake work.
 */
export const SPRING = {
  default: { damping: 22, stiffness: 260, mass: 1 },
  pop: { damping: 17, stiffness: 420, mass: 0.9 },
  gentle: { damping: 26, stiffness: 170, mass: 1 },
} as const;

export const MOTION_MS = {
  tap: 150,
  element: 260,
  screen: 340,
  chart: 600,
} as const;

/** Standard staggered card entrance: fade + rise with a soft spring. */
export function enterUp(index = 0) {
  return FadeInDown.delay(Math.min(index, 8) * 50)
    .springify()
    .damping(SPRING.default.damping)
    .stiffness(SPRING.default.stiffness);
}

/**
 * Springy press wrapper: every pressable squishes to 0.96 and springs back.
 * Replaces dead taps and instant-transform presses with one consistent feel.
 */
export function PressScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.96,
  haptic = "light",
  disabled,
  onPress,
  onLongPress,
  ...rest
}: PressableProps & {
  children: ReactNode;
  /** Visual style, applied to the springy inner view. */
  style?: StyleProp<ViewStyle>;
  /** Layout style (width/flex/margins), applied to the outer Pressable. */
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: "light" | "medium" | "none";
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      disabled={disabled}
      onPress={(event) => {
        if (haptic !== "none" && Platform.OS !== "web") {
          Haptics.impactAsync(
            haptic === "medium"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
          );
        }
        onPress?.(event);
      }}
      onLongPress={onLongPress}
      onPressIn={(event) => {
        if (!reduced) scale.value = withSpring(scaleTo, SPRING.pop);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduced) scale.value = withSpring(1, SPRING.default);
        rest.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * One meter pip that pops in when it fills. Fill order staggers left to
 * right (40ms per pip) so the meter reads like a little power bar filling.
 * The pip only animates when its filled state *changes* - honest motion.
 */
export function MeterPip({
  filled,
  color,
  emptyColor,
  index,
  height = 13,
  radius = 4,
}: {
  filled: boolean;
  color: string;
  emptyColor: string;
  index: number;
  height?: number;
  radius?: number;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    const target = filled ? 1 : 0;
    if (fill.value === target) return;
    if (reduced) {
      fill.value = target;
      return;
    }
    const delay = index * 40;
    fill.value = withDelay(
      delay,
      withTiming(target, { duration: 140, easing: Easing.out(Easing.quad) }),
    );
    if (filled) {
      pop.value = withDelay(
        delay,
        withSequence(
          withTiming(1.22, { duration: 110, easing: Easing.out(Easing.quad) }),
          withSpring(1, SPRING.pop),
        ),
      );
    }
  }, [filled, fill, index, pop, reduced]);

  const style = useAnimatedStyle(() => ({
    backgroundColor: fill.value > 0.5 ? color : emptyColor,
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

/**
 * Bounce handle for icon buttons (the paw tab, quick-log tiles): call
 * bounce() on press for a 1 -> 1.12 -> 1 pop, spread the joy consistently.
 */
export function useBounce() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const bounce = () => {
    if (reduced) return;
    scale.value = withSequence(
      withTiming(1.12, { duration: 110, easing: Easing.out(Easing.quad) }),
      withSpring(1, SPRING.pop),
    );
  };
  return { style, bounce };
}

/** Animated progress bar fill: width settles with the gentle spring. */
export function ProgressFill({
  ratio,
  color,
  height = 8,
  radius = 999,
  trackColor,
  style,
}: {
  ratio: number;
  color: string;
  height?: number;
  radius?: number;
  trackColor: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const progress = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    progress.value = reduced ? clamped : withSpring(clamped, SPRING.gentle);
  }, [clamped, progress, reduced]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      style={[
        { height, borderRadius: radius, backgroundColor: trackColor, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={[
          { height: "100%", borderRadius: radius, backgroundColor: color },
          fillStyle,
        ]}
      />
    </Animated.View>
  );
}
