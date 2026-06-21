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

export interface LaunchReadinessProviderInput {
  accountDeletionEnabled?: boolean;
  aiProviderConfigured?: boolean;
  appStoreAccountsReady?: boolean;
  authConfigured?: boolean;
  databaseConfigured?: boolean;
  paymentsEnabled?: boolean;
  privacyLegalApproved?: boolean;
  pushNotificationsConfigured?: boolean;
  storageProviderConfigured?: boolean;
  storageQueue?: LaunchReadinessStorageQueueInput;
  supportRunbookApproved?: boolean;
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

export interface LaunchReadinessPlan {
  status: LaunchReadinessOverallStatus;
  badgeLabel: string;
  storeLaunchReady: boolean;
  summary: string;
  tiles: LaunchReadinessTile[];
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

  if (provider.authConfigured && provider.databaseConfigured) {
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

function storageTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  const totalQueued = queueTotal(provider.storageQueue);
  const uploadReady = queueUploadReady(provider.storageQueue);

  if (provider.storageProviderConfigured) {
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
    value: totalQueued > 0 ? `${plural(totalQueued, "local file")} gated` : "Storage gated",
    detail: storageQueueDetail(provider.storageQueue),
    status: "blocked",
  };
}

function aiTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  return provider.aiProviderConfigured
    ? {
        key: "woofguide-ai",
        label: "WoofGuide",
        value: "AI policy ready",
        detail: "WoofGuide can use provider-backed AI with owner review and veterinary boundary language.",
        status: "ready",
      }
    : {
        key: "woofguide-ai",
        label: "WoofGuide",
        value: "Limited mode",
        detail: "Assistant surfaces stay deterministic/fallback until provider keys, model policy, and disclosures are approved.",
        status: "review",
      };
}

function paymentsTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  return provider.paymentsEnabled
    ? {
        key: "plus-payments",
        label: "WoofWatcher Plus",
        value: "Checkout ready",
        detail: "Subscriptions can run under approved product, refund, support, and app-store terms.",
        status: "ready",
      }
    : {
        key: "plus-payments",
        label: "WoofWatcher Plus",
        value: "Checkout gated",
        detail: "Premium entitlement preview is safe, but paid checkout must stay disabled until launch approvals are complete.",
        status: "blocked",
      };
}

function approvalTile(provider: LaunchReadinessProviderInput): LaunchReadinessTile {
  const ready =
    provider.accountDeletionEnabled &&
    provider.appStoreAccountsReady &&
    provider.privacyLegalApproved &&
    provider.pushNotificationsConfigured &&
    provider.supportRunbookApproved;

  return ready
    ? {
        key: "store-approval",
        label: "Store Gates",
        value: "Approval ready",
        detail: "App-store accounts, privacy/legal, support, deletion, and notification obligations are closed.",
        status: "ready",
      }
    : {
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
  if (!provider.authConfigured) blockers.push("Production auth is not configured.");
  if (!provider.databaseConfigured) blockers.push("Production household database sync is not configured.");
  if (!provider.storageProviderConfigured) blockers.push("Document storage provider and access rules are not approved.");
  if (provider.storageProviderConfigured && queueUploadReady(provider.storageQueue) > 0) {
    blockers.push("Local attachment upload queue needs provider migration verification.");
  }
  if (!provider.aiProviderConfigured) blockers.push("AI provider key, model policy, and disclosure workflow are not configured.");
  if (!provider.paymentsEnabled) blockers.push("Payments remain blocked until subscription, support, refund, and app-store obligations are approved.");
  return blockers;
}

function approvalBlockers(provider: LaunchReadinessProviderInput): string[] {
  const blockers: string[] = [];
  if (!provider.accountDeletionEnabled) blockers.push("Self-serve account deletion is not enabled.");
  if (!provider.pushNotificationsConfigured) blockers.push("Push notifications are not configured.");
  if (!provider.appStoreAccountsReady) blockers.push("Apple and Google store accounts/submission setup are not confirmed.");
  if (!provider.privacyLegalApproved) blockers.push("Privacy/legal approval is still open.");
  if (!provider.supportRunbookApproved) blockers.push("Support and incident-response runbook approval is still open.");
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

  return {
    status,
    badgeLabel: launchReadinessBadgeLabel(status),
    storeLaunchReady,
    summary,
    tiles,
    blockers,
    nextActions,
  };
}
