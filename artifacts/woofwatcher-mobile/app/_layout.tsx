import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { useFonts } from "@expo-google-fonts/inter/useFonts";
import { Fredoka_500Medium } from "@expo-google-fonts/fredoka/500Medium";
import { Fredoka_600SemiBold } from "@expo-google-fonts/fredoka/600SemiBold";
import { Fredoka_700Bold } from "@expo-google-fonts/fredoka/700Bold";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack, useRouter, useSegments } from "expo-router";
import { LinkPreviewContextProvider } from "expo-router/build/link/preview/LinkPreviewContext";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import {
  Platform,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocalDataResetAppShield } from "@/components/LocalDataResetAppShield";
import { QueryCacheAuthIdentityBoundary } from "@/components/QueryCacheAuthIdentityBoundary";
import { WalkRouteRecorderBridge } from "@/components/WalkRouteRecorder";
import { WebDialogHost } from "@/components/WebDialogHost";
import { CareProvider } from "@/context/CareContext";
import { AuthCredentialsLocalDataResetProvider } from "@/context/AuthCredentialsLocalDataResetContext";
import { AvatarProvider } from "@/context/AvatarContext";
import { AppViewportProvider } from "@/context/AppViewportContext";
import { AppFileSystemProvider } from "@/context/AppFileSystemContext";
import { WebRuntimeLocalDataResetProvider } from "@/context/WebRuntimeLocalDataResetContext";
import { DevicePreferencesProvider } from "@/context/DevicePreferencesContext";
import { LocalDataResetProvider } from "@/context/LocalDataResetContext";
import { QueryCacheLocalDataResetProvider } from "@/context/QueryCacheLocalDataResetContext";
import { useColors } from "@/hooks/useColors";
import {
  clerkProxyUrl,
  clerkPublishableKey,
  isClerkEnabledForBuild,
  providerApiBaseUrl,
  useWoofAuth,
} from "@/lib/auth";
import { resolveWebAppViewport } from "@/lib/webAppViewport";

SplashScreen.preventAutoHideAsync();

if (providerApiBaseUrl) setBaseUrl(providerApiBaseUrl);

const queryClient = new QueryClient();

function AuthBridge() {
  const { getToken } = useWoofAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function RootLayoutNav() {
  const { isSignedIn } = useWoofAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();
  const reducedMotion = useReducedMotion();

  // Free production intentionally skips accounts. Development/internal builds
  // enforce sign-in only when the provider runtime was explicitly configured.
  useEffect(() => {
    if (!isClerkEnabledForBuild) {
      if (segments[0] === "(auth)") router.replace("/(tabs)");
      return;
    }
    if (__DEV__) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isSignedIn, segments, router]);

  return (
    <Stack
      initialRouteName="(tabs)"
      screenOptions={{
        animation: reducedMotion ? "none" : "default",
        headerBackTitle: "Back",
        headerTintColor: colors.copper,
        headerTitleStyle: {
          fontFamily: "Fredoka_700Bold",
          fontSize: 19,
          color: colors.foreground,
        },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="portrait"
        options={{ headerShown: false, presentation: "card" }}
      />
      {/* Empty titles where the screen paints its own rich header right
          below - the navigator title read as a stray duplicate ("Setup" over
          "Set up WoofWatcher"). Native keeps the back affordance. */}
      <Stack.Screen
        name="setup"
        options={{
          title: "",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="woofguide"
        options={{
          title: "WoofGuide",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="premium"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: "",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="legal"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="adventure"
        options={{
          title: "Adventure Mode",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="fastlog"
        options={{
          headerShown: false,
          presentation: "modal",
          // iOS modals slide by default; this keeps Android's native
          // transition matching instead of a platform-default cut. The web
          // build ignores it, so the fastlog screen runs its own mount
          // fade/rise there.
          animation: reducedMotion ? "none" : "slide_from_bottom",
          // Themed, not hardcoded cream: a hardcoded light background flashed
          // behind the slide-up for a beat in dark mode.
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="care-twin-qa"
        options={{
          headerShown: false,
          presentation: "card",
        }}
      />
      {/* Standalone board screens from Apollo's mockups. Each renders its own
          BoardRouteHeader (or a full-bleed hero with a back chip), so the
          native stack header stays hidden. */}
      <Stack.Screen
        name="trends"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="reminders"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="calendar-month"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
    </Stack>
  );
}

type WebViewport = { width: number; height: number };

function getWebViewport(): WebViewport | null {
  const viewport = (
    globalThis as unknown as {
      visualViewport?: { width: number; height: number };
    }
  ).visualViewport;
  if (!viewport) return null;
  return { width: viewport.width, height: viewport.height };
}

function useWebViewportClamp() {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const webDocument = (
      globalThis as unknown as {
        document?: {
          body?: HTMLElement;
          documentElement?: HTMLElement;
          getElementById?: (id: string) => HTMLElement | null;
        };
      }
    ).document;

    const nodes = [
      webDocument?.documentElement,
      webDocument?.body,
      webDocument?.getElementById?.("root"),
    ].filter((node): node is HTMLElement => Boolean(node));

    const previous = nodes.map((node) => ({
      node,
      margin: node.style.margin,
      minWidth: node.style.minWidth,
      width: node.style.width,
      maxWidth: node.style.maxWidth,
      overflowX: node.style.overflowX,
    }));

    for (const node of nodes) {
      node.style.minWidth = "0";
      node.style.width = "100vw";
      node.style.maxWidth = "100vw";
      node.style.overflowX = "hidden";
    }

    if (webDocument?.body) webDocument.body.style.margin = "0";

    return () => {
      for (const style of previous) {
        style.node.style.margin = style.margin;
        style.node.style.minWidth = style.minWidth;
        style.node.style.width = style.width;
        style.node.style.maxWidth = style.maxWidth;
        style.node.style.overflowX = style.overflowX;
      }
    };
  }, []);
}

function PersonalAppFrame() {
  useWebViewportClamp();

  if (Platform.OS !== "web") return <RootLayoutNav />;

  const { width, height } = useWindowDimensions();
  const [webViewport, setWebViewport] = React.useState<WebViewport | null>(() =>
    getWebViewport(),
  );

  useEffect(() => {
    const viewport = (
      globalThis as unknown as {
        visualViewport?: {
          addEventListener: (type: "resize", listener: () => void) => void;
          removeEventListener: (type: "resize", listener: () => void) => void;
        };
      }
    ).visualViewport;
    if (!viewport) return;

    let animationFrame: number | null = null;
    const syncViewport = () => {
      if (animationFrame !== null) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        const next = getWebViewport();
        if (!next) return;
        const rounded = {
          width: Math.round(next.width * 100) / 100,
          height: Math.round(next.height * 100) / 100,
        };
        setWebViewport((current) =>
          current?.width === rounded.width && current.height === rounded.height
            ? current
            : rounded,
        );
      });
    };
    syncViewport();
    viewport.addEventListener("resize", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, []);

  const viewportWidth = webViewport?.width ?? width;
  const viewportHeight = webViewport?.height ?? height;
  const shouldAnchorCompactPreview = viewportWidth <= 520;
  const frameWidth = Math.min(viewportWidth, 390);
  const frameHeight = Math.min(viewportHeight, 932);
  const initialViewport = resolveWebAppViewport({
    width: viewportWidth,
    height: viewportHeight,
  });

  // Phone-sized viewports get the real app edge-to-edge, exactly like the
  // mock boards - no navy letterboxing, no rounded shell. The framed
  // presentation only appears on desktop-sized windows where the phone
  // canvas needs a stage to sit on.
  if (shouldAnchorCompactPreview) {
    return (
      <View
        style={[
          styles.webFullBleed,
          { width: viewportWidth, minHeight: viewportHeight },
        ]}
      >
        <AppViewportProvider initialViewport={initialViewport}>
          <RootLayoutNav />
          <WebDialogHost />
        </AppViewportProvider>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.webBackdrop,
        {
          width: viewportWidth,
          minHeight: viewportHeight,
          alignItems: "center",
        },
      ]}
    >
      <View
        style={[styles.webFrame, { width: frameWidth, maxHeight: frameHeight }]}
      >
        <AppViewportProvider initialViewport={initialViewport}>
          <RootLayoutNav />
          {/* Themed notice/confirm dialogs for web builds: notifyDialog and
              confirmThroughSteps render here instead of raw window.alert. */}
          <WebDialogHost />
        </AppViewportProvider>
      </View>
    </View>
  );
}

function AppFrame() {
  return (
    <QueryCacheAuthIdentityBoundary>
      <PersonalAppFrame />
    </QueryCacheAuthIdentityBoundary>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <LinkPreviewContextProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <LocalDataResetProvider>
              <AuthCredentialsLocalDataResetProvider>
                <WebRuntimeLocalDataResetProvider>
                  <AppFileSystemProvider>
                    <QueryCacheLocalDataResetProvider>
                      <DevicePreferencesProvider>
                        <AuthBridge />
                        <CareProvider>
                          {/* Follows the shared walk lifecycle: starts route capture when
                          any surface opens a walk session, persists it on finish. */}
                          <WalkRouteRecorderBridge />
                          <AvatarProvider>
                            <GestureHandlerRootView style={{ flex: 1 }}>
                              <KeyboardProvider>
                                <StatusBar
                                  style={
                                    Platform.OS !== "web" && scheme === "dark"
                                      ? "light"
                                      : "dark"
                                  }
                                />
                                <LocalDataResetAppShield>
                                  <AppFrame />
                                </LocalDataResetAppShield>
                              </KeyboardProvider>
                            </GestureHandlerRootView>
                          </AvatarProvider>
                        </CareProvider>
                      </DevicePreferencesProvider>
                    </QueryCacheLocalDataResetProvider>
                  </AppFileSystemProvider>
                </WebRuntimeLocalDataResetProvider>
              </AuthCredentialsLocalDataResetProvider>
            </LocalDataResetProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </LinkPreviewContextProvider>
  );

  if (!isClerkEnabledForBuild || !clerkPublishableKey) return app;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <ClerkLoaded>{app}</ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  webFullBleed: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: "#F7F1E1",
    alignSelf: "flex-start",
  },
  webBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#081A2A",
    alignSelf: "flex-start",
    minWidth: 0,
    overflow: "hidden",
    paddingHorizontal: 0,
    paddingVertical: 18,
  },
  webFrame: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: "#F7F1E1",
    borderColor: "rgba(255, 249, 239, 0.18)",
    borderRadius: 36,
    borderWidth: 1,
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.34)",
  },
});
