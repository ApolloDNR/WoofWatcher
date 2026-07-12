export interface StoreAccountsProofItem {
  label: string;
  requiredEvidence: string;
}

export type StoreAccountsProofStatus = "blocked" | "ready-for-review";

export interface StoreAccountsProofEvidence {
  appleDeveloperAccess?: string | null;
  googlePlayPackage?: string | null;
  bundleSigningOwnership?: string | null;
  reviewerAccessCredentials?: string | null;
  screenshotsMetadataOwnership?: string | null;
  releaseRolesApproval?: string | null;
  storeAccountEvidence?: readonly StoreAccountEvidence[];
}

export interface StoreAccountsProofManifestItem extends StoreAccountsProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface StoreAccountsProofManifest {
  title: "Store accounts proof manifest";
  status: StoreAccountsProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  appSubmissionAllowed: boolean;
  items: StoreAccountsProofManifestItem[];
  blockers: string[];
}

export type StoreAccountEvidenceKind =
  | "apple-developer-access"
  | "google-play-package"
  | "bundle-signing-ownership"
  | "reviewer-access"
  | "metadata-privacy-ownership"
  | "release-approval";

export type StoreAccountEvidencePlatform = "ios" | "android" | "shared";

export type StoreAccountEvidenceStore = "app-store-connect" | "google-play" | "both";

export interface StoreAccountEvidence {
  kind: StoreAccountEvidenceKind;
  platform: StoreAccountEvidencePlatform;
  store: StoreAccountEvidenceStore;
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  appleDeveloperTeamId?: string | null;
  appStoreConnectAppId?: string | null;
  googlePlayPackageName?: string | null;
  googlePlayConsoleAppId?: string | null;
  accountRole?: string | null;
  testingTrackName?: string | null;
  bundleId?: string | null;
  paidProgramActive?: boolean | null;
  appSigningEnabled?: boolean | null;
  iosBundleId?: string | null;
  androidPackageName?: string | null;
  iosSigningOwner?: string | null;
  androidSigningOwner?: string | null;
  easCredentialsHandoff?: boolean | null;
  associatedDomainsConfirmed?: boolean | null;
  releaseKeystoreCustody?: boolean | null;
  reviewerUsername?: string | null;
  reviewerInstructions?: string | null;
  demoHouseholdReady?: boolean | null;
  authLimitationsNamed?: boolean | null;
  screenshotsApproved?: boolean | null;
  privacyLabelsApproved?: boolean | null;
  supportUrlApproved?: boolean | null;
  ageRatingApproved?: boolean | null;
  metadataOwnerApproved?: boolean | null;
  releaseTrackName?: string | null;
  submitterIdentity?: string | null;
  supportLegalApproved?: boolean | null;
  apolloApproved?: boolean | null;
  noSubmitBoundaryAcknowledged?: boolean | null;
}

export const STORE_ACCOUNTS_PROOF_ITEMS: readonly StoreAccountsProofItem[] = [
  {
    label: "Apple Developer and App Store Connect access",
    requiredEvidence:
      "Apple Developer team id, App Store Connect app record, paid program status, account holder/admin owner, and bundle access for the WoofWatcher app in an iOS App Store Connect developer account proof file named for iOS/App Store Connect with MIME and byte size.",
  },
  {
    label: "Google Play Console package record",
    requiredEvidence:
      "Google Play package record, package name, Play Console app id, owner/admin access, testing track setup, and Play app signing status in an Android Google Play package proof file named for Android/Google Play with MIME and byte size.",
  },
  {
    label: "Bundle identifiers and signing ownership",
    requiredEvidence:
      "platform/store-named proof file for iOS and Android bundle ids, signing certificate and provisioning ownership, EAS credentials handoff, iOS associated domains, Android package id, and release keystore custody.",
  },
  {
    label: "Reviewer access and test credentials",
    requiredEvidence:
      "reviewer access notes, test credentials, demo household data, auth/provider limitations, and exact reviewer instructions for App Review and Play review in a platform/store-named reviewer access proof file.",
  },
  {
    label: "Store screenshots and metadata ownership",
    requiredEvidence:
      "store screenshots, app name/subtitle/description, keywords, support URL, privacy labels, age rating, category, and metadata owner approval in a platform/store-named metadata proof file.",
  },
  {
    label: "Release roles and submission approval",
    requiredEvidence:
      "release role approval, Apollo approval, submitter identity, support/legal sign-off, release track decision, and no-submit boundary in an Apollo release approval proof file before final App Review or Play review upload.",
  },
];

export const STORE_ACCOUNTS_PROOF_SUMMARY =
  "Apple and Google store accounts proof packet: platform/store-named Apple Developer team id, App Store Connect app record, Google Play package record, bundle ids, reviewer access notes, screenshots/metadata ownership, and Apollo release role approval proof before store submission can be claimed.";

type EvidenceTextField = keyof Pick<
  StoreAccountEvidence,
  | "appleDeveloperTeamId"
  | "appStoreConnectAppId"
  | "googlePlayPackageName"
  | "googlePlayConsoleAppId"
  | "accountRole"
  | "testingTrackName"
  | "bundleId"
  | "iosBundleId"
  | "androidPackageName"
  | "iosSigningOwner"
  | "androidSigningOwner"
  | "reviewerUsername"
  | "reviewerInstructions"
  | "releaseTrackName"
  | "submitterIdentity"
>;

type EvidenceBooleanField = keyof Pick<
  StoreAccountEvidence,
  | "paidProgramActive"
  | "appSigningEnabled"
  | "easCredentialsHandoff"
  | "associatedDomainsConfirmed"
  | "releaseKeystoreCustody"
  | "demoHouseholdReady"
  | "authLimitationsNamed"
  | "screenshotsApproved"
  | "privacyLabelsApproved"
  | "supportUrlApproved"
  | "ageRatingApproved"
  | "metadataOwnerApproved"
  | "supportLegalApproved"
  | "apolloApproved"
  | "noSubmitBoundaryAcknowledged"
>;

interface StoreAccountEvidenceRequirement {
  kind: StoreAccountEvidenceKind;
  platform: StoreAccountEvidencePlatform;
  store: StoreAccountEvidenceStore;
  locatorTokens: readonly string[];
  textFields: readonly EvidenceTextField[];
  booleanFields: readonly EvidenceBooleanField[];
  readyLabel: string;
}

const STORE_ACCOUNT_EVIDENCE_REQUIREMENTS: readonly StoreAccountEvidenceRequirement[] = [
  {
    kind: "apple-developer-access",
    platform: "ios",
    store: "app-store-connect",
    locatorTokens: ["ios", "app-store-connect", "apple-developer"],
    textFields: ["appleDeveloperTeamId", "appStoreConnectAppId", "accountRole", "bundleId"],
    booleanFields: ["paidProgramActive"],
    readyLabel: "iOS App Store Connect developer account proof ready",
  },
  {
    kind: "google-play-package",
    platform: "android",
    store: "google-play",
    locatorTokens: ["android", "google-play"],
    textFields: ["googlePlayPackageName", "googlePlayConsoleAppId", "accountRole", "testingTrackName"],
    booleanFields: ["appSigningEnabled"],
    readyLabel: "Android Google Play package proof ready",
  },
  {
    kind: "bundle-signing-ownership",
    platform: "shared",
    store: "both",
    locatorTokens: ["ios", "android", "bundle-signing"],
    textFields: ["iosBundleId", "androidPackageName", "iosSigningOwner", "androidSigningOwner"],
    booleanFields: ["easCredentialsHandoff", "associatedDomainsConfirmed", "releaseKeystoreCustody"],
    readyLabel: "iOS/Android bundle and signing ownership proof ready",
  },
  {
    kind: "reviewer-access",
    platform: "shared",
    store: "both",
    locatorTokens: ["app-store-connect", "google-play", "reviewer-access"],
    textFields: ["reviewerUsername", "reviewerInstructions"],
    booleanFields: ["demoHouseholdReady", "authLimitationsNamed"],
    readyLabel: "App Review and Play review access proof ready",
  },
  {
    kind: "metadata-privacy-ownership",
    platform: "shared",
    store: "both",
    locatorTokens: ["app-store-connect", "google-play", "metadata-privacy"],
    textFields: [],
    booleanFields: [
      "screenshotsApproved",
      "privacyLabelsApproved",
      "supportUrlApproved",
      "ageRatingApproved",
      "metadataOwnerApproved",
    ],
    readyLabel: "Store screenshots, metadata, and privacy proof ready",
  },
  {
    kind: "release-approval",
    platform: "shared",
    store: "both",
    locatorTokens: ["app-store-connect", "google-play", "release-approval"],
    textFields: ["releaseTrackName", "submitterIdentity"],
    booleanFields: ["supportLegalApproved", "apolloApproved", "noSubmitBoundaryAcknowledged"],
    readyLabel: "Apollo release approval and no-submit boundary proof ready",
  },
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown): string {
  return clean(value).toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasProofMime(value: unknown): boolean {
  const mime = normalize(value);
  return (
    mime === "application/pdf" ||
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/jpg" ||
    mime === "image/webp"
  );
}

function evidenceMatchesRequirement(
  evidence: StoreAccountEvidence,
  requirement: StoreAccountEvidenceRequirement,
): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)} ${normalize(evidence.store)}`;
  return (
    evidence.kind === requirement.kind &&
    evidence.platform === requirement.platform &&
    evidence.store === requirement.store &&
    requirement.locatorTokens.every((token) => locator.includes(token)) &&
    hasProofMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    requirement.textFields.every((field) => clean(evidence[field]).length > 0) &&
    requirement.booleanFields.every((field) => evidence[field] === true)
  );
}

export function buildStoreAccountsProofManifest(
  input: StoreAccountsProofEvidence | null | undefined,
): StoreAccountsProofManifest {
  const evidence = input ?? {};
  const attachedEvidence = evidence.storeAccountEvidence ?? [];
  const items = STORE_ACCOUNTS_PROOF_ITEMS.map<StoreAccountsProofManifestItem>((item, index) => {
    const requirement = STORE_ACCOUNT_EVIDENCE_REQUIREMENTS[index];
    const matched = requirement
      ? attachedEvidence.find((candidate) => evidenceMatchesRequirement(candidate, requirement))
      : undefined;
    return {
      ...item,
      status: matched ? "ready" : "blocked",
      evidenceAttached: matched && requirement ? [requirement.readyLabel] : [],
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const appSubmissionAllowed = openCount === 0;

  return {
    title: "Store accounts proof manifest",
    status: appSubmissionAllowed ? "ready-for-review" : "blocked",
    statusLabel: appSubmissionAllowed ? "Ready for store review" : "Store submission blocked",
    summary: appSubmissionAllowed
      ? "All platform/store-named Apple and Google store account proof files are attached for review before submission can be claimed."
      : "Store submission must stay blocked until Apple/Google account access includes iOS App Store Connect developer account proof, Android Google Play package proof, platform/store-named proof file evidence for bundle/signing ownership, reviewer access, screenshots/metadata, privacy labels, and Apollo release approval proof.",
    readyCount,
    openCount,
    totalCount,
    appSubmissionAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}
