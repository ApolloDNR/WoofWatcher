import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { PixelIcon } from "@/components/PixelIcon";
import { getFloatingTabChromeMetrics } from "@/lib/mobileLayout";

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
  return <Ionicons name={focused ? ionFilled : ion} size={size} color={color} />;
}

function CenterPaw() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  return (
    <View pointerEvents="box-none" style={[s.fabWrap, { bottom: chrome.centerFabBottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quick log"
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          router.push("/log");
        }}
        style={({ pressed }) => [
          s.fab,
          {
            width: chrome.centerFabSize,
            height: chrome.centerFabSize,
            borderRadius: chrome.centerFabSize / 2,
            backgroundColor: colors.copperBright,
            borderColor: colors.card,
            shadowColor: colors.brandNavy,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <PixelIcon name="walk" size={30} />
      </Pressable>
    </View>
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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.copperBright,
          tabBarInactiveTintColor: colors.foreground,
          tabBarActiveBackgroundColor: "transparent",
          tabBarLabelStyle: { fontFamily: "Inter_700Bold", fontSize: 10 },
          tabBarItemStyle: {
            paddingTop: 4,
            marginVertical: 6,
            marginHorizontal: 2,
            borderRadius: colors.pixelUi.radius.card,
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
            paddingTop: 4,
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
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} color={color} ion="home-outline" ionFilled="home" />
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
                ion="compass-outline"
                ionFilled="compass"
              />
            ),
          }}
        />
        {/* Empty center slot reserves space under the floating paw FAB so it
            never swallows taps meant for the Log/Plans tabs. The records
            screen stays reachable via router.push("/records"). */}
        <Tabs.Screen
          name="calendar"
          options={{
            title: "Plans",
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
                size={21}
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
                ion="ellipsis-horizontal"
                ionFilled="ellipsis-horizontal"
              />
            ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            href: null,
          }}
        />
      </Tabs>
      <CenterPaw />
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
});
