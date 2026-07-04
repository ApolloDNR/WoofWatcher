export interface AuthProviderProofItem {
  label: string;
  requiredEvidence: string;
}

export type AuthSetupProofStatus = "ready" | "blocked";

export type AuthSetupNativeProofPlatform = "ios" | "android";
export type AuthSetupNativeProofSurface = "auth-gateway" | "setup-local-preview";

export interface AuthSetupNativeProofEvidence {
  platform: AuthSetupNativeProofPlatform;
  surface: AuthSetupNativeProofSurface;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  capturesProviderBoundaryCopy?: boolean;
  capturesReachableControls?: boolean;
}

export interface AuthSetupProofManifestInput {
  clerkProductionApproved?: boolean;
  redirectDeepLinkApproved?: boolean;
  nativeAuthScreensApproved?: boolean;
  setupNativeScreensApproved?: boolean;
  householdSyncApproved?: boolean;
  launchGateApproved?: boolean;
  nativeEvidence?: readonly AuthSetupNativeProofEvidence[];
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

interface AuthSetupNativeProofRequirement {
  platform: AuthSetupNativeProofPlatform;
  surface: AuthSetupNativeProofSurface;
  label: string;
  platformTokens: readonly string[];
  surfaceTokenGroups: readonly (readonly string[])[];
  requiresReachableControls: boolean;
}

const AUTH_SETUP_NATIVE_PROOF_REQUIREMENTS: readonly AuthSetupNativeProofRequirement[] = [
  {
    platform: "ios",
    surface: "auth-gateway",
    label: "iOS Auth gateway screenshot",
    platformTokens: ["ios", "iphone", "ipad"],
    surfaceTokenGroups: [["auth"], ["gateway", "sign", "signin"]],
    requiresReachableControls: false,
  },
  {
    platform: "android",
    surface: "auth-gateway",
    label: "Android Auth gateway screenshot",
    platformTokens: ["android"],
    surfaceTokenGroups: [["auth"], ["gateway", "sign", "signin"]],
    requiresReachableControls: false,
  },
  {
    platform: "ios",
    surface: "setup-local-preview",
    label: "iOS Setup local-preview screenshot",
    platformTokens: ["ios", "iphone", "ipad"],
    surfaceTokenGroups: [["setup"], ["local"], ["preview"]],
    requiresReachableControls: true,
  },
  {
    platform: "android",
    surface: "setup-local-preview",
    label: "Android Setup local-preview screenshot",
    platformTokens: ["android"],
    surfaceTokenGroups: [["setup"], ["local"], ["preview"]],
    requiresReachableControls: true,
  },
];

function normalizeEvidenceText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function evidenceNameText(evidence: AuthSetupNativeProofEvidence): string {
  return normalizeEvidenceText([evidence.fileName, evidence.uri].filter(Boolean).join(" "));
}

function hasAnyToken(text: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function hasAllTokenGroups(text: string, groups: readonly (readonly string[])[]): boolean {
  return groups.every((tokens) => hasAnyToken(text, tokens));
}

function hasImageMime(evidence: AuthSetupNativeProofEvidence): boolean {
  return normalizeEvidenceText(evidence.mimeType).startsWith("image");
}

function hasPositiveByteSize(evidence: AuthSetupNativeProofEvidence): boolean {
  return typeof evidence.byteSize === "number" && Number.isFinite(evidence.byteSize) && evidence.byteSize > 0;
}

function matchesNativeProofRequirement(
  evidence: AuthSetupNativeProofEvidence,
  requirement: AuthSetupNativeProofRequirement,
): boolean {
  const nameText = evidenceNameText(evidence);
  return (
    evidence.platform === requirement.platform &&
    evidence.surface === requirement.surface &&
    hasAnyToken(nameText, requirement.platformTokens) &&
    hasAllTokenGroups(nameText, requirement.surfaceTokenGroups) &&
    hasImageMime(evidence) &&
    hasPositiveByteSize(evidence) &&
    evidence.capturesProviderBoundaryCopy === true &&
    (!requirement.requiresReachableControls || evidence.capturesReachableControls === true)
  );
}

function summarizeNativeProof(
  evidence: readonly AuthSetupNativeProofEvidence[],
  surface: AuthSetupNativeProofSurface,
): { ready: boolean; readyCount: number; totalCount: number; missingLabels: string[] } {
  const requirements = AUTH_SETUP_NATIVE_PROOF_REQUIREMENTS.filter((requirement) => requirement.surface === surface);
  const missingLabels = requirements
    .filter((requirement) => !evidence.some((item) => matchesNativeProofRequirement(item, requirement)))
    .map((requirement) => requirement.label);
  return {
    ready: missingLabels.length === 0,
    readyCount: requirements.length - missingLabels.length,
    totalCount: requirements.length,
    missingLabels,
  };
}

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
  const householdSyncApproved = Boolean(input.householdSyncApproved);
  const launchGateApproved = Boolean(input.launchGateApproved);
  const nativeEvidence = input.nativeEvidence ?? [];
  const authNativeProof = summarizeNativeProof(nativeEvidence, "auth-gateway");
  const setupNativeProof = summarizeNativeProof(nativeEvidence, "setup-local-preview");
  const launchReady =
    launchGateApproved &&
    clerkProductionApproved &&
    redirectDeepLinkApproved &&
    authNativeProof.ready &&
    setupNativeProof.ready &&
    householdSyncApproved;
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
      authNativeProof.ready,
      `${authNativeProof.totalCount}/${authNativeProof.totalCount} Auth gateway screenshots ready`,
      `${authNativeProof.readyCount}/${authNativeProof.totalCount} Auth gateway screenshots ready`,
      authNativeProof.ready
        ? "iOS and Android Auth gateway screenshots include platform/surface naming, image MIME, positive byte size, and provider-boundary copy."
        : `iOS and Android Auth gateway screenshots are missing: ${authNativeProof.missingLabels.join(", ")}. Each proof must include platform/surface naming, image MIME, positive byte size, and provider-boundary copy.`,
    ),
    manifestRow(
      "Setup local-preview proof",
      setupNativeProof.ready,
      `${setupNativeProof.totalCount}/${setupNativeProof.totalCount} Setup local-preview screenshots ready`,
      `${setupNativeProof.readyCount}/${setupNativeProof.totalCount} Setup local-preview screenshots ready`,
      setupNativeProof.ready
        ? "Setup local-preview path is captured on iOS and Android with platform/surface naming, image MIME, positive byte size, provider-boundary copy, and reachable controls."
        : `Setup local-preview path is missing native proof: ${setupNativeProof.missingLabels.join(", ")}. Each proof must include platform/surface naming, image MIME, positive byte size, provider-boundary copy, and reachable save controls.`,
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
      launchReady,
      "Native proof approved",
      "Native proof blocked",
      "Auth and Setup launch proof stays blocked until Clerk, redirects, platform-specific native screenshots, household creation policy, and Apollo approval are attached.",
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
