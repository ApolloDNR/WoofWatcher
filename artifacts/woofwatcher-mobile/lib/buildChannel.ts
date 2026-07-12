/**
 * Build-channel boundary for store review: owner-ops surfaces (QA cockpits,
 * launch readiness, provider proof missions, and the gated Plus preview)
 * render only in development and internal builds. Store production builds
 * hide them so reviewers and households see the finished consumer app only.
 *
 * The channel is explicit: production is only production when the build was
 * made with EXPO_PUBLIC_BUILD_PROFILE=production (set by eas.json). An
 * unlabeled release build stays "internal" so owner tooling is never lost
 * by accident.
 */
export type BuildChannel = "development" | "internal" | "production";

export interface BuildChannelInput {
  isDev: boolean;
  buildProfile?: string | null;
}

export function resolveBuildChannel(input: BuildChannelInput): BuildChannel {
  if (input.isDev) return "development";
  const profile = (input.buildProfile ?? "").trim().toLowerCase();
  if (profile === "production" || profile === "store") return "production";
  return "internal";
}

export function isOwnerOpsChannel(channel: BuildChannel): boolean {
  return channel !== "production";
}

export function describeBuildChannel(channel: BuildChannel): string {
  if (channel === "production") {
    return "Store build: consumer care surfaces only.";
  }
  if (channel === "internal") {
    return "Internal build: owner launch tooling stays visible.";
  }
  return "Development build: all surfaces including QA cockpits.";
}

declare const __DEV__: boolean | undefined;

export function getBuildChannel(): BuildChannel {
  const isDev =
    typeof __DEV__ !== "undefined"
      ? Boolean(__DEV__)
      : process.env.NODE_ENV !== "production";
  return resolveBuildChannel({
    isDev,
    buildProfile: process.env.EXPO_PUBLIC_BUILD_PROFILE ?? null,
  });
}

/** True when owner/QA tooling may render in this build. */
export function isOwnerOpsBuild(): boolean {
  return isOwnerOpsChannel(getBuildChannel());
}
