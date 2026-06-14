import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

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
  return (
    <View pointerEvents="box-none" style={[s.fabWrap, { bottom: (insets.bottom || 10) + 26 }]}>
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
            backgroundColor: colors.cream,
            borderColor: colors.brandNavy,
            shadowColor: colors.brandNavy,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          },
        ]}
      >
        <Ionicons name="paw" size={26} color={colors.copper} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandNavy,
          tabBarInactiveTintColor: colors.cream,
          tabBarActiveBackgroundColor: colors.cream,
          tabBarLabelStyle: { fontFamily: "Inter_700Bold", fontSize: 10.5 },
          tabBarItemStyle: {
            paddingTop: 7,
            marginVertical: 7,
            marginHorizontal: 3,
            borderRadius: colors.pixelUi.radius.card,
          },
          tabBarStyle: {
            position: "absolute",
            left: 12,
            right: 12,
            bottom: isWeb ? 12 : 8,
            height: isWeb ? 76 : 70,
            backgroundColor: colors.brandNavy,
            borderTopWidth: 0,
            borderRadius: 20,
            elevation: 10,
            paddingTop: 5,
            paddingHorizontal: 7,
            shadowColor: colors.brandNavy,
            shadowOpacity: 0.25,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          },
          tabBarBackground: () => (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: colors.brandNavy,
                  borderRadius: 20,
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
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});
