import type { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { useState } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";

import { useColors } from "@/hooks/useColors";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";

type TabScreenOptions = NonNullable<
  ComponentProps<typeof Tabs.Screen>["options"]
>;
type StaticTabScreenOptions = Exclude<
  TabScreenOptions,
  (...args: never[]) => unknown
>;
type TabButtonRenderer = NonNullable<StaticTabScreenOptions["tabBarButton"]>;
type ExpoTabBarButtonProps = Parameters<TabButtonRenderer>[0];
type ExpoTabPressEvent = Parameters<
  NonNullable<ExpoTabBarButtonProps["onPress"]>
>[0];

export type UniversalTabButtonProps = ExpoTabBarButtonProps & {
  label: string;
};

function shouldHandleWebLink(event: ExpoTabPressEvent): boolean {
  const hasModifierKey =
    ("metaKey" in event && event.metaKey) ||
    ("altKey" in event && event.altKey) ||
    ("ctrlKey" in event && event.ctrlKey) ||
    ("shiftKey" in event && event.shiftKey);
  const isLeftClick =
    "button" in event ? event.button == null || event.button === 0 : true;

  const currentTarget: unknown = event.currentTarget;
  const target =
    typeof currentTarget === "object" &&
    currentTarget !== null &&
    "target" in currentTarget
      ? currentTarget.target
      : undefined;
  const isSelfTarget =
    target == null || target === "" || target === "self" || target === "_self";

  return !hasModifierKey && isLeftClick && isSelfTarget;
}

export function UniversalTabButton(props: UniversalTabButtonProps) {
  const colors = useColors();
  const [pressed, setPressed] = useState(false);
  const selected =
    props["aria-selected"] === true ||
    (props["aria-selected"] == null &&
      props.accessibilityState?.selected === true);

  const {
    children,
    href,
    style,
    label,
    onPress,
    onPressIn,
    onPressOut,
    onLongPress,
    testID,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    role,
    ref: _ref,
    "aria-label": ariaLabel,
    "aria-selected": _ariaSelected,
    pressColor: _pressColor,
    pressOpacity: _pressOpacity,
    hoverEffect: _hoverEffect,
    ...rest
  } = props;

  const webHref =
    Platform.OS === "web" && typeof href === "string" && href.length > 0
      ? href
      : undefined;
  const linkProps = webHref === undefined ? {} : { href: webHref };
  const resolvedLabel = accessibilityLabel ?? ariaLabel ?? label;
  const resolvedRole =
    accessibilityRole ??
    (role === "tab" ? "tab" : role === "link" ? "link" : "button");

  const handlePress = (event: ExpoTabPressEvent) => {
    if (webHref !== undefined) {
      if (!shouldHandleWebLink(event)) return;
      event.preventDefault();
    }
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      {...linkProps}
      testID={testID}
      accessibilityLabel={resolvedLabel}
      accessibilityRole={resolvedRole}
      accessibilityState={{ ...accessibilityState, selected }}
      aria-label={ariaLabel ?? resolvedLabel}
      aria-selected={selected}
      role={role}
      onLongPress={onLongPress}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
        if (Platform.OS !== "web") {
          void Haptics.selectionAsync().catch(() => {});
        }
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      onPress={handlePress}
      style={[
        style,
        styles.button,
        {
          backgroundColor: selected ? colors.secondary : "transparent",
          borderColor: selected ? colors.forest : "transparent",
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: MIN_MOBILE_TOUCH_TARGET,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
  },
});
