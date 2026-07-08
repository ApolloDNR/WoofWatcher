import { Tabs, usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
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
  return <Ionicons name={focused ? ionFilled : ion} size={size} color={color} />;
}

/* Today is the elevated center tab: the paw button drops the owner into
   Phoenix's living room. Pressing it again while already home opens the
   fast-log sheet, so the paw is also the quickest way to log care. */
function CenterToday() {
  const colors = useColors();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const chrome = getFloatingTabChromeMetrics({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });
  const onToday = pathname === "/" || pathname === "/index";
  return (
    <View pointerEvents="box-none" style={[s.fabWrap, { bottom: chrome.centerFabBottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onToday ? "Quick log" : "Today"}
        accessibilityHint={
          onToday
            ? "Opens the fast log sheet"
            : "Open Phoenix's room and today's care"
        }
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          if (onToday) {
            router.push("/fastlog" as never);
            return;
          }
          router.push("/");
        }}
        style={({ pressed }) => [
          s.fab,
          {
            width: chrome.centerFabSize,
            height: chrome.centerFabSize,
            borderRadius: chrome.centerFabSize / 2,
            backgroundColor: colors.forest,
            borderColor: colors.card,
            shadowColor: colors.brandNavy,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Ionicons name="paw" size={26} color={colors.primaryForeground} />
      </Pressable>
      <Text style={[s.fabLabel, { color: colors.forest }]}>Today</Text>
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
          tabBarActiveTintColor: colors.forest,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarActiveBackgroundColor: colors.secondary,
          tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 10, lineHeight: 12 },
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
