import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomTabBar,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import {
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBounce } from "@/components/motion/GameFeel";
import { useColors } from "@/hooks/useColors";
import {
  getFloatingTabChromeMetrics,
  getFloatingTabKeyboardPresentation,
} from "@/lib/mobileLayout";

export const unstable_settings = {
  initialRouteName: "index",
};

type IoniconName = keyof typeof Ionicons.glyphMap;

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
  // Navigation answers back visually as well as with the selection haptic.
  // Reduce Motion keeps this still because useBounce is already gated.
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

export function KeyboardAwareTabBar(props: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const keyboardIsVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    leftInset: insets.left,
    rightInset: insets.right,
  });
  const keyboardTravelDistance = chrome.tabBarBottom + chrome.tabBarHeight + 24;
  const keyboardInteraction = getFloatingTabKeyboardPresentation({
    progress: keyboardIsVisible ? 1 : 0,
    travelDistance: keyboardTravelDistance,
  });
  const keyboardAnimatedStyle = useAnimatedStyle(() => {
    const presentation = getFloatingTabKeyboardPresentation({
      progress: keyboardProgress.value,
      travelDistance: keyboardTravelDistance,
    });
    return {
      opacity: presentation.opacity,
      transform: [{ translateY: presentation.translateY }],
    };
  }, [keyboardTravelDistance]);

  return (
    <Animated.View
      pointerEvents={keyboardInteraction.pointerEvents}
      accessibilityElementsHidden={
        keyboardInteraction.accessibilityElementsHidden
      }
      importantForAccessibility={keyboardInteraction.importantForAccessibility}
      style={[StyleSheet.absoluteFill, keyboardAnimatedStyle]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: chrome.tabBarBottom,
          backgroundColor: colors.background,
        }}
      />
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    leftInset: insets.left,
    rightInset: insets.right,
  });

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <KeyboardAwareTabBar {...props} />}
        // Deep-linked secondary screens return to the primary tab the owner
        // actually came from instead of jumping back to the first route.
        backBehavior="history"
        screenListeners={{
          // A restrained selection tick keeps the most frequent interaction
          // responsive without competing with task-completion feedback.
          tabPress: () => {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync();
            }
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.cream,
          tabBarInactiveTintColor: colors.cream + "99",
          tabBarLabelStyle: {
            fontFamily: "Inter_700Bold",
            fontSize: 10,
            lineHeight: 12,
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
            backgroundColor: colors.brandNavy,
            borderTopWidth: 0,
            borderRadius: chrome.tabBarRadius,
            elevation: 12,
            paddingTop: 5,
            paddingBottom: chrome.tabBarPaddingBottom,
            paddingLeft: chrome.tabBarPaddingLeft,
            paddingRight: chrome.tabBarPaddingRight,
            borderWidth: 1,
            borderColor: colors.cream + "33",
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
                  backgroundColor: colors.brandNavy,
                  borderRadius: chrome.tabBarRadius,
                  opacity: 0.96,
                },
              ]}
            />
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="home-outline"
                ionFilled="home"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: "Log",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="add-circle-outline"
                ionFilled="add-circle"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Plans",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="calendar-outline"
                ionFilled="calendar"
                size={21}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="health"
          options={{
            title: "Health",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="heart-outline"
                ionFilled="heart"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="ellipsis-horizontal-circle-outline"
                ionFilled="ellipsis-horizontal-circle"
              />
            ),
          }}
        />
        {/* Pack, Story, and Records remain routable from in-app entry points
            and external deep links without crowding primary navigation. */}
        <Tabs.Screen
          name="pack"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="story"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}
