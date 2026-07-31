import {
  getBuildChannel,
  isOwnerOpsChannel,
  type BuildChannel,
} from "./buildChannel.ts";

/**
 * Consumer-facing feature boundary for the free, local-first store release.
 *
 * These surfaces are useful in development/internal builds for provider QA,
 * but they are not finished consumer promises until household accounts,
 * remote sync, and the supporting services are enabled. Keeping the policy
 * in one place prevents an individual screen from accidentally exposing a
 * server-only action in the production build.
 */
export interface ConsumerSurfacePolicy {
  ownerOps: boolean;
  discoverEvents: boolean;
  householdProviderActions: boolean;
  futureDogPlanning: boolean;
  providerSyncControls: boolean;
  householdSetupModes: boolean;
}

export function deriveConsumerSurfacePolicy(
  channel: BuildChannel,
): ConsumerSurfacePolicy {
  const ownerOps = isOwnerOpsChannel(channel);
  return {
    ownerOps,
    discoverEvents: ownerOps,
    householdProviderActions: ownerOps,
    futureDogPlanning: ownerOps,
    providerSyncControls: ownerOps,
    householdSetupModes: ownerOps,
  };
}

export function getConsumerSurfacePolicy(): ConsumerSurfacePolicy {
  return deriveConsumerSurfacePolicy(getBuildChannel());
}
