import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBounce } from "@/components/motion/GameFeel";
import { useColors } from "@/hooks/useColors";
import { useWebQaFontScale } from "@/hooks/useWebQaFontScale";
import { getFloatingTabChromeMetrics } from "@/lib/mobileLayout";

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

/* Quick Log is the one elevated center action everywhere. Its destination,
   label, and meaning never change with the active tab. */
function CenterQuickLog() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const { style: bounceStyle, bounce } = useBounce();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    fontScale,
  });
  return (
    <View pointerEvents="box-none" style={[s.fabWrap, { bottom: chrome.centerFabBottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick Log"
        accessibilityHint="Opens the fast care logger"
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          bounce();
          router.push("/fastlog" as never);
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
      {/* The button owns the accessible name; this is its visual caption. */}
      <Text
        aria-hidden
        numberOfLines={2}
        style={[
          s.fabLabel,
          { color: colors.forest, minWidth: chrome.centerFabSize + 16 },
        ]}
      >
        Quick Log
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale: runtimeFontScale } = useWindowDimensions();
  const { fontScale } = useWebQaFontScale(runtimeFontScale);
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
    fontScale,
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
          // segment feel used elsewhere. (Quick Log keeps its own Medium
          // impact via CenterQuickLog.)
          tabPress: () => {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync();
            }
          },
        }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.forest,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: {
            fontFamily: "Inter_700Bold",
            fontSize: 10,
            lineHeight: fontScale >= 1.4 ? 14 : 12,
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
        <Tabs.Screen
          name="index"
          options={{
            title: "Today",
            tabBarAccessibilityLabel: "Today",
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
          name="calendar"
          options={{
            title: "Plan",
            tabBarAccessibilityLabel: "Plan",
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
        {/* Log History stays registered, while the elevated Quick Log action
            owns the visible center slot and always opens /fastlog. */}
        <Tabs.Screen
          name="log"
          options={{
            title: "Quick Log",
            tabBarButton: () => (
              <View pointerEvents="none" style={s.centerSlot} />
            ),
          }}
        />
        <Tabs.Screen
          name="health"
          options={{
            title: "Health",
            tabBarAccessibilityLabel: "Health",
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
            tabBarAccessibilityLabel: "More",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                focused={focused}
                color={color}
                ion="grid-outline"
                ionFilled="grid"
                size={21}
              />
            ),
          }}
        />
        {/* Richer Pack, Story, and Records surfaces stay registered for
            secondary links and deep links without competing with daily care. */}
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
      <CenterQuickLog />
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
    minWidth: 64,
    textAlign: "center",
  },
  centerSlot: {
    flex: 1,
  },
});
