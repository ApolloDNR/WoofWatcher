import { useAuth } from "@clerk/expo";
import { Platform } from "react-native";
import { resolveLocalRouteSmoke } from "./localRouteSmoke";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const normalizedPublishableKey = publishableKey?.toLowerCase() ?? "";
const isPlaceholderPublishableKey =
  normalizedPublishableKey.includes("placeholder") ||
  normalizedPublishableKey.includes("preview") ||
  normalizedPublishableKey.includes("local_smoke");

export const clerkPublishableKey = publishableKey;
export const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
export const isLocalRouteSmoke = resolveLocalRouteSmoke({
  platform: Platform.OS,
  token: process.env.EXPO_PUBLIC_LOCAL_ROUTE_SMOKE,
  buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE,
  hostname:
    Platform.OS === "web" &&
    typeof globalThis.location?.hostname === "string"
      ? globalThis.location.hostname
      : undefined,
});
export const isClerkConfigured =
  typeof publishableKey === "string" &&
  /^pk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(publishableKey) &&
  !isPlaceholderPublishableKey;

const localAuth = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  getToken: async () => null,
  signOut: async () => undefined,
};

function useLocalAuth() {
  return localAuth;
}

function useClerkAuth() {
  return useAuth();
}

export const useWoofAuth = isClerkConfigured ? useClerkAuth : useLocalAuth;
