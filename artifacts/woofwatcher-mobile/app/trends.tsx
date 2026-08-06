import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import TrendsScreen from "@/components/health/TrendsScreen";
import {
  getRouteTopPadding,
  getStandaloneRouteBottomPadding,
} from "@/lib/mobileLayout";

export default function TrendsRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPadding = getRouteTopPadding({
    platform: Platform.OS,
    topInset: insets.top,
    surface: "standalone",
  });
  const bottomPadding = getStandaloneRouteBottomPadding({
    platform: Platform.OS,
    bottomInset: insets.bottom,
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: "Trends" }} />
      <TrendsScreen
        contentTopPadding={topPadding}
        contentBottomPadding={bottomPadding}
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(tabs)" as never)
        }
      />
    </>
  );
}
