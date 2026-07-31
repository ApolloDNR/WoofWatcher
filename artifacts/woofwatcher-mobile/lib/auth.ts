import { useAuth } from "@clerk/expo";

import { isOwnerOpsBuild } from "./buildChannel.ts";

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

/**
 * The free store build is intentionally local-only. A stray secret in the
 * EAS environment must not silently re-enable accounts, auth traffic, or
 * household sync. Provider QA remains available in development/internal
 * builds where those surfaces are visible.
 */
export const isClerkEnabledForBuild =
  isClerkConfigured && isOwnerOpsBuild();

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

export const useWoofAuth = isClerkEnabledForBuild
  ? useClerkAuth
  : useLocalAuth;
