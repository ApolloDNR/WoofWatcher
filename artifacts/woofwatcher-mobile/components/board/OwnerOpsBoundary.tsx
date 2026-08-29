import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { replaceWithCanonicalHome } from "@/lib/canonicalRouteBuilders";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";

/**
 * Store-build boundary screen: owner/QA tooling routes render this calm
 * notice in production builds instead of internal cockpits, so deep links
 * never expose launch tooling to households or store reviewers.
 */
export function OwnerOpsUnavailableScreen({
  title = "Page unavailable",
}: {
  title?: string;
}) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top + 24 },
      ]}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
          <Ionicons name="paw" size={22} color={colors.forest} />
        </View>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Fraunces_700Bold" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.detail,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          This page isn't available in this version of WoofWatcher. Everything
          for your dog's day is available from Home, Log, Plans, Health, and
          More.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => replaceWithCanonicalHome(router)}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? colors.forestBright : colors.forest,
            },
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Back to Home
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  buttonText: {
    fontSize: 13.5,
  },
});
