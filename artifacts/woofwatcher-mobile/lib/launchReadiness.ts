export type LaunchReadinessOverallStatus =
  | "internal-preview"
  | "native-qa-required"
  | "provider-gated"
  | "approval-required"
  | "store-ready";

export type LaunchReadinessTileStatus = "ready" | "review" | "blocked" | "local";

export type LaunchReadinessTileKey =
  | "native-qa"
  | "care-sync"
  | "storage"
  | "woofguide-ai"
  | "plus-payments"
  | "store-approval";

export type LaunchReadinessNextGateKind =
  | "native-qa"
  | "local-foundation"
  | "provider-setup"
  | "owner-approval"
  | "store-submission";

export type LaunchReadinessNextGateAction =
  | "open-native-qa"
  | "share-native-qa-fix-brief"
  | "open-provider-setup"
  | "open-privacy"
  | "open-premium"
  | "open-woofguide"
  | "open-avatar-studio"
  | "share-beta-handoff"
  | "share-launch-packet"
  | "share-store-packet";

export interface LaunchReadinessNativeQaSummary {
  total: number;
  passed: number;
  needsReview: number;
  unreviewed: number;
  requiredScreenshots: number;
  missingScreenshots: number;
  missingIosScreenshots: number;
  missingAndroidScreenshots: number;
  missingAnyScreenshots: number;
}

export interface LaunchReadinessLocalInput {
  careWorkflowsReady?: boolean;
  easProfilesReady?: boolean;
  pixelAssetsReady?: boolean;
  privacyExportReady?: boolean;
}

export interface LaunchReadinessStorageQueueInput {
  total?: number;
  localOnly?: number;
  uploadReady?: number;
  providerSaved?: number;
  labels?: readonly string[];
  detail?: string;
}

export interface LaunchReadinessStorageProviderEvidence {
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  bucketNames?: readonly string[] | null;
  signedUploadPolicy?: string | null;
  signedDownloadPolicy?: string | null;
  householdScopePolicy?: string | null;
  retentionPolicy?: string | null;
  exportPolicy?: string | null;
  deletionPolicy?: string | null;
  qaEvidenceStoragePolicy?: string | null;
  apolloApprovalOwner?: string | null;
  signedAccessApproved?: boolean | null;
  householdScopeApproved?: boolean | null;
  retentionExportDeletionApproved?: boolean | null;
  qaEvidenceStorageApproved?: boolean | null;
  apolloApproved?: boolean | null;
  householdScoped?: boolean | null;
  signedUploadApproved?: boolean | null;
  signedDownloadApproved?: boolean | null;
  retentionApproved?: boolean | null;
  exportApproved?: boolean | null;
  deletionApproved?: boolean | null;
}

export interface LaunchReadinessProviderInput {
  accountDeletionEnabled?: boolean;
  accountDeletionProofReady?: boolean;
  aiProviderConfigured?: boolean;
  aiProviderProofReady?: boolean;
  appStoreAccountsReady?: boolean;
  authProviderProofReady?: boolean;
  authConfigured?: boolean;
  databaseConfigured?: boolean;
  databaseProviderProofReady?: boolean;
  paymentsEnabled?: boolean;
  paymentsProviderProofReady?: boolean;
  privacyLegalApproved?: boolean;
  privacyLegalOwnerReviewed?: boolean;
  privacyLegalProofReady?: boolean;
  pushNotificationsConfigured?: boolean;
  pushNotificationsProofReady?: boolean;
  storeAccountsProofReady?: boolean;
  storageProviderConfigured?: boolean;
  storageProviderEvidence?: LaunchReadinessStorageProviderEvidence | null;
  storageProviderProofReady?: boolean;
  storageQueue?: LaunchReadinessStorageQueueInput;
  supportRunbookApproved?: boolean;
  supportRunbookOwnerReviewed?: boolean;
  supportRunbookProofReady?: boolean;
}

export interface LaunchReadinessInput {
  nativeQa?: LaunchReadinessNativeQaSummary | null;
  local?: LaunchReadinessLocalInput;
  provider?: LaunchReadinessProviderInput;
  syncStatus?: string;
}

export interface LaunchReadinessTile {
  key: LaunchReadinessTileKey;
  label: string;
  value: string;
  detail: string;
  status: LaunchReadinessTileStatus;
}

export interface LaunchReadinessNextGate {
  kind: LaunchReadinessNextGateKind;
  action: LaunchReadinessNextGateAction;
  label: string;
  detail: string;
  ctaLabel: string;
}

export interface LaunchReadinessPlan {
  status: LaunchReadinessOverallStatus;
  badgeLabel: string;
  storeLaunchReady: boolean;
  summary: string;
  tiles: LaunchReadinessTile[];
  nextGate: LaunchReadinessNextGate;
  blockers: string[];
  nextActions: string[];
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : pluralLabel}`;
}

export function launchReadinessBadgeLabel(status: LaunchReadinessOverallStatus): string {
  switch (status) {
    case "store-ready":
      return "STORE READY";
    case "approval-required":
      return "APPROVAL OPEN";
    case "provider-gated":
      return "PROVIDER GATED";
    case "native-qa-required":
      return "NATIVE QA OPEN";
    default:
      return "INTERNAL PREVIEW";
  }
}

function nativeQaComplete(nativeQa: LaunchReadinessNativeQaSummary | null | undefined): boolean {
  return Boolean(
    nativeQa &&
      nativeQa.total > 0 &&
      nativeQa.passed >= nativeQa.total &&
      nativeQa.needsReview === 0 &&
      nativeQa.unreviewed === 0 &&
      nativeQa.missingScreenshots === 0 &&
      nativeQa.missingIosScreenshots === 0 &&
      nativeQa.missingAndroidScreenshots === 0 &&
      nativeQa.missingAnyScreenshots === 0,
  );
}

function nativeQaTile(nativeQa: LaunchReadinessNativeQaSummary | null | undefined): LaunchReadinessTile {
  if (!nativeQa) {
    return {
      key: "native-qa",
      label: "iOS + Android",
      value: "Device proof required",
      detail: "Attach real iOS and Android screenshots in Care Twin QA before any public release.",
      status: "blocked",
    };
  }

  if (nativeQaComplete(nativeQa)) {
    return {
      key: "native-qa",
      label: "iOS + Android",
      value: "Device proof ready",
      detail: `${nativeQa.passed}/${nativeQa.total} launch-critical surfaces passed with required platform evidence.`,
      status: "ready",
    };
  }

  const missing = nativeQa.missingScreenshots;
  const reviewOpen = nativeQa.needsReview + nativeQa.unreviewed;

  return {
    key: "native-qa",
    label: "iOS + Android",
    value: missing > 0 ? `${plural(missing, "screenshot")} missing` : `${plural(reviewOpen, "surface")} open`,
    detail: `Need iOS ${nativeQa.missingIosScreenshots}, Android ${nativeQa.missingAndroidScreenshots}, flexible ${nativeQa.missingAnyScreenshots}; ${nativeQa.passed}/${nativeQa.total} surfaces passed.`,
    status: missing > 0 ? "blocked" : "review",
  };
}

function authProviderReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.authConfigured && provider.authProviderProofReady);
}

function databaseProviderReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.databaseConfigured && provider.databaseProviderProofReady);
}

function aiProviderReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.aiProviderConfigured && provider.aiProviderProofReady);
}

function paymentsProviderReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.paymentsEnabled && provider.paymentsProviderProofReady);
}

function pushNotificationsReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.pushNotificationsConfigured && provider.pushNotificationsProofReady);
}

function storeAccountsReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.appStoreAccountsReady && provider.storeAccountsProofReady);
}

function accountDeletionReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.accountDeletionEnabled && provider.accountDeletionProofReady);
}

function privacyLegalReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.privacyLegalApproved && provider.privacyLegalProofReady);
}

function supportRunbookReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.supportRunbookApproved && provider.supportRunbookProofReady);
}

function careSyncTile(syncStatus: string | undefined, provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  if (syncStatus === "attention") {
    return {
      key: "care-sync",
      label: "Care Sync",
      value: "Needs review",
      detail: "Resolve sync attention before treating household logs as release-stable.",
      status: "review",
    };
  }

  if (syncStatus === "syncing" || syncStatus === "loading") {
    return {
      key: "care-sync",
      label: "Care Sync",
      value: "Syncing",
      detail: "Wait for care logs and household state to finish syncing before QA sign-off.",
      status: "review",
    };
  }

  if (authProviderReady(provider) && databaseProviderReady(provider)) {
    return {
      key: "care-sync",
      label: "Care Sync",
      value: "Household sync ready",
      detail: "Auth, household, and database sync are configured for production review.",
      status: "ready",
    };
  }

  return {
    key: "care-sync",
    label: "Care Sync",
    value: "Local preview",
    detail: "Care workflows run locally, but production auth/database sync still needs provider approval.",
    status: "local",
  };
}

function queueTotal(queue: LaunchReadinessStorageQueueInput | undefined): number {
  return Math.max(0, Math.floor(queue?.total ?? 0));
}

function queueUploadReady(queue: LaunchReadinessStorageQueueInput | undefined): number {
  return Math.max(0, Math.floor(queue?.uploadReady ?? 0));
}

function storageQueueDetail(queue: LaunchReadinessStorageQueueInput | undefined): string {
  const detail = typeof queue?.detail === "string" ? queue.detail.trim() : "";
  if (detail) return detail;

  const labels = Array.isArray(queue?.labels) ? queue.labels.map((label) => label.trim()).filter(Boolean) : [];
  if (labels.length) {
    return `Local files across ${labels.join(", ")} need storage, signed access, retention, export, and deletion rules.`;
  }

  return "Document uploads, proof photos, and Care Pass attachments stay local until storage rules are approved.";
}

function storageProviderReady(provider: LaunchReadinessProviderInput): boolean {
  return Boolean(provider.storageProviderConfigured && provider.storageProviderProofReady);
}

function storageTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  const totalQueued = queueTotal(provider.storageQueue);
  const uploadReady = queueUploadReady(provider.storageQueue);

  if (storageProviderReady(provider)) {
    return uploadReady > 0
      ? {
          key: "storage",
          label: "Records Storage",
          value: `${plural(uploadReady, "upload")} ready`,
          detail: storageQueueDetail(provider.storageQueue),
          status: "review",
        }
      : {
          key: "storage",
          label: "Records Storage",
          value: "Storage rules ready",
          detail: "Record uploads can be household-scoped with retention, export, and deletion rules.",
          status: "ready",
        };
  }

  return {
    key: "storage",
    label: "Records Storage",
    value: totalQueued > 0 ? `${plural(totalQueued, "local file")} gated` : "Storage proof gated",
    detail: provider.storageProviderConfigured
      ? storageQueueDetail(provider.storageQueue) ||
        "Structured storage proof must cover buckets, signed access, household scope, retention, export, deletion, QA evidence storage, and Apollo approval."
      : storageQueueDetail(provider.storageQueue),
    status: "blocked",
  };
}

function aiTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  if (aiProviderReady(provider)) {
    return {
      key: "woofguide-ai",
      label: "WoofGuide",
      value: "AI policy ready",
      detail: "WoofGuide can use provider-backed AI with owner review and veterinary boundary language.",
      status: "ready",
    };
  }

  if (provider.aiProviderConfigured) {
    return {
      key: "woofguide-ai",
      label: "WoofGuide",
      value: "AI proof gated",
      detail: "Provider AI setup is staged, but structured key, model, source, write-gate, veterinary, and fallback proof must be attached before live AI opens.",
      status: "review",
    };
  }

  return {
    key: "woofguide-ai",
    label: "WoofGuide",
    value: "Limited mode",
    detail: "Assistant surfaces stay deterministic/fallback until provider keys, model policy, and disclosures are approved.",
    status: "review",
  };
}

function paymentsApprovalGaps(provider: LaunchReadinessProviderInput): string[] {
  const gaps: string[] = [];
  if (!storeAccountsReady(provider)) gaps.push("store-account proof");
  if (!privacyLegalReady(provider)) gaps.push("privacy/legal proof");
  if (!supportRunbookReady(provider)) gaps.push("support/refund policy proof");
  return gaps;
}

function paymentsTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  if (!paymentsProviderReady(provider)) {
    if (provider.paymentsEnabled) {
      return {
        key: "plus-payments",
        label: "WoofWatcher Plus",
        value: "Checkout proof gated",
        detail:
          "Payment provider setup is staged, but structured sandbox receipt, restore, entitlement, refund/support, and checkout proof must be attached before checkout opens.",
        status: "blocked",
      };
    }

    return {
      key: "plus-payments",
      label: "WoofWatcher Plus",
      value: "Checkout gated",
      detail: "Premium entitlement preview is safe, but paid checkout must stay disabled until launch approvals are complete.",
      status: "blocked",
    };
  }

  const approvalGaps = paymentsApprovalGaps(provider);
  if (approvalGaps.length) {
    return {
      key: "plus-payments",
      label: "WoofWatcher Plus",
      value: "Checkout approval open",
      detail: `Payment provider proof is staged, but ${approvalGaps.join(", ")} must close before paid checkout goes live.`,
      status: "review",
    };
  }

  return {
    key: "plus-payments",
    label: "WoofWatcher Plus",
    value: "Checkout ready",
    detail: "Subscriptions can run under approved product, refund, support, and app-store terms.",
    status: "ready",
  };
}

function approvalTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  const ready =
    accountDeletionReady(provider) &&
    storeAccountsReady(provider) &&
    privacyLegalReady(provider) &&
    pushNotificationsReady(provider) &&
    supportRunbookReady(provider);
  const ownerPacketStaged = Boolean(provider.privacyLegalOwnerReviewed || provider.supportRunbookOwnerReviewed);

  if (ready) {
    return {
      key: "store-approval",
      label: "Store Gates",
      value: "Approval ready",
      detail: "App-store accounts, privacy/legal, support, deletion, and notification obligations are closed.",
      status: "ready",
    };
  }

  if (ownerPacketStaged) {
    return {
      key: "store-approval",
      label: "Store Gates",
      value: "Owner packet staged",
      detail: "Support and privacy packet details are staged locally, but final legal, store, deletion, and notification approvals remain open.",
      status: "review",
    };
  }

  return {
    key: "store-approval",
    label: "Store Gates",
    value: "Approval open",
    detail: "Apple, Google, privacy/legal, support, push notification, and account deletion gates need owner approval.",
    status: "review",
  };
}

function localBlockers(local: LaunchReadinessLocalInput): string[] {
  const blockers: string[] = [];
  if (!local.careWorkflowsReady) blockers.push("Core care workflows still need readiness sign-off.");
  if (!local.easProfilesReady) blockers.push("EAS build profiles or Expo release setup are not verified.");
  if (!local.pixelAssetsReady) blockers.push("PixelLab production asset verification is not complete.");
  if (!local.privacyExportReady) blockers.push("Privacy export and deletion surfaces need readiness sign-off.");
  return blockers;
}

function providerBlockers(provider: LaunchReadinessProviderInput): string[] {
  const blockers: string[] = [];
  if (!authProviderReady(provider)) {
    blockers.push(
      provider.authConfigured
        ? "Production auth requires structured auth provider proof evidence."
        : "Production auth is not configured.",
    );
  }
  if (!databaseProviderReady(provider)) {
    blockers.push(
      provider.databaseConfigured
        ? "Production household database sync requires structured care-entry provider sync proof evidence."
        : "Production household database sync is not configured.",
    );
  }
  if (!storageProviderReady(provider)) {
    blockers.push(
      provider.storageProviderConfigured
        ? "Document storage provider requires structured storage proof evidence."
        : "Document storage provider and access rules are not approved.",
    );
  }
  if (storageProviderReady(provider) && queueUploadReady(provider.storageQueue) > 0) {
    blockers.push("Local attachment upload queue needs provider migration verification.");
  }
  if (!aiProviderReady(provider)) {
    blockers.push(
      provider.aiProviderConfigured
        ? "AI provider setup requires structured AI provider proof evidence."
        : "AI provider key, model policy, and disclosure workflow are not configured.",
    );
  }
  if (!paymentsProviderReady(provider)) {
    blockers.push(
      provider.paymentsEnabled
        ? "Payments require structured payments proof evidence."
        : "Payments remain blocked until subscription, support, refund, and app-store obligations are approved.",
    );
  }
  return blockers;
}

function approvalBlockers(provider: LaunchReadinessProviderInput): string[] {
  const blockers: string[] = [];
  if (!accountDeletionReady(provider)) {
    blockers.push(
      provider.accountDeletionEnabled
        ? "Self-serve account deletion requires structured account-deletion proof evidence."
        : "Self-serve account deletion is not enabled.",
    );
  }
  if (!pushNotificationsReady(provider)) {
    blockers.push(
      provider.pushNotificationsConfigured
        ? "Push notifications require structured APNs/FCM delivery proof evidence."
        : "Push notifications are not configured.",
    );
  }
  if (!storeAccountsReady(provider)) {
    blockers.push(
      provider.appStoreAccountsReady
        ? "Apple and Google store accounts require structured store-account proof evidence."
        : "Apple and Google store accounts/submission setup are not confirmed.",
    );
  }
  if (!privacyLegalReady(provider)) {
    blockers.push(
      provider.privacyLegalApproved
        ? "Privacy/legal approval requires structured privacy/legal proof evidence."
        : provider.privacyLegalOwnerReviewed
          ? "Privacy/legal owner packet still needs final legal/provider approval."
          : "Privacy/legal approval is still open.",
    );
  }
  if (!supportRunbookReady(provider)) {
    blockers.push(
      provider.supportRunbookApproved
        ? "Support runbook approval requires structured support/refund proof evidence."
        : provider.supportRunbookOwnerReviewed
          ? "Support runbook owner packet still needs final support/provider approval."
          : "Support and incident-response runbook approval is still open.",
    );
  }
  return blockers;
}

function nativeBlockers(nativeQa: LaunchReadinessNativeQaSummary | null | undefined): string[] {
  if (nativeQaComplete(nativeQa)) return [];
  if (!nativeQa) return ["Native iOS/Android QA evidence is not attached."];
  return [
    `Native iOS/Android QA still needs ${plural(nativeQa.missingScreenshots, "screenshot")} and ${plural(
      nativeQa.needsReview + nativeQa.unreviewed,
      "surface",
    )} resolved.`,
  ];
}

function nativeNextGate(nativeQa: LaunchReadinessNativeQaSummary | null | undefined): LaunchReadinessNextGate | null {
  if (nativeQaComplete(nativeQa)) return null;

  if (!nativeQa) {
    return {
      kind: "native-qa",
      action: "open-native-qa",
      label: "Capture iOS + Android proof",
      detail:
        "Open Care Twin QA and attach real device screenshots before sharing the build outside owner/internal review.",
      ctaLabel: "Open QA Cockpit",
    };
  }

  if (nativeQa.needsReview > 0) {
    return {
      kind: "native-qa",
      action: "share-native-qa-fix-brief",
      label: "Resolve Needs tune routes",
      detail: `${plural(nativeQa.needsReview, "route")} marked Needs tune. Share the fix brief, repair the first visible issue, then retest in Care Twin QA.`,
      ctaLabel: "Share Fix Brief",
    };
  }

  if (nativeQa.missingScreenshots > 0) {
    return {
      kind: "native-qa",
      action: "open-native-qa",
      label: "Attach missing device screenshots",
      detail: `Need iOS ${nativeQa.missingIosScreenshots}, Android ${nativeQa.missingAndroidScreenshots}, and flexible ${nativeQa.missingAnyScreenshots} screenshots for store-facing proof.`,
      ctaLabel: "Continue QA",
    };
  }

  if (nativeQa.unreviewed > 0) {
    return {
      kind: "native-qa",
      action: "open-native-qa",
      label: "Review remaining QA surfaces",
      detail: `${plural(nativeQa.unreviewed, "surface")} still needs Pass or Needs tune before this build can move forward.`,
      ctaLabel: "Open QA Cockpit",
    };
  }

  return {
    kind: "native-qa",
    action: "open-native-qa",
    label: "Finish native QA proof",
    detail: "Care Twin QA still has an unresolved device-proof gate. Reopen the cockpit and refresh the saved evidence.",
    ctaLabel: "Open QA Cockpit",
  };
}

function localNextGate(local: LaunchReadinessLocalInput): LaunchReadinessNextGate | null {
  if (!local.careWorkflowsReady) {
    return {
      kind: "local-foundation",
      action: "open-native-qa",
      label: "Verify core care workflows",
      detail: "Run Home, Log, Plans, Health, More, Adventure, Care Pass, Avatar Studio, and WoofGuide through the QA cockpit.",
      ctaLabel: "Open QA Cockpit",
    };
  }

  if (!local.easProfilesReady) {
    return {
      kind: "local-foundation",
      action: "share-beta-handoff",
      label: "Verify Expo/EAS profiles",
      detail: "Confirm the Expo release setup, build profiles, and dependency proof before handing the beta to testers.",
      ctaLabel: "Share Beta Handoff",
    };
  }

  if (!local.pixelAssetsReady) {
    return {
      kind: "local-foundation",
      action: "open-avatar-studio",
      label: "Verify PixelLab production assets",
      detail: "Run the pixel asset verifier and confirm Phoenix sprites, room scenes, badges, and icon assets are not placeholders.",
      ctaLabel: "Open Avatar Studio",
    };
  }

  if (!local.privacyExportReady) {
    return {
      kind: "local-foundation",
      action: "open-privacy",
      label: "Verify privacy export and deletion",
      detail: "Confirm export, deletion, storage-disclosure, and account-safety surfaces before public accounts are enabled.",
      ctaLabel: "Open Privacy",
    };
  }

  return null;
}

function providerNextGate(
  provider: LaunchReadinessProviderInput,
  syncTile: LaunchReadinessTile,
): LaunchReadinessNextGate | null {
  if (syncTile.status === "review") {
    return {
      kind: "provider-setup",
      action: "open-provider-setup",
      label: "Resolve Care Sync attention",
      detail: syncTile.detail,
      ctaLabel: "Edit Provider Plan",
    };
  }

  if (!authProviderReady(provider) || !databaseProviderReady(provider)) {
    const proofStaged = provider.authConfigured || provider.databaseConfigured;
    return {
      kind: "provider-setup",
      action: "open-provider-setup",
      label: proofStaged ? "Attach production care sync proof" : "Configure production care sync",
      detail: proofStaged
        ? "Structured auth and care-entry provider sync proof must be attached before logs can be treated as release-stable."
        : "Production auth and household database sync must be configured before logs can be treated as release-stable.",
      ctaLabel: "Edit Provider Plan",
    };
  }

  if (!storageProviderReady(provider)) {
    return {
      kind: "provider-setup",
      action: "open-provider-setup",
      label: provider.storageProviderConfigured ? "Attach records storage proof" : "Approve records storage",
      detail: storageQueueDetail(provider.storageQueue),
      ctaLabel: "Edit Provider Plan",
    };
  }

  if (queueUploadReady(provider.storageQueue) > 0) {
    return {
      kind: "provider-setup",
      action: "open-provider-setup",
      label: "Verify attachment migration",
      detail: storageQueueDetail(provider.storageQueue),
      ctaLabel: "Edit Provider Plan",
    };
  }

  if (!aiProviderReady(provider)) {
    return {
      kind: "provider-setup",
      action: "open-woofguide",
      label: provider.aiProviderConfigured ? "Attach WoofGuide AI proof" : "Approve WoofGuide AI policy",
      detail: provider.aiProviderConfigured
        ? "Structured AI provider proof must cover key storage, model policy, source rules, owner-review write gate, veterinary safety, and fallback handling."
        : "Provider key, model behavior, owner review, and veterinary-boundary disclosures must be configured truthfully.",
      ctaLabel: "Open WoofGuide",
    };
  }

  if (!paymentsProviderReady(provider)) {
    return {
      kind: "provider-setup",
      action: "open-premium",
      label: provider.paymentsEnabled ? "Attach Plus checkout proof" : "Approve Plus checkout",
      detail: provider.paymentsEnabled
        ? "Structured payments proof must cover sandbox receipts, restore behavior, entitlements, refund/support, store obligations, and checkout gate approval."
        : "Subscriptions, refunds, support, entitlements, and app-store billing obligations must be approved before checkout goes live.",
      ctaLabel: "Open Premium",
    };
  }

  return null;
}

function approvalNextGate(provider: LaunchReadinessProviderInput): LaunchReadinessNextGate | null {
  const approvalGaps = approvalBlockers(provider);
  if (!approvalGaps.length) return null;

  return {
    kind: "owner-approval",
    action: "share-launch-packet",
    label: "Complete owner and store approvals",
    detail: approvalGaps[0],
    ctaLabel: "Share Launch Packet",
  };
}

function readyNextGate(): LaunchReadinessNextGate {
  return {
    kind: "store-submission",
    action: "share-store-packet",
    label: "Prepare store submission packet",
    detail: "All current readiness gates are closed. Package the App Store and Play Store submission materials for final owner sign-off.",
    ctaLabel: "Share Store Packet",
  };
}

function deriveNextGate(
  input: LaunchReadinessInput,
  local: LaunchReadinessLocalInput,
  provider: LaunchReadinessProviderInput,
  syncTile: LaunchReadinessTile,
): LaunchReadinessNextGate {
  return (
    nativeNextGate(input.nativeQa) ??
    localNextGate(local) ??
    providerNextGate(provider, syncTile) ??
    approvalNextGate(provider) ??
    readyNextGate()
  );
}

export function deriveLaunchReadiness(input: LaunchReadinessInput): LaunchReadinessPlan {
  const local = input.local ?? {};
  const provider = input.provider ?? {};
  const nativeGaps = nativeBlockers(input.nativeQa);
  const localGaps = localBlockers(local);
  const providerGaps = providerBlockers(provider);
  const approvalGaps = approvalBlockers(provider);
  const syncTile = careSyncTile(input.syncStatus, provider);
  const syncGaps = syncTile.status === "review" ? ["Care sync has open attention before release sign-off."] : [];
  const blockers = [...nativeGaps, ...localGaps, ...providerGaps, ...approvalGaps, ...syncGaps];

  let status: LaunchReadinessOverallStatus = "store-ready";
  if (nativeGaps.length) {
    status = input.nativeQa ? "native-qa-required" : "internal-preview";
  } else if (localGaps.length || providerGaps.length || syncGaps.length) {
    status = "provider-gated";
  } else if (approvalGaps.length) {
    status = "approval-required";
  }

  const storeLaunchReady = status === "store-ready";
  const tiles = [
    nativeQaTile(input.nativeQa),
    syncTile,
    storageTile(provider),
    aiTile(provider),
    paymentsTile(provider),
    approvalTile(provider),
  ];

  const summary = storeLaunchReady
    ? "WoofWatcher is ready for release submission after final owner sign-off."
    : status === "native-qa-required" || status === "internal-preview"
      ? "WoofWatcher is hardened for internal review, but public launch still needs native device proof and provider approvals."
      : status === "provider-gated"
        ? "The app foundation is usable, but provider-backed sync, storage, AI, payments, or local release gates remain open."
        : "The product foundation is ready, but store, privacy/legal, support, or owner approvals remain open.";

  const nextActions = blockers.slice(0, 4).map((blocker) => `Close: ${blocker}`);
  if (!nextActions.length) nextActions.push("Prepare App Store and Play Store release submission packet.");
  const nextGate = deriveNextGate(input, local, provider, syncTile);

  return {
    status,
    badgeLabel: launchReadinessBadgeLabel(status),
    storeLaunchReady,
    summary,
    tiles,
    nextGate,
    blockers,
    nextActions,
  };
}
