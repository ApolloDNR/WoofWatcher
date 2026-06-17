import { useAuth } from "@clerk/expo";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const normalizedPublishableKey = publishableKey?.toLowerCase() ?? "";
const isPlaceholderPublishableKey =
  normalizedPublishableKey.includes("placeholder") ||
  normalizedPublishableKey.includes("preview") ||
  normalizedPublishableKey.includes("local_smoke");

export const clerkPublishableKey = publishableKey;
export const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
export const isClerkConfigured =
  typeof publishableKey === "string" &&
  /^pk_(test|live)_[A-Za-z0-9_-]{20,}$/.test(publishableKey) &&
  !isPlaceholderPublishableKey;

const localAuth = {
  isLoaded: true,
  isSignedIn: false,
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
