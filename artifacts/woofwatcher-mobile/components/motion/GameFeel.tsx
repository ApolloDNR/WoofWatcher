import * as Haptics from "expo-haptics";
import React, { type ReactNode, useCallback, useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  ReduceMotion,
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
    .reduceMotion(ReduceMotion.System)
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
        if (!reduced) {
          scale.value = withSpring(scaleTo, {
            ...SPRING.pop,
            reduceMotion: ReduceMotion.System,
          });
        }
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduced) {
          scale.value = withSpring(1, {
            ...SPRING.default,
            reduceMotion: ReduceMotion.System,
          });
        }
        rest.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * A small, local acknowledgement for a real value or selection change.
 *
 * Unlike a route entrance, this never delays content or invents activity. It
 * simply lets the control that changed settle into its new state. The first
 * render stays still and the system Reduce Motion preference is authoritative.
 */
export function StateChangePulse({
  children,
  value,
  style,
  scaleFrom = 0.97,
}: {
  children: ReactNode;
  value: string | number | boolean | null | undefined;
  style?: StyleProp<ViewStyle>;
  scaleFrom?: number;
}) {
  const reduced = useReducedMotion();
  const previousValue = useRef(value);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (Object.is(previousValue.current, value)) return;
    previousValue.current = value;

    if (reduced) {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = 1;
      opacity.value = 1;
      return;
    }

    scale.value = withSequence(
      withTiming(scaleFrom, {
        duration: 70,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, {
        ...SPRING.default,
        reduceMotion: ReduceMotion.System,
      }),
    );
    opacity.value = withSequence(
      withTiming(0.72, {
        duration: 70,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1, {
        duration: 140,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [opacity, reduced, scale, scaleFrom, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
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
      withTiming(target, {
        duration: 140,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      ReduceMotion.System,
    );
    if (filled) {
      pop.value = withDelay(
        delay,
        withSequence(
          withTiming(1.22, {
            duration: 110,
            easing: Easing.out(Easing.quad),
            reduceMotion: ReduceMotion.System,
          }),
          withSpring(1, {
            ...SPRING.pop,
            reduceMotion: ReduceMotion.System,
          }),
        ),
        ReduceMotion.System,
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
  const bounce = useCallback(() => {
    if (reduced) return;
    scale.value = withSequence(
      withTiming(1.12, {
        duration: 110,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, {
        ...SPRING.pop,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [reduced, scale]);
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
  accessibilityLabel,
  accessibilityValueText,
}: {
  ratio: number;
  color: string;
  height?: number;
  radius?: number;
  trackColor: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityValueText?: string;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, ratio));
  const progress = useSharedValue(reduced ? clamped : 0);

  useEffect(() => {
    progress.value = reduced
      ? clamped
      : withSpring(clamped, {
          ...SPRING.gentle,
          reduceMotion: ReduceMotion.System,
        });
  }, [clamped, progress, reduced]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clamped * 100),
        text: accessibilityValueText,
      }}
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
