import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBounce } from "@/components/motion/GameFeel";
import { UniversalTabButton } from "@/components/navigation/UniversalTabButton";
import { useColors } from "@/hooks/useColors";
import { getFloatingTabChromeMetrics } from "@/lib/mobileLayout";
import {
  UNIVERSAL_COMPATIBILITY_TABS,
  UNIVERSAL_PRIMARY_TABS,
} from "@/lib/universalTabBar";

export const unstable_settings = {
  initialRouteName: "index",
};

type IoniconName = keyof typeof Ionicons.glyphMap;
type UniversalTabName = (typeof UNIVERSAL_PRIMARY_TABS)[number]["name"];
type UniversalTabIcon = {
  ion: IoniconName;
  ionFilled: IoniconName;
  size?: number;
};

const UNIVERSAL_TAB_ICONS: Record<UniversalTabName, UniversalTabIcon> = {
  index: { ion: "home-outline", ionFilled: "home" },
  log: { ion: "add-circle-outline", ionFilled: "add-circle" },
  calendar: { ion: "calendar-outline", ionFilled: "calendar", size: 22 },
  health: { ion: "heart-outline", ionFilled: "heart" },
  more: { ion: "menu-outline", ionFilled: "menu" },
};

function TabIcon({
  focused,
  color,
  ion,
  ionFilled,
  size = 23,
}: {
  focused: boolean;
  color: string;
  ion: IoniconName;
  ionFilled: IoniconName;
  size?: number;
}) {
  // The shared focus bounce gives navigation immediate visual feedback while
  // useBounce keeps Reduce Motion preferences authoritative.
  const { style, bounce } = useBounce();
  const wasFocused = useRef(focused);
  useEffect(() => {
    if (focused && !wasFocused.current) bounce();
    wasFocused.current = focused;
  }, [bounce, focused]);
  return (
    <Animated.View style={style}>
      <Ionicons name={focused ? ionFilled : ion} size={size} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: true,
        tabBarAllowFontScaling: true,
        tabBarLabelStyle: {
          fontFamily: "Inter_700Bold",
          fontSize: 14,
          lineHeight: 18,
        },
        tabBarItemStyle: {
          paddingTop: 2,
          paddingBottom: 3,
          marginVertical: 2,
          marginHorizontal: 3,
          borderRadius: 999,
        },
        tabBarStyle: {
          position: "absolute",
          left: chrome.tabBarHorizontalInset,
          right: chrome.tabBarHorizontalInset,
          bottom: chrome.tabBarBottom,
          height: chrome.tabBarHeight,
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderRadius: chrome.tabBarRadius,
          elevation: 12,
          paddingTop: 5,
          paddingBottom: 6,
          paddingHorizontal: 7,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.brandNavy,
          shadowOpacity: 0.16,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: colors.card,
                borderRadius: chrome.tabBarRadius,
                opacity: 0.96,
              },
            ]}
          />
        ),
      }}
    >
      {UNIVERSAL_PRIMARY_TABS.map((tab) => {
        const icon = UNIVERSAL_TAB_ICONS[tab.name];
        return (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon
                  focused={focused}
                  color={color}
                  ion={icon.ion}
                  ionFilled={icon.ionFilled}
                  size={icon.size}
                />
              ),
              tabBarButton: (buttonProps) => (
                <UniversalTabButton {...buttonProps} label={tab.label} />
              ),
            }}
          />
        );
      })}
      {UNIVERSAL_COMPATIBILITY_TABS.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
