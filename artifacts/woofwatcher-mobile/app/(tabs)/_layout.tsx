import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

function ClassicTabLayout() {
  const colors = useColors();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
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
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "house.fill" : "house"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "list.bullet.clipboard.fill" : "list.bullet.clipboard"} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? "list" : "list-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "",
          tabBarButton: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add care entry"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.navigate("/log");
              }}
              style={s.addBtnWrap}
            >
              {({ pressed }) => (
                <View style={[s.addBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
                  <Ionicons name="add" size={32} color="#fff" />
                </View>
              )}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: "Health",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "heart.fill" : "heart"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "heart" : "heart-outline"} size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? "ellipsis.circle.fill" : "ellipsis.circle"} tintColor={color} size={24} />
            ) : (
              <Ionicons name={focused ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"} size={24} color={color} />
            ),
        }}
      />
      
      <Tabs.Screen
        name="plans"
        options={{
          href: null, // Hide from tab bar, but keep route active
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}

const s = StyleSheet.create({
  addBtnWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: "#2E5846",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  }
});
