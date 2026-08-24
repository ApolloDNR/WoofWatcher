import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { PixelIcon } from "@/components/PixelIcon";
import { useColors } from "@/hooks/useColors";
import { MIN_MOBILE_TOUCH_TARGET } from "@/lib/mobileLayout";
import { canonicalHomeRoute } from "@/lib/canonicalRouteBuilders";

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.secondary, borderColor: colors.border },
        ]}
      >
        <PixelIcon name="heart" size={34} />
      </View>
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: "Fredoka_700Bold" },
        ]}
      >
        This trail goes nowhere
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        The page you were looking for isn't available. Head back to Home and
        continue your dog's care from there.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back home"
        onPress={() => router.replace(canonicalHomeRoute())}
        style={({ pressed }) => [
          styles.homeButton,
          {
            backgroundColor: pressed ? colors.copper : colors.copperBright,
            borderRadius: colors.pixelUi.radius.card,
          },
        ]}
      >
        <Text style={[styles.homeButtonText, { fontFamily: "Inter_700Bold" }]}>
          Back to Home
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 300,
  },
  homeButton: {
    marginTop: 22,
    minHeight: MIN_MOBILE_TOUCH_TARGET,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
});
