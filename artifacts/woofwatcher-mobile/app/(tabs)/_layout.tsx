import { Tabs, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBounce } from "@/components/motion/GameFeel";
import { useCare } from "@/context/CareContext";
import { useColors } from "@/hooks/useColors";
import {
  buildTodayTabAccessibilityHint,
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
  // Becoming the active tab pops the icon with the shared bounce - the same
  // game-feel the paw button has, so navigation answers back visually, not
  // just with the selection haptic. Reduce Motion keeps it still (useBounce
  // is already gated).
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

/* Today is the elevated center tab: the paw button drops the owner into
   Phoenix's living room. Pressing it again while already home opens the
   fast-log sheet, so the paw is also the quickest way to log care. */
function CenterToday() {
  const colors = useColors();
  const { state } = useCare();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { style: bounceStyle, bounce } = useBounce();
  const keyboardIsVisible = useKeyboardState((keyboard) => keyboard.isVisible);
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const keyboardTravelDistance = chrome.centerFabBottom + chrome.centerFabSize + 24;
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
  const onToday = pathname === "/" || pathname === "/index";
  return (
    <Animated.View
      pointerEvents={keyboardInteraction.pointerEvents}
      accessibilityElementsHidden={keyboardInteraction.accessibilityElementsHidden}
      importantForAccessibility={keyboardInteraction.importantForAccessibility}
      style={[s.fabWrap, { bottom: chrome.centerFabBottom }, keyboardAnimatedStyle]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onToday ? "Quick log" : "Today"}
        aria-selected={onToday}
        accessibilityHint={buildTodayTabAccessibilityHint({
          onToday,
          petName: state.profile.name,
        })}
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          bounce();
          if (onToday) {
            router.push("/fastlog" as never);
            return;
          }
          router.push("/");
        }}
      >
        <Animated.View
          style={[
            s.fab,
            {
              width: chrome.centerFabSize,
              height: chrome.centerFabSize,
              borderRadius: chrome.centerFabSize / 2,
              backgroundColor: colors.forest,
              borderColor: colors.card,
              shadowColor: colors.brandNavy,
            },
            bounceStyle,
          ]}
        >
          <Ionicons name="paw" size={26} color={colors.primaryForeground} />
        </Animated.View>
      </Pressable>
      {/* Visual caption only - the paw button already carries the accessible
          label, so this Text would read as a stray duplicate "Today".
          aria-hidden is the one alias RN maps on native AND web. */}
      <Text aria-hidden style={[s.fabLabel, { color: colors.forest }]}>
        Today
      </Text>
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
    <View style={{ flex: 1 }}>
      <Tabs
        // history back behavior: when the user opens a deep-linked screen
        // (Records/Health/More reached from Pack, Story, etc.) the hardware /
        // router back returns to the tab they actually came from, instead of
        // the default "firstRoute" jump to Today that used to strand them.
        backBehavior="history"
        screenListeners={{
          // The standard nav tabs used the default expo-router buttons, which
          // fire no haptic - the app's most frequent interaction had the least
          // feedback. A selection tick on every tab press matches the toggle /
          // segment feel used elsewhere. (The center paw keeps its own Medium
          // impact via CenterToday.)
          tabPress: () => {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync();
            }
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.forest,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: { fontFamily: "Inter_700Bold", fontSize: 10, lineHeight: 12 },
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
        <Tabs.Screen
          name="log"
          options={{
            title: "Log",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="compass-outline"
                ionFilled="compass"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Plan",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="clipboard-outline"
                ionFilled="clipboard"
                size={21}
              />
            ),
          }}
        />
        {/* Today keeps its route registered but renders an empty slot in the
            bar; the elevated CenterToday paw above it owns the tap target. */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarButton: () => (
              <View pointerEvents="none" style={s.centerSlot} />
            ),
          }}
        />
        <Tabs.Screen
          name="pack"
          options={{
            title: "Pack",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} ion="paw-outline" ionFilled="paw" />
            ),
          }}
        />
        <Tabs.Screen
          name="story"
          options={{
            title: "Story",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="book-outline"
                ionFilled="book"
                size={21}
              />
            ),
          }}
        />
        {/* Health, More, and Records stay registered for deep links and the
            Pack/Story/Today entry points; they are no longer primary tabs. */}
        <Tabs.Screen
          name="health"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="more"
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
      <CenterToday />
    </View>
  );
}

const s = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    boxShadow: "0 10px 24px rgba(8, 20, 36, 0.24)",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  fabLabel: {
    marginTop: 2,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    lineHeight: 12,
  },
  centerSlot: {
    flex: 1,
  },
});
