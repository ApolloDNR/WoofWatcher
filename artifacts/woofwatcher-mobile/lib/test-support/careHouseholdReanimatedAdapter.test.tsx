import React from "react";

const animatedHost = (tag: string) =>
  React.forwardRef<unknown, Record<string, any>>(function AnimatedHost(
    { children, ...props },
    ref,
  ) {
    return React.createElement(tag, { ...props, ref }, children);
  });

const Animated = {
  View: animatedHost("div"),
  Text: animatedHost("span"),
  ScrollView: animatedHost("section"),
};
export default Animated;

const entrance = {
  delay() {
    return this;
  },
  springify() {
    return this;
  },
  damping() {
    return this;
  },
  stiffness() {
    return this;
  },
};
export const FadeInDown = entrance;
export const Easing = {
  quad: (value: number) => value,
  out: (value: unknown) => value,
};
export function useAnimatedStyle<T>(factory: () => T): T {
  return factory();
}
export function useReducedMotion(): boolean {
  return true;
}
export function useSharedValue<T>(value: T): { value: T } {
  return { value };
}
export function withDelay<T>(_delay: number, value: T): T {
  return value;
}
export function withSequence<T>(...values: T[]): T {
  return values[values.length - 1]!;
}
export function withSpring<T>(value: T): T {
  return value;
}
export function withTiming<T>(value: T): T {
  return value;
}
