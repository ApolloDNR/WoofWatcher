export type LaunchProviderSetupStatus =
  | "local-draft"
  | "owner-reviewed"
  | "provider-approved";

export interface LaunchStorageProviderEvidence {
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

export interface LaunchProviderProfile {
  authConfigured: boolean;
  authProviderProofReady: boolean;
  databaseConfigured: boolean;
  databaseProviderProofReady: boolean;
  storageProviderConfigured: boolean;
  storageProviderProofReady: boolean;
  storageProviderEvidence?: LaunchStorageProviderEvidence | null;
  aiProviderConfigured: boolean;
  aiProviderProofReady: boolean;
  paymentsEnabled: boolean;
  paymentsProviderProofReady: boolean;
  pushNotificationsConfigured: boolean;
  pushNotificationsProofReady: boolean;
  appStoreAccountsReady: boolean;
  storeAccountsProofReady: boolean;
  accountDeletionEnabled: boolean;
  accountDeletionProofReady: boolean;
  ownerReviewedAt?: string;
  providerStatus: LaunchProviderSetupStatus;
  notes: string;
}

export type LaunchProviderProfileInput =
  | Partial<LaunchProviderProfile>
  | null
  | undefined;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStatus(value: unknown): LaunchProviderSetupStatus {
  return value === "owner-reviewed" || value === "provider-approved"
    ? value
    : "local-draft";
}

function normalizeStorageProviderEvidence(
  value: LaunchStorageProviderEvidence | null | undefined,
): LaunchStorageProviderEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

export function normalizeLaunchProviderProfile(
  input: LaunchProviderProfileInput,
): LaunchProviderProfile {
  const source = input ?? {};
  const ownerReviewedAt = cleanString(source.ownerReviewedAt);
  return {
    authConfigured: Boolean(source.authConfigured),
    authProviderProofReady: Boolean(source.authProviderProofReady),
    databaseConfigured: Boolean(source.databaseConfigured),
    databaseProviderProofReady: Boolean(source.databaseProviderProofReady),
    storageProviderConfigured: Boolean(source.storageProviderConfigured),
    storageProviderProofReady: Boolean(source.storageProviderProofReady),
    storageProviderEvidence: normalizeStorageProviderEvidence(
      source.storageProviderEvidence,
    ),
    aiProviderConfigured: Boolean(source.aiProviderConfigured),
    aiProviderProofReady: Boolean(source.aiProviderProofReady),
    paymentsEnabled: Boolean(source.paymentsEnabled),
    paymentsProviderProofReady: Boolean(source.paymentsProviderProofReady),
    pushNotificationsConfigured: Boolean(
      source.pushNotificationsConfigured,
    ),
    pushNotificationsProofReady: Boolean(
      source.pushNotificationsProofReady,
    ),
    appStoreAccountsReady: Boolean(source.appStoreAccountsReady),
    storeAccountsProofReady: Boolean(source.storeAccountsProofReady),
    accountDeletionEnabled: Boolean(source.accountDeletionEnabled),
    accountDeletionProofReady: Boolean(source.accountDeletionProofReady),
    ownerReviewedAt: ownerReviewedAt || undefined,
    providerStatus: cleanStatus(source.providerStatus),
    notes: cleanString(source.notes),
  };
}
