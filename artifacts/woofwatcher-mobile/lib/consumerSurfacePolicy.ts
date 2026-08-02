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
  pushNotificationControls: boolean;
}

export interface ProviderRuntimePolicy {
  clerkEnabled: boolean;
  apiBaseUrl: string | null;
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
    pushNotificationControls: ownerOps,
  };
}

/**
 * Compose build channel and provider configuration into the only runtime
 * policy allowed to activate accounts or the remote API. Production wins
 * even when a valid secret and domain were accidentally left in EAS.
 */
export function deriveProviderRuntimePolicy({
  channel,
  clerkConfigured,
  apiDomain,
}: {
  channel: BuildChannel;
  clerkConfigured: boolean;
  apiDomain?: string | null;
}): ProviderRuntimePolicy {
  const clerkEnabled = clerkConfigured && isOwnerOpsChannel(channel);
  const domain = apiDomain?.trim();
  return {
    clerkEnabled,
    apiBaseUrl: clerkEnabled && domain ? `https://${domain}` : null,
  };
}

export function getConsumerSurfacePolicy(): ConsumerSurfacePolicy {
  return deriveConsumerSurfacePolicy(getBuildChannel());
}
