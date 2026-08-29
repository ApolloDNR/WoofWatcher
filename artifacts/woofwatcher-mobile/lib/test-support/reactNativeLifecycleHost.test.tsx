import React from "react";

const host = (tag: string) =>
  React.forwardRef<unknown, Record<string, unknown>>(function LifecycleHost(
    props,
    ref,
  ) {
    const {
      children,
      accessibilityLabel,
      accessibilityRole,
      contentContainerStyle: _contentContainerStyle,
      onPress,
      showsVerticalScrollIndicator: _showsVerticalScrollIndicator,
      style,
      ...rest
    } = props;
    const resolvedStyle =
      typeof style === "function"
        ? (style as (state: { pressed: boolean }) => unknown)({ pressed: false })
        : style;
    return React.createElement(
      tag,
      {
        ...rest,
        ref,
        role: accessibilityRole,
        "aria-label": accessibilityLabel,
        onClick: onPress,
        style: resolvedStyle,
      },
      children as React.ReactNode,
    );
  });

export const View = host("div");
export const Text = host("span");
export const Pressable = host("button");
export const ScrollView = host("section");
export const SafeAreaView = host("main");
export const ActivityIndicator = host("i");
export const StyleSheet = {
  create<T>(styles: T): T {
    return styles;
  },
};
export const Platform = {
  OS: "web",
  select<T>(choices: { web?: T; default?: T }): T | undefined {
    return choices.web ?? choices.default;
  },
};
export function useColorScheme(): "light" {
  return "light";
}

export function useWindowDimensions() {
  return { width: 320, height: 568, scale: 1, fontScale: 1.6 };
}
