import type { LaunchReadinessProviderInput } from "./launchReadiness.ts";
import {
  CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS,
  CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY,
  type CareEntryProviderSyncProofEvidence,
} from "./careEntryProviderSyncProof.ts";
import {
  AUTH_PROVIDER_PROOF_ITEMS,
  AUTH_PROVIDER_PROOF_SUMMARY,
  type AuthSetupProofManifestInput,
} from "./authProviderProof.ts";
import {
  AI_PROVIDER_PROOF_ITEMS,
  AI_PROVIDER_PROOF_SUMMARY,
  type AiProviderProofEvidence,
} from "./aiProviderProof.ts";
import {
  ACCOUNT_DELETION_PROOF_ITEMS,
  ACCOUNT_DELETION_PROOF_SUMMARY,
  type AccountDeletionProofEvidence,
} from "./accountDeletionProof.ts";
import {
  STORE_ACCOUNTS_PROOF_ITEMS,
  STORE_ACCOUNTS_PROOF_SUMMARY,
  type StoreAccountsProofEvidence,
} from "./storeAccountsProof.ts";
import {
  REPORT_BINARY_EXPORT_PROOF_ITEMS,
  REPORT_BINARY_EXPORT_PROOF_SUMMARY,
  type ReportBinaryExportProofEvidence,
} from "./reportBinaryExportProof.ts";
import type { RecordsLocalFileHandoffProofEvidence } from "./reportArtifactExportFile.ts";
import {
  PAYMENTS_PROVIDER_PROOF_ITEMS,
  PAYMENTS_PROVIDER_PROOF_SUMMARY,
  type PaymentsProviderProofManifestInput,
} from "./paymentsProviderProof.ts";
import {
  PUSH_NOTIFICATIONS_PROOF_ITEMS,
  PUSH_NOTIFICATIONS_PROOF_SUMMARY,
  type PushNotificationsProofEvidence,
} from "./pushNotificationsProof.ts";

export type LaunchProviderSetupStatus = "local-draft" | "owner-reviewed" | "provider-approved";

export type LaunchProviderSetupKey =
  | "auth"
  | "database"
  | "storage"
  | "ai"
  | "payments"
  | "push"
  | "storeAccounts"
  | "accountDeletion";

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
  authSetupProofEvidence?: AuthSetupProofManifestInput | null;
  databaseConfigured: boolean;
  databaseProviderProofReady: boolean;
  careEntryProviderSyncEvidence?: CareEntryProviderSyncProofEvidence | null;
  storageProviderConfigured: boolean;
  storageProviderProofReady: boolean;
  storageProviderEvidence?: LaunchStorageProviderEvidence | null;
  recordsLocalFileHandoffEvidence?: RecordsLocalFileHandoffProofEvidence | null;
  reportBinaryExportProofEvidence?: ReportBinaryExportProofEvidence | null;
  aiProviderConfigured: boolean;
  aiProviderProofReady: boolean;
  aiProviderEvidence?: AiProviderProofEvidence | null;
  paymentsEnabled: boolean;
  paymentsProviderProofReady: boolean;
  paymentsProviderEvidence?: PaymentsProviderProofManifestInput | null;
  pushNotificationsConfigured: boolean;
  pushNotificationsProofReady: boolean;
  pushNotificationsProofEvidence?: PushNotificationsProofEvidence | null;
  appStoreAccountsReady: boolean;
  storeAccountsProofReady: boolean;
  storeAccountsProofEvidence?: StoreAccountsProofEvidence | null;
  accountDeletionEnabled: boolean;
  accountDeletionProofReady: boolean;
  accountDeletionEvidence?: AccountDeletionProofEvidence | null;
  ownerReviewedAt?: string;
  providerStatus: LaunchProviderSetupStatus;
  notes: string;
}

export type LaunchProviderSetupRowStatus = "ready" | "staged" | "blocked";

export interface LaunchProviderSetupRow {
  key: LaunchProviderSetupKey;
  label: string;
  owner: string;
  status: LaunchProviderSetupRowStatus;
  statusLabel: string;
  detail: string;
  nextAction: string;
  proofRequired: string;
  proofChecklist: string[];
  providerConfigured: boolean;
  proofReady: boolean;
}

export interface LaunchProviderSetupPlan {
  title: "Provider Launch Setup";
  status: LaunchProviderSetupStatus;
  statusLabel: string;
  readyCount: number;
  stagedCount: number;
  totalCount: number;
  openCount: number;
  percent: number;
  headline: string;
  summary: string;
  notes: string;
  rows: LaunchProviderSetupRow[];
  nextGate: LaunchProviderSetupRow | null;
  blockers: string[];
  nextActions: string[];
  providerInput: Pick<
    LaunchReadinessProviderInput,
    | "authConfigured"
    | "authProviderProofReady"
    | "databaseConfigured"
    | "databaseProviderProofReady"
    | "storageProviderConfigured"
    | "storageProviderProofReady"
    | "storageProviderEvidence"
    | "aiProviderConfigured"
    | "aiProviderProofReady"
    | "paymentsEnabled"
    | "paymentsProviderProofReady"
    | "pushNotificationsConfigured"
    | "pushNotificationsProofReady"
    | "appStoreAccountsReady"
    | "storeAccountsProofReady"
    | "accountDeletionEnabled"
    | "accountDeletionProofReady"
  >;
}

const DEFAULT_PROFILE: LaunchProviderProfile = {
  authConfigured: false,
  authProviderProofReady: false,
  authSetupProofEvidence: null,
  databaseConfigured: false,
  databaseProviderProofReady: false,
  careEntryProviderSyncEvidence: null,
  storageProviderConfigured: false,
  storageProviderProofReady: false,
  storageProviderEvidence: null,
  recordsLocalFileHandoffEvidence: null,
  reportBinaryExportProofEvidence: null,
  aiProviderConfigured: false,
  aiProviderProofReady: false,
  aiProviderEvidence: null,
  paymentsEnabled: false,
  paymentsProviderProofReady: false,
  paymentsProviderEvidence: null,
  pushNotificationsConfigured: false,
  pushNotificationsProofReady: false,
  pushNotificationsProofEvidence: null,
  appStoreAccountsReady: false,
  storeAccountsProofReady: false,
  storeAccountsProofEvidence: null,
  accountDeletionEnabled: false,
  accountDeletionProofReady: false,
  accountDeletionEvidence: null,
  providerStatus: "local-draft",
  notes: "",
};

type LaunchProviderProfileInput = Partial<LaunchProviderProfile> | null | undefined;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStatus(value: unknown): LaunchProviderSetupStatus {
  return value === "owner-reviewed" || value === "provider-approved" ? value : "local-draft";
}

function normalizeStorageProviderEvidence(
  value: LaunchStorageProviderEvidence | null | undefined,
): LaunchStorageProviderEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeRecordsLocalFileHandoffEvidence(
  value: RecordsLocalFileHandoffProofEvidence | null | undefined,
): RecordsLocalFileHandoffProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeReportBinaryExportProofEvidence(
  value: ReportBinaryExportProofEvidence | null | undefined,
): ReportBinaryExportProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeAuthSetupProofEvidence(
  value: AuthSetupProofManifestInput | null | undefined,
): AuthSetupProofManifestInput | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeCareEntryProviderSyncEvidence(
  value: CareEntryProviderSyncProofEvidence | null | undefined,
): CareEntryProviderSyncProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeAiProviderEvidence(
  value: AiProviderProofEvidence | null | undefined,
): AiProviderProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizePaymentsProviderEvidence(
  value: PaymentsProviderProofManifestInput | null | undefined,
): PaymentsProviderProofManifestInput | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeAccountDeletionEvidence(
  value: AccountDeletionProofEvidence | null | undefined,
): AccountDeletionProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizePushNotificationsProofEvidence(
  value: PushNotificationsProofEvidence | null | undefined,
): PushNotificationsProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeStoreAccountsProofEvidence(
  value: StoreAccountsProofEvidence | null | undefined,
): StoreAccountsProofEvidence | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function normalizeLaunchProviderProfile(input: LaunchProviderProfileInput): LaunchProviderProfile {
  const source = input ?? {};
  const ownerReviewedAt = cleanString(source.ownerReviewedAt);
  return {
    authConfigured: Boolean(source.authConfigured),
    authProviderProofReady: Boolean(source.authProviderProofReady),
    authSetupProofEvidence: normalizeAuthSetupProofEvidence(source.authSetupProofEvidence),
    databaseConfigured: Boolean(source.databaseConfigured),
    databaseProviderProofReady: Boolean(source.databaseProviderProofReady),
    careEntryProviderSyncEvidence: normalizeCareEntryProviderSyncEvidence(source.careEntryProviderSyncEvidence),
    storageProviderConfigured: Boolean(source.storageProviderConfigured),
    storageProviderProofReady: Boolean(source.storageProviderProofReady),
    storageProviderEvidence: normalizeStorageProviderEvidence(source.storageProviderEvidence),
    recordsLocalFileHandoffEvidence: normalizeRecordsLocalFileHandoffEvidence(
      source.recordsLocalFileHandoffEvidence,
    ),
    reportBinaryExportProofEvidence: normalizeReportBinaryExportProofEvidence(
      source.reportBinaryExportProofEvidence,
    ),
    aiProviderConfigured: Boolean(source.aiProviderConfigured),
    aiProviderProofReady: Boolean(source.aiProviderProofReady),
    aiProviderEvidence: normalizeAiProviderEvidence(source.aiProviderEvidence),
    paymentsEnabled: Boolean(source.paymentsEnabled),
    paymentsProviderProofReady: Boolean(source.paymentsProviderProofReady),
    paymentsProviderEvidence: normalizePaymentsProviderEvidence(source.paymentsProviderEvidence),
    pushNotificationsConfigured: Boolean(source.pushNotificationsConfigured),
    pushNotificationsProofReady: Boolean(source.pushNotificationsProofReady),
    pushNotificationsProofEvidence: normalizePushNotificationsProofEvidence(source.pushNotificationsProofEvidence),
    appStoreAccountsReady: Boolean(source.appStoreAccountsReady),
    storeAccountsProofReady: Boolean(source.storeAccountsProofReady),
    storeAccountsProofEvidence: normalizeStoreAccountsProofEvidence(source.storeAccountsProofEvidence),
    accountDeletionEnabled: Boolean(source.accountDeletionEnabled),
    accountDeletionProofReady: Boolean(source.accountDeletionProofReady),
    accountDeletionEvidence: normalizeAccountDeletionEvidence(source.accountDeletionEvidence),
    ownerReviewedAt: ownerReviewedAt || undefined,
    providerStatus: cleanStatus(source.providerStatus),
    notes: cleanString(source.notes),
  };
}

const ROW_DEFINITIONS: Array<{
  key: LaunchProviderSetupKey;
  label: string;
  owner: string;
  field: keyof Pick<
    LaunchProviderProfile,
    | "authConfigured"
    | "databaseConfigured"
    | "storageProviderConfigured"
    | "aiProviderConfigured"
    | "paymentsEnabled"
    | "pushNotificationsConfigured"
    | "appStoreAccountsReady"
    | "accountDeletionEnabled"
  >;
  proofField: keyof Pick<
    LaunchProviderProfile,
    | "authProviderProofReady"
    | "databaseProviderProofReady"
    | "storageProviderProofReady"
    | "aiProviderProofReady"
    | "paymentsProviderProofReady"
    | "pushNotificationsProofReady"
    | "storeAccountsProofReady"
    | "accountDeletionProofReady"
  >;
  readyDetail: string;
  blockedDetail: string;
  nextAction: string;
  proofRequired: string;
  proofChecklist?: readonly string[];
}> = [
  {
    key: "auth",
    label: "Production auth",
    owner: "Apollo / developer",
    field: "authConfigured",
    proofField: "authProviderProofReady",
    readyDetail: "Production sign-in, household membership, and deep-link sign-in are configured for review.",
    blockedDetail: "Launch still needs production auth, sign-in URLs, household membership rules, and account session policy.",
    nextAction: "Configure Clerk production keys, redirect URLs, OAuth/deep links, and household membership policy.",
    proofRequired: AUTH_PROVIDER_PROOF_SUMMARY,
    proofChecklist: AUTH_PROVIDER_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "database",
    label: "Household database sync",
    owner: "Developer",
    field: "databaseConfigured",
    proofField: "databaseProviderProofReady",
    readyDetail: "Production household care documents, logs, update cursors, delete tombstones, and sync rules are configured for review.",
    blockedDetail:
      "Household logs remain local/full-refresh or preview-only until production database sync, cursor/tombstone RLS, retention, and permissions are approved.",
    nextAction:
      "Approve Supabase/Postgres schema, migration/backfill for care_entries.updated_at and care_entry_tombstones, RLS scoping, backups, retention/export/deletion, and per-household sync proof.",
    proofRequired: CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY,
    proofChecklist: CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "storage",
    label: "Records and media storage",
    owner: "Developer / privacy",
    field: "storageProviderConfigured",
    proofField: "storageProviderProofReady",
    readyDetail: "Document, proof-photo, report, and QA evidence storage rules are ready for migration testing.",
    blockedDetail: "Receipts, proof photos, reports, and QA screenshots stay local until signed storage rules exist.",
    nextAction: "Create storage buckets, signed upload/download rules, retention, export, deletion, and household scope policy.",
    proofRequired:
      `Storage bucket names, signed upload/download policy, retention/export/deletion rules, household access test evidence, and ${REPORT_BINARY_EXPORT_PROOF_SUMMARY}`,
    proofChecklist: REPORT_BINARY_EXPORT_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "ai",
    label: "WoofGuide AI",
    owner: "Apollo / safety",
    field: "aiProviderConfigured",
    proofField: "aiProviderProofReady",
    readyDetail: "WoofGuide can call the approved AI provider with owner review and veterinary boundary copy.",
    blockedDetail: "WoofGuide must stay deterministic/fallback until keys, model policy, disclosures, and review rules are approved.",
    nextAction: "Approve OpenAI key handling, model policy, source/citation behavior, owner-review writes, and vet-boundary language.",
    proofRequired: AI_PROVIDER_PROOF_SUMMARY,
    proofChecklist: AI_PROVIDER_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "payments",
    label: "WoofWatcher Plus payments",
    owner: "Apollo / business",
    field: "paymentsEnabled",
    proofField: "paymentsProviderProofReady",
    readyDetail: "Subscription checkout is staged under approved product, support, refund, and store obligations.",
    blockedDetail: "Paid checkout must stay disabled until subscription packaging, refund policy, and store rules are approved.",
    nextAction: "Finalize Plus tiers, App Store/Play billing path, refund/support policy, receipts, and entitlement checks.",
    proofRequired: PAYMENTS_PROVIDER_PROOF_SUMMARY,
    proofChecklist: PAYMENTS_PROVIDER_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "push",
    label: "Push notifications",
    owner: "Developer",
    field: "pushNotificationsConfigured",
    proofField: "pushNotificationsProofReady",
    readyDetail: "Reminder notifications are configured for production QA and store privacy disclosures.",
    blockedDetail: "Reminder Center can run in-app, but production push reminders are not configured.",
    nextAction: "Configure Expo push, Apple APNs, Firebase/FCM, permissions copy, quiet hours, and opt-out behavior.",
    proofRequired: PUSH_NOTIFICATIONS_PROOF_SUMMARY,
    proofChecklist: PUSH_NOTIFICATIONS_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "storeAccounts",
    label: "Apple and Google store accounts",
    owner: "Apollo",
    field: "appStoreAccountsReady",
    proofField: "storeAccountsProofReady",
    readyDetail: "Apple Developer and Google Play Console access are ready for submission prep.",
    blockedDetail: "Public mobile launch cannot proceed until store accounts, bundle ids, and submission roles are confirmed.",
    nextAction: "Confirm Apple Developer, App Store Connect, Google Play Console, bundle identifiers, screenshots, and review access.",
    proofRequired: STORE_ACCOUNTS_PROOF_SUMMARY,
    proofChecklist: STORE_ACCOUNTS_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
  {
    key: "accountDeletion",
    label: "Self-serve account deletion",
    owner: "Developer / privacy",
    field: "accountDeletionEnabled",
    proofField: "accountDeletionProofReady",
    readyDetail: "Account deletion has a provider-backed destructive path, export warning, and audit receipt.",
    blockedDetail: "Deletion is still manual/non-destructive until provider-backed deletion and audit receipts are approved.",
    nextAction: "Implement and approve account deletion, export-before-delete flow, object deletion, audit receipts, and recovery window.",
    proofRequired: ACCOUNT_DELETION_PROOF_SUMMARY,
    proofChecklist: ACCOUNT_DELETION_PROOF_ITEMS.map((item) => `${item.label}: ${item.requiredEvidence}`),
  },
];

function statusLabel(status: LaunchProviderSetupStatus): string {
  if (status === "provider-approved") return "Provider approved";
  if (status === "owner-reviewed") return "Owner reviewed";
  return "Local draft";
}

export function deriveLaunchProviderSetup(input: LaunchProviderProfileInput): LaunchProviderSetupPlan {
  const profile = normalizeLaunchProviderProfile(input);
  const providerApproved = profile.providerStatus === "provider-approved";
  const stagedStatusLabel =
    profile.providerStatus === "provider-approved"
      ? "Proof pending"
      : profile.providerStatus === "owner-reviewed"
        ? "Owner staged"
        : "Local staged";
  const rows = ROW_DEFINITIONS.map<LaunchProviderSetupRow>((definition) => {
    const configured = Boolean(profile[definition.field]);
    const proofReady = Boolean(profile[definition.proofField]);
    const rowReady = configured && providerApproved && proofReady;
    const status: LaunchProviderSetupRowStatus = rowReady ? "ready" : configured ? "staged" : "blocked";
    const detail =
      status === "ready"
        ? definition.readyDetail
        : status === "staged"
          ? providerApproved
            ? `Provider setup is staged, but structured proof evidence is still required before this gate counts as production-ready. ${definition.readyDetail}`
            : `Proof is staged locally; provider approval and structured proof evidence are still required before this gate counts as production-ready. ${definition.readyDetail}`
          : definition.blockedDetail;
    return {
      key: definition.key,
      label: definition.label,
      owner: definition.owner,
      status,
      statusLabel: status === "ready" ? "Ready" : status === "staged" ? stagedStatusLabel : "Open",
      detail,
      nextAction: definition.nextAction,
      proofRequired: definition.proofRequired,
      proofChecklist: [...(definition.proofChecklist ?? [])],
      providerConfigured: configured,
      proofReady,
    };
  });

  const readyCount = rows.filter((row) => row.status === "ready").length;
  const stagedCount = rows.filter((row) => row.status === "staged").length;
  const totalCount = rows.length;
  const openRows = rows.filter((row) => row.status !== "ready");
  const openCount = openRows.length;
  const percent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const blockers = openRows.map((row) => `${row.label}: ${row.nextAction}`);
  const nextActions = blockers.slice(0, 4);
  const nextGate = openRows[0] ?? null;
  const allReady = readyCount === totalCount;
  const status =
    allReady && providerApproved
      ? "provider-approved"
      : providerApproved
        ? "owner-reviewed"
        : profile.providerStatus;
  const headline =
    stagedCount > 0 && readyCount > 0
      ? `${readyCount}/${totalCount} provider gates approved, ${stagedCount} staged`
      : stagedCount > 0
        ? `${stagedCount}/${totalCount} provider gates staged`
        : `${readyCount}/${totalCount} provider gates approved`;

  return {
    title: "Provider Launch Setup",
    status,
    statusLabel: statusLabel(status),
    readyCount,
    stagedCount,
    totalCount,
    openCount,
    percent,
    headline,
    summary: allReady
      ? "Production providers are configured for final native QA and owner approval."
      : stagedCount > 0
        ? "Provider proof is staged locally, but provider-approved evidence is still required before WoofWatcher can honestly move from local preview to public launch."
        : "Production providers still need setup before WoofWatcher can honestly move from local preview to public launch.",
    notes: profile.notes,
    rows,
    nextGate,
    blockers,
    nextActions,
    providerInput: {
      authConfigured: rows.some((row) => row.key === "auth" && row.status === "ready"),
      authProviderProofReady: rows.some((row) => row.key === "auth" && row.status === "ready"),
      databaseConfigured: rows.some((row) => row.key === "database" && row.status === "ready"),
      databaseProviderProofReady: rows.some((row) => row.key === "database" && row.status === "ready"),
      storageProviderConfigured: rows.some((row) => row.key === "storage" && row.status === "ready"),
      storageProviderProofReady: rows.some((row) => row.key === "storage" && row.status === "ready"),
      storageProviderEvidence: profile.storageProviderEvidence,
      aiProviderConfigured: rows.some((row) => row.key === "ai" && row.status === "ready"),
      aiProviderProofReady: rows.some((row) => row.key === "ai" && row.status === "ready"),
      paymentsEnabled: rows.some((row) => row.key === "payments" && row.status === "ready"),
      paymentsProviderProofReady: rows.some((row) => row.key === "payments" && row.status === "ready"),
      pushNotificationsConfigured: rows.some((row) => row.key === "push" && row.status === "ready"),
      pushNotificationsProofReady: rows.some((row) => row.key === "push" && row.status === "ready"),
      appStoreAccountsReady: rows.some((row) => row.key === "storeAccounts" && row.status === "ready"),
      storeAccountsProofReady: rows.some((row) => row.key === "storeAccounts" && row.status === "ready"),
      accountDeletionEnabled: rows.some((row) => row.key === "accountDeletion" && row.status === "ready"),
      accountDeletionProofReady: rows.some((row) => row.key === "accountDeletion" && row.status === "ready"),
    },
  };
}

function formatRows(rows: readonly LaunchProviderSetupRow[]): string[] {
  return rows.map((row) => `- ${row.label}: ${row.statusLabel}. ${row.status === "blocked" ? row.nextAction : row.detail}`);
}

function formatProofRows(rows: readonly LaunchProviderSetupRow[]): string[] {
  return rows.flatMap((row) => [
    `- ${row.label}: ${row.proofRequired}`,
    ...row.proofChecklist.map((item) => `  - ${item}`),
  ]);
}

export function buildLaunchProviderSetupShareText(
  plan: LaunchProviderSetupPlan,
  generatedAtIso = new Date().toISOString(),
): string {
  const readyRows = plan.rows.filter((row) => row.status === "ready");
  const openRows = plan.rows.filter((row) => row.status !== "ready");
  const nextGateLines = plan.nextGate
    ? [
        `- ${plan.nextGate.label}`,
        `  Owner: ${plan.nextGate.owner}`,
        `  Action: ${plan.nextGate.nextAction}`,
        `  Proof: ${plan.nextGate.proofRequired}`,
      ]
    : ["- All provider gates are provider-approved for final owner review."];

  return [
    "WoofWatcher Provider Launch Setup",
    `Generated: ${generatedAtIso}`,
    `Status: ${plan.statusLabel}`,
    `Progress: ${plan.readyCount}/${plan.totalCount} provider approved (${plan.percent}%)`,
    "",
    plan.summary,
    plan.notes ? `Notes: ${plan.notes}` : "",
    "",
    "Ready",
    ...(readyRows.length ? formatRows(readyRows) : ["- Nothing is provider-approved yet."]),
    "",
    "Open or Staged",
    ...(openRows.length ? formatRows(openRows) : ["- No provider gates are open or staged."]),
    "",
    "Next Provider Gate",
    ...nextGateLines,
    "",
    "Proof Needed",
    ...formatProofRows(plan.rows),
    "",
    "Done condition: provider setup is not launch approval. Run native QA, confirm legal/support/store approvals, then submit through Apple App Store Connect and Google Play Console.",
    "No App Store or Play Store submission is approved by this checklist.",
  ]
    .filter(Boolean)
    .join("\n");
}
