export interface AuthProviderProofItem {
  label: string;
  requiredEvidence: string;
}

export type AuthSetupProofStatus = "ready" | "blocked";

export interface AuthSetupProofManifestInput {
  clerkProductionApproved?: boolean;
  redirectDeepLinkApproved?: boolean;
  nativeAuthScreensApproved?: boolean;
  setupNativeScreensApproved?: boolean;
  householdSyncApproved?: boolean;
  launchGateApproved?: boolean;
}

export interface AuthSetupProofManifestRow {
  label: string;
  value: string;
  detail: string;
  status: AuthSetupProofStatus;
}

export interface AuthSetupProofManifest {
  status: AuthSetupProofStatus;
  rows: AuthSetupProofManifestRow[];
  blockers: string[];
}

export const AUTH_PROVIDER_PROOF_ITEMS: readonly AuthProviderProofItem[] = [
  {
    label: "Clerk production app",
    requiredEvidence:
      "Clerk production app id, publishable key environment, secret storage location, and confirmation that local placeholder keys are not used for release.",
  },
  {
    label: "Redirect and deep-link URLs",
    requiredEvidence:
      "Approved redirect/deep-link URL list covering Expo scheme, iOS and Android bundle identifiers, production web URL, and post-auth return paths.",
  },
  {
    label: "OAuth sign-in test",
    requiredEvidence:
      "native screenshot or screen recording of OAuth sign-in completing on iOS and Android with no local-preview fallback, blank screen, or unapproved provider copy.",
  },
  {
    label: "Session and token policy",
    requiredEvidence:
      "Session lifetime, token refresh, sign-out behavior, revoked-session handling, and secure storage policy approved for the beta and production builds.",
  },
  {
    label: "Household membership policy",
    requiredEvidence:
      "active household resolution, invite acceptance, join/create household permissions, and role enforcement notes proving auth cannot cross household boundaries.",
  },
];

export const AUTH_PROVIDER_PROOF_SUMMARY =
  "Production auth provider proof packet: Clerk production app id, redirect/deep-link URL list, OAuth sign-in test, session policy, and household membership policy before provider-backed account sync or household creation can be claimed.";

function manifestRow(
  label: string,
  ready: boolean,
  readyValue: string,
  blockedValue: string,
  detail: string,
): AuthSetupProofManifestRow {
  return {
    label,
    value: ready ? readyValue : blockedValue,
    detail,
    status: ready ? "ready" : "blocked",
  };
}

export function buildAuthSetupProofManifest(
  input: AuthSetupProofManifestInput = {},
): AuthSetupProofManifest {
  const clerkProductionApproved = Boolean(input.clerkProductionApproved);
  const redirectDeepLinkApproved = Boolean(input.redirectDeepLinkApproved);
  const nativeAuthScreensApproved = Boolean(input.nativeAuthScreensApproved);
  const setupNativeScreensApproved = Boolean(input.setupNativeScreensApproved);
  const householdSyncApproved = Boolean(input.householdSyncApproved);
  const launchGateApproved = Boolean(input.launchGateApproved);
  const rows = [
    manifestRow(
      "Clerk production app",
      clerkProductionApproved,
      "Clerk approved",
      "Clerk pending",
      "Clerk production app id, publishable key environment, secret storage, and non-placeholder release configuration must be attached.",
    ),
    manifestRow(
      "Redirect and deep links",
      redirectDeepLinkApproved,
      "Redirects approved",
      "Redirects pending",
      "Expo scheme, iOS and Android bundle identifiers, production web URL, OAuth return paths, and post-auth routing must be approved.",
    ),
    manifestRow(
      "Native auth screenshots",
      nativeAuthScreensApproved,
      "Screenshots approved",
      "Screenshots pending",
      "iOS and Android Auth gateway screenshots or recordings must prove sign-in/sign-up renders, OAuth completes, and no local-preview fallback is used.",
    ),
    manifestRow(
      "Setup local-preview proof",
      setupNativeScreensApproved,
      "Setup proof approved",
      "Setup proof pending",
      "Setup local-preview path must be captured on iOS and Android, including create, join-by-invite, local preview, provider-boundary copy, and safe-area fit.",
    ),
    manifestRow(
      "Household sync boundary",
      householdSyncApproved,
      "Household sync approved",
      "Household sync blocked",
      "Provider-backed household creation, invite acceptance, active household selection, and role enforcement stay blocked until real provider proof exists.",
    ),
    manifestRow(
      "Launch gate",
      launchGateApproved,
      "Native proof approved",
      "Native proof blocked",
      "Auth and Setup launch proof stays blocked until Clerk, redirects, native screenshots, household creation policy, and Apollo approval are attached.",
    ),
  ];
  const blockers = rows
    .filter((item) => item.status === "blocked")
    .map((item) => `${item.label}: ${item.detail}`);
  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    rows,
    blockers,
  };
}
