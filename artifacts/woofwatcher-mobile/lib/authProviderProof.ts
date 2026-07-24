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

export type AuthProviderStructuredProofKind =
  | "clerk-production"
  | "redirect-deep-links"
  | "oauth-completion"
  | "session-token-policy"
  | "household-membership"
  | "launch-approval";

export interface AuthProviderStructuredProofEvidence {
  kind: AuthProviderStructuredProofKind;
  platform?: AuthSetupNativeProofPlatform | null;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  productionAppId?: string | null;
  publishableKeyEnvironment?: string | null;
  secretStorageLocation?: string | null;
  redirectUrls?: readonly string[] | null;
  activeHouseholdPolicy?: string | null;
  inviteAcceptancePolicy?: string | null;
  joinCreatePermissionPolicy?: string | null;
  roleEnforcementPolicy?: string | null;
  apolloApprovalOwner?: string | null;
  noLaunchBoundary?: string | null;
  nativeProofReference?: string | null;
  localPlaceholderKeysExcluded?: boolean | null;
  secretStorageApproved?: boolean | null;
  strictUserEnumerationProtectionEnabled?: boolean | null;
  secondFactorSignInDisabled?: boolean | null;
  clientTrustSignInDisabled?: boolean | null;
  newPasswordSignInDisabled?: boolean | null;
  nativeSignUpRequiredFields?: readonly string[] | null;
  emailCodeSignUpVerificationEnabled?: boolean | null;
  unsupportedSessionTasksDisabled?: boolean | null;
  oauthStrategy?: string | null;
  oauthSessionCompleted?: boolean | null;
  noLocalPreviewFallback?: boolean | null;
  noBlankScreen?: boolean | null;
  sessionLifetimePolicy?: string | null;
  tokenRefreshPolicy?: string | null;
  signOutPolicy?: string | null;
  revokedSessionPolicy?: string | null;
  secureStoragePolicy?: string | null;
  sessionPolicyApproved?: boolean | null;
  expoSchemeApproved?: boolean | null;
  iosBundleApproved?: boolean | null;
  androidBundleApproved?: boolean | null;
  productionWebApproved?: boolean | null;
  postAuthReturnApproved?: boolean | null;
  crossHouseholdAccessDenied?: boolean | null;
  householdMembershipApproved?: boolean | null;
  apolloApproved?: boolean | null;
}

export interface AuthSetupProofManifestInput {
  clerkProductionApproved?: boolean;
  redirectDeepLinkApproved?: boolean;
  nativeAuthScreensApproved?: boolean;
  setupNativeScreensApproved?: boolean;
  householdSyncApproved?: boolean;
  launchGateApproved?: boolean;
  nativeEvidence?: readonly AuthSetupNativeProofEvidence[];
  providerEvidence?: readonly AuthProviderStructuredProofEvidence[];
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
      "structured Clerk production proof file with Clerk production app id, publishable key environment, secret storage location, strict user-enumeration protection, unsupported native sign-in continuations disabled, unsupported session tasks disabled, exact supported native sign-up requirements, email-code sign-up verification enabled, local-placeholder exclusion, MIME, byte size, and approval booleans.",
  },
  {
    label: "Redirect and deep-link URLs",
    requiredEvidence:
      "structured redirect/deep-link proof file covering Expo scheme, iOS and Android bundle identifiers, production web URL, post-auth return paths, MIME, byte size, and row-specific approvals.",
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
      "structured household membership proof file covering active-household resolution, invite acceptance, join/create permissions, role enforcement, denied cross-household access, MIME, byte size, and row-specific approvals.",
  },
];

export const AUTH_PROVIDER_PROOF_SUMMARY =
  "Production auth provider proof packet: Clerk production app id, strict user-enumeration protection, unsupported native sign-in continuations disabled, unsupported session tasks disabled, exact supported native sign-up requirements, email-code sign-up verification, redirect/deep-link URL list, iOS and Android OAuth sign-in tests proving completion, session policy, and household membership policy before provider-backed account sync or household creation can be claimed.";

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

function providerProofNameText(evidence: AuthProviderStructuredProofEvidence): string {
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

function hasPositiveProofByteSize(evidence: AuthProviderStructuredProofEvidence): boolean {
  return typeof evidence.byteSize === "number" && Number.isFinite(evidence.byteSize) && evidence.byteSize > 0;
}

function hasProofMime(evidence: AuthProviderStructuredProofEvidence): boolean {
  const mime = normalizeEvidenceText(evidence.mimeType);
  return (
    mime === "application json" ||
    mime.endsWith(" json") ||
    mime === "text markdown" ||
    mime === "text plain" ||
    mime === "application pdf"
  );
}

function hasProviderMediaMime(
  evidence: AuthProviderStructuredProofEvidence,
): boolean {
  const mime = normalizeEvidenceText(evidence.mimeType);
  return mime.startsWith("image ") || mime.startsWith("video ");
}

function hasText(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function hasEnoughRedirectUrls(evidence: AuthProviderStructuredProofEvidence): boolean {
  return Array.isArray(evidence.redirectUrls) && evidence.redirectUrls.filter((url) => hasText(url)).length >= 5;
}

function matchesBaseProviderProof(
  evidence: AuthProviderStructuredProofEvidence,
  kind: AuthProviderStructuredProofKind,
  tokenGroups: readonly (readonly string[])[],
): boolean {
  const nameText = providerProofNameText(evidence);
  return (
    evidence.kind === kind &&
    hasAllTokenGroups(nameText, tokenGroups) &&
    hasProofMime(evidence) &&
    hasPositiveProofByteSize(evidence)
  );
}

function matchesClerkProductionProof(evidence: AuthProviderStructuredProofEvidence): boolean {
  const nativeSignUpRequiredFields = [
    ...(evidence.nativeSignUpRequiredFields ?? []),
  ].sort();
  const hasSupportedNativeSignUpRequirements =
    nativeSignUpRequiredFields.length === 2 &&
    nativeSignUpRequiredFields[0] === "email_address" &&
    nativeSignUpRequiredFields[1] === "password";

  return (
    matchesBaseProviderProof(evidence, "clerk-production", [["clerk"], ["production", "auth"]]) &&
    hasText(evidence.productionAppId) &&
    hasText(evidence.publishableKeyEnvironment) &&
    hasText(evidence.secretStorageLocation) &&
    evidence.localPlaceholderKeysExcluded === true &&
    evidence.secretStorageApproved === true &&
    evidence.strictUserEnumerationProtectionEnabled === true &&
    evidence.secondFactorSignInDisabled === true &&
    evidence.clientTrustSignInDisabled === true &&
    evidence.newPasswordSignInDisabled === true &&
    hasSupportedNativeSignUpRequirements &&
    evidence.emailCodeSignUpVerificationEnabled === true &&
    evidence.unsupportedSessionTasksDisabled === true
  );
}

function matchesRedirectDeepLinkProof(evidence: AuthProviderStructuredProofEvidence): boolean {
  return (
    matchesBaseProviderProof(evidence, "redirect-deep-links", [["redirect", "deep"], ["link", "url", "oauth"]]) &&
    hasEnoughRedirectUrls(evidence) &&
    evidence.expoSchemeApproved === true &&
    evidence.iosBundleApproved === true &&
    evidence.androidBundleApproved === true &&
    evidence.productionWebApproved === true &&
    evidence.postAuthReturnApproved === true
  );
}

function matchesHouseholdMembershipProof(evidence: AuthProviderStructuredProofEvidence): boolean {
  return (
    matchesBaseProviderProof(evidence, "household-membership", [["household"], ["membership", "policy", "auth"]]) &&
    hasText(evidence.activeHouseholdPolicy) &&
    hasText(evidence.inviteAcceptancePolicy) &&
    hasText(evidence.joinCreatePermissionPolicy) &&
    hasText(evidence.roleEnforcementPolicy) &&
    evidence.crossHouseholdAccessDenied === true &&
    evidence.householdMembershipApproved === true
  );
}

function matchesOAuthCompletionProof(
  evidence: AuthProviderStructuredProofEvidence,
  platform: AuthSetupNativeProofPlatform,
): boolean {
  const nameText = providerProofNameText(evidence);
  return (
    evidence.kind === "oauth-completion" &&
    evidence.platform === platform &&
    hasAnyToken(nameText, [platform]) &&
    hasAllTokenGroups(nameText, [["oauth", "google"], ["completion", "complete"]]) &&
    hasProviderMediaMime(evidence) &&
    hasPositiveProofByteSize(evidence) &&
    normalizeEvidenceText(evidence.oauthStrategy) === "oauth google" &&
    evidence.oauthSessionCompleted === true &&
    evidence.noLocalPreviewFallback === true &&
    evidence.noBlankScreen === true
  );
}

function matchesSessionTokenPolicyProof(
  evidence: AuthProviderStructuredProofEvidence,
): boolean {
  return (
    matchesBaseProviderProof(
      evidence,
      "session-token-policy",
      [["session"], ["token", "policy"]],
    ) &&
    hasText(evidence.sessionLifetimePolicy) &&
    hasText(evidence.tokenRefreshPolicy) &&
    hasText(evidence.signOutPolicy) &&
    hasText(evidence.revokedSessionPolicy) &&
    hasText(evidence.secureStoragePolicy) &&
    evidence.sessionPolicyApproved === true
  );
}

function matchesLaunchApprovalProof(evidence: AuthProviderStructuredProofEvidence): boolean {
  return (
    matchesBaseProviderProof(evidence, "launch-approval", [["auth", "apollo"], ["launch", "approval", "no launch"]]) &&
    hasText(evidence.apolloApprovalOwner) &&
    hasText(evidence.noLaunchBoundary) &&
    hasText(evidence.nativeProofReference) &&
    evidence.apolloApproved === true
  );
}

function summarizeProviderProof(
  evidence: readonly AuthProviderStructuredProofEvidence[],
  matches: (evidence: AuthProviderStructuredProofEvidence) => boolean,
): { ready: boolean; label: string } {
  const proof = evidence.find(matches);
  return {
    ready: Boolean(proof),
    label: proof ? String(proof.fileName ?? proof.uri ?? "Structured auth provider proof") : "",
  };
}

function summarizeOAuthCompletionProof(
  evidence: readonly AuthProviderStructuredProofEvidence[],
): {
  ready: boolean;
  readyCount: number;
  totalCount: number;
  missingLabels: string[];
} {
  const requirements: ReadonlyArray<{
    platform: AuthSetupNativeProofPlatform;
    label: string;
  }> = [
    { platform: "ios", label: "iOS OAuth completion proof" },
    { platform: "android", label: "Android OAuth completion proof" },
  ];
  const missingLabels = requirements
    .filter(
      ({ platform }) =>
        !evidence.some((item) =>
          matchesOAuthCompletionProof(item, platform),
        ),
    )
    .map(({ label }) => label);
  return {
    ready: missingLabels.length === 0,
    readyCount: requirements.length - missingLabels.length,
    totalCount: requirements.length,
    missingLabels,
  };
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
  const providerEvidence = input.providerEvidence ?? [];
  const authNativeProof = summarizeNativeProof(nativeEvidence, "auth-gateway");
  const setupNativeProof = summarizeNativeProof(nativeEvidence, "setup-local-preview");
  const clerkProductionProof = summarizeProviderProof(providerEvidence, matchesClerkProductionProof);
  const redirectDeepLinkProof = summarizeProviderProof(providerEvidence, matchesRedirectDeepLinkProof);
  const oauthCompletionProof = summarizeOAuthCompletionProof(providerEvidence);
  const sessionTokenPolicyProof = summarizeProviderProof(
    providerEvidence,
    matchesSessionTokenPolicyProof,
  );
  const householdMembershipProof = summarizeProviderProof(providerEvidence, matchesHouseholdMembershipProof);
  const launchApprovalProof = summarizeProviderProof(providerEvidence, matchesLaunchApprovalProof);
  const launchReady =
    launchApprovalProof.ready &&
    clerkProductionProof.ready &&
    redirectDeepLinkProof.ready &&
    oauthCompletionProof.ready &&
    sessionTokenPolicyProof.ready &&
    authNativeProof.ready &&
    setupNativeProof.ready &&
    householdMembershipProof.ready;
  const rows = [
    manifestRow(
      "Clerk production app",
      clerkProductionProof.ready,
      "Clerk proof ready",
      clerkProductionApproved ? "Clerk pending structured proof" : "Clerk pending",
      clerkProductionProof.ready
        ? `${clerkProductionProof.label} proves Clerk production app id, publishable key environment, secret storage, strict user-enumeration protection, unsupported native sign-in continuations disabled, unsupported session tasks disabled, exact supported native sign-up requirements, email-code sign-up verification enabled, and local-placeholder exclusion.`
        : "Clerk production app id, publishable key environment, secret storage, strict user-enumeration protection, unsupported native sign-in continuations disabled (second factor, client trust, and new-password states), unsupported session tasks disabled, supported native sign-up requirements limited to email_address and password, email-code sign-up verification enabled, local-placeholder exclusion, MIME, byte size, and approval booleans must be attached in a structured proof file.",
    ),
    manifestRow(
      "Redirect and deep links",
      redirectDeepLinkProof.ready,
      "Redirect proof ready",
      redirectDeepLinkApproved ? "Redirects pending structured proof" : "Redirects pending",
      redirectDeepLinkProof.ready
        ? `${redirectDeepLinkProof.label} proves Expo scheme, iOS/Android bundle identifiers, production web URL, OAuth return paths, and post-auth routing.`
        : "Expo scheme, iOS and Android bundle identifiers, production web URL, OAuth return paths, post-auth routing, MIME, byte size, and approval booleans must be attached in a structured proof file.",
    ),
    manifestRow(
      "OAuth completion proof",
      oauthCompletionProof.ready,
      `${oauthCompletionProof.totalCount}/${oauthCompletionProof.totalCount} OAuth completion proofs ready`,
      `${oauthCompletionProof.readyCount}/${oauthCompletionProof.totalCount} OAuth completion proofs ready`,
      oauthCompletionProof.ready
        ? "iOS and Android OAuth completion proof confirms oauth_google created a provider session with no local-preview fallback or blank screen."
        : `iOS and Android OAuth completion evidence is missing or incomplete: ${oauthCompletionProof.missingLabels.join(", ")}. Each platform needs an image or video with positive byte size proving oauth_google completed a provider session with no local-preview fallback or blank screen.`,
    ),
    manifestRow(
      "Session and token policy",
      sessionTokenPolicyProof.ready,
      "Session policy ready",
      "Session policy blocked",
      sessionTokenPolicyProof.ready
        ? `${sessionTokenPolicyProof.label} proves the approved session lifetime, token refresh, sign-out behavior, revoked-session handling, and secure storage policy.`
        : "Session lifetime, token refresh, sign-out behavior, revoked-session handling, and secure storage policy must be present in an approved structured proof file with MIME and positive byte size.",
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
      householdMembershipProof.ready,
      "Household sync proof ready",
      householdSyncApproved ? "Household sync pending structured proof" : "Household sync blocked",
      householdMembershipProof.ready
        ? `${householdMembershipProof.label} proves active household selection, invite acceptance, join/create permissions, role enforcement, and denied cross-household access.`
        : "Provider-backed household creation, invite acceptance, active household selection, role enforcement, denied cross-household access, MIME, byte size, and approval booleans must be attached in a structured proof file.",
    ),
    manifestRow(
      "Launch gate",
      launchReady,
      "Native proof approved",
      "Native proof blocked",
      launchReady
        ? `${launchApprovalProof.label} proves Apollo auth launch approval and the no-launch boundary after provider and native proof.`
        : launchGateApproved
          ? "Auth and Setup launch proof is staged, but structured Apollo launch approval/no-launch-boundary proof is still required with provider, OAuth, session, and native evidence."
          : "Auth and Setup launch proof stays blocked until Clerk, redirects, iOS/Android OAuth completion, session/token policy, platform-specific native screenshots, household creation policy, structured Apollo launch approval, and no-launch-boundary proof are attached.",
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
