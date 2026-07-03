export interface StoreAccountsProofItem {
  label: string;
  requiredEvidence: string;
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
