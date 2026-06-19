import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, ClerkLoaded } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform, StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CareProvider } from "@/context/CareContext";
import { AvatarProvider } from "@/context/AvatarContext";
import {
  clerkProxyUrl,
  clerkPublishableKey,
  isClerkConfigured,
  useWoofAuth,
} from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

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

  // Development convenience: skip the sign-in gate so the app can be reviewed
  // in the web preview / simulator without logging in on every reload. Real
  // production builds (where __DEV__ is false) always enforce authentication.
  useEffect(() => {
    if (!isClerkConfigured) {
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
      screenOptions={{ headerBackTitle: "Back", headerTintColor: "#2E5846" }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="portrait"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="setup"
        options={{
          title: "Setup",
          presentation: "card",
          headerStyle: { backgroundColor: "#F7F5F1" },
        }}
      />
      <Stack.Screen
        name="woofguide"
        options={{
          title: "WoofGuide",
          presentation: "card",
          headerStyle: { backgroundColor: "#F7F5F1" },
        }}
      />
      <Stack.Screen
        name="premium"
        options={{
          title: "WoofWatcher Plus",
          presentation: "card",
          headerStyle: { backgroundColor: "#F7F5F1" },
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: "Privacy & Safety",
          presentation: "card",
          headerStyle: { backgroundColor: "#F7F5F1" },
        }}
      />
      <Stack.Screen
        name="care-twin-qa"
        options={{
          title: "Care Twin QA",
          presentation: "card",
          headerStyle: { backgroundColor: "#F7F5F1" },
        }}
      />
    </Stack>
  );
}

function AppFrame() {
  if (Platform.OS !== "web") return <RootLayoutNav />;

  return (
    <View style={styles.webBackdrop}>
      <View style={styles.webFrame}>
        <RootLayoutNav />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthBridge />
          <CareProvider>
            <AvatarProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style={Platform.OS !== "web" && scheme === "dark" ? "light" : "dark"} />
                  <AppFrame />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AvatarProvider>
          </CareProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );

  if (!isClerkConfigured || !clerkPublishableKey) return app;

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
  webBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#081A2A",
    padding: 18,
  },
  webFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    maxHeight: 932,
    overflow: "hidden",
    backgroundColor: "#FFF9EF",
    borderColor: "rgba(255, 249, 239, 0.18)",
    borderRadius: 36,
    borderWidth: 1,
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.34)",
  },
});
