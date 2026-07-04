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

export const STORE_ACCOUNTS_PROOF_ITEMS: readonly StoreAccountsProofItem[] = [
  {
    label: "Apple Developer and App Store Connect access",
    requiredEvidence:
      "Apple Developer team id, App Store Connect app record, paid program status, account holder/admin owner, and bundle access for the WoofWatcher app.",
  },
  {
    label: "Google Play Console package record",
    requiredEvidence:
      "Google Play package record, package name, Play Console owner/admin access, testing track setup, and Play app signing status.",
  },
  {
    label: "Bundle identifiers and signing ownership",
    requiredEvidence:
      "bundle ids, signing certificate and provisioning ownership, EAS credentials handoff, iOS associated domains, Android package id, and release keystore custody.",
  },
  {
    label: "Reviewer access and test credentials",
    requiredEvidence:
      "reviewer access notes, test credentials, demo household data, auth/provider limitations, and exact reviewer instructions for App Review and Play review.",
  },
  {
    label: "Store screenshots and metadata ownership",
    requiredEvidence:
      "store screenshots, app name/subtitle/description, keywords, support URL, privacy labels, age rating, category, and metadata owner approval.",
  },
  {
    label: "Release roles and submission approval",
    requiredEvidence:
      "release role approval, submitter identity, Apollo approval, support/legal sign-off, release track decision, and no-submit boundary before final review.",
  },
];

export const STORE_ACCOUNTS_PROOF_SUMMARY =
  "Apple and Google store accounts proof packet: Apple Developer team id, App Store Connect app record, Google Play package record, bundle ids, reviewer access notes, screenshots/metadata ownership, and release role approval before store submission can be claimed.";

const STORE_ACCOUNTS_PROOF_EVIDENCE_KEYS: readonly (keyof StoreAccountsProofEvidence)[] = [
  "appleDeveloperAccess",
  "googlePlayPackage",
  "bundleSigningOwnership",
  "reviewerAccessCredentials",
  "screenshotsMetadataOwnership",
  "releaseRolesApproval",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildStoreAccountsProofManifest(
  input: StoreAccountsProofEvidence | null | undefined,
): StoreAccountsProofManifest {
  const evidence = input ?? {};
  const items = STORE_ACCOUNTS_PROOF_ITEMS.map<StoreAccountsProofManifestItem>((item, index) => {
    const attached = clean(evidence[STORE_ACCOUNTS_PROOF_EVIDENCE_KEYS[index]]);
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
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
      ? "All Apple and Google store account proof is attached for review before submission can be claimed."
      : "Store submission must stay blocked until Apple/Google account access, bundle/signing ownership, reviewer access, screenshots/metadata, privacy labels, and Apollo release approval proof are attached.",
    readyCount,
    openCount,
    totalCount,
    appSubmissionAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}
