import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView, SymbolViewProps } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type IoniconName = keyof typeof Ionicons.glyphMap;

function TabIcon({
  focused,
  color,
  sf,
  sfFilled,
  ion,
  ionFilled,
  size = 24,
}: {
  focused: boolean;
  color: string;
  sf: SymbolViewProps["name"];
  sfFilled: SymbolViewProps["name"];
  ion: IoniconName;
  ionFilled: IoniconName;
  size?: number;
}) {
  if (Platform.OS === "ios") {
    return <SymbolView name={focused ? sfFilled : sf} tintColor={color} size={size} />;
  }
  return <Ionicons name={focused ? ionFilled : ion} size={size} color={color} />;
}

export default function TabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingTop: 8,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={color} sf="house" sfFilled="house.fill" ion="home-outline" ionFilled="home" />
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
              sf="list.bullet.clipboard"
              sfFilled="list.bullet.clipboard.fill"
              ion="list-outline"
              ionFilled="list"
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              sf="calendar"
              sfFilled="calendar"
              ion="calendar-outline"
              ionFilled="calendar"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              sf="folder"
              sfFilled="folder.fill"
              ion="folder-outline"
              ionFilled="folder"
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
              sf="ellipsis.circle"
              sfFilled="ellipsis.circle.fill"
              ion="ellipsis-horizontal-circle-outline"
              ionFilled="ellipsis-horizontal-circle"
            />
          ),
        }}
      />
    </Tabs>
  );
}
