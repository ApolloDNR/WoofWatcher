import type { LaunchReadinessProviderInput } from "./launchReadiness.ts";
import {
  CARE_ENTRY_PROVIDER_SYNC_PROOF_ITEMS,
  CARE_ENTRY_PROVIDER_SYNC_PROOF_SUMMARY,
} from "./careEntryProviderSyncProof.ts";
import {
  AUTH_PROVIDER_PROOF_ITEMS,
  AUTH_PROVIDER_PROOF_SUMMARY,
} from "./authProviderProof.ts";
import {
  REPORT_BINARY_EXPORT_PROOF_ITEMS,
  REPORT_BINARY_EXPORT_PROOF_SUMMARY,
} from "./reportBinaryExportProof.ts";

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

export interface LaunchProviderProfile {
  authConfigured: boolean;
  databaseConfigured: boolean;
  storageProviderConfigured: boolean;
  aiProviderConfigured: boolean;
  paymentsEnabled: boolean;
  pushNotificationsConfigured: boolean;
  appStoreAccountsReady: boolean;
  accountDeletionEnabled: boolean;
  ownerReviewedAt?: string;
  providerStatus: LaunchProviderSetupStatus;
  notes: string;
}

export type LaunchProviderSetupRowStatus = "ready" | "blocked";

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
}

export interface LaunchProviderSetupPlan {
  title: "Provider Launch Setup";
  status: LaunchProviderSetupStatus;
  statusLabel: string;
  readyCount: number;
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
    | "databaseConfigured"
    | "storageProviderConfigured"
    | "aiProviderConfigured"
    | "paymentsEnabled"
    | "pushNotificationsConfigured"
    | "appStoreAccountsReady"
    | "accountDeletionEnabled"
  >;
}

const DEFAULT_PROFILE: LaunchProviderProfile = {
  authConfigured: false,
  databaseConfigured: false,
  storageProviderConfigured: false,
  aiProviderConfigured: false,
  paymentsEnabled: false,
  pushNotificationsConfigured: false,
  appStoreAccountsReady: false,
  accountDeletionEnabled: false,
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

export function normalizeLaunchProviderProfile(input: LaunchProviderProfileInput): LaunchProviderProfile {
  const source = input ?? {};
  const ownerReviewedAt = cleanString(source.ownerReviewedAt);
  return {
    authConfigured: Boolean(source.authConfigured),
    databaseConfigured: Boolean(source.databaseConfigured),
    storageProviderConfigured: Boolean(source.storageProviderConfigured),
    aiProviderConfigured: Boolean(source.aiProviderConfigured),
    paymentsEnabled: Boolean(source.paymentsEnabled),
    pushNotificationsConfigured: Boolean(source.pushNotificationsConfigured),
    appStoreAccountsReady: Boolean(source.appStoreAccountsReady),
    accountDeletionEnabled: Boolean(source.accountDeletionEnabled),
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
    readyDetail: "WoofGuide can call the approved AI provider with owner review and veterinary boundary copy.",
    blockedDetail: "WoofGuide must stay deterministic/fallback until keys, model policy, disclosures, and review rules are approved.",
    nextAction: "Approve OpenAI key handling, model policy, source/citation behavior, owner-review writes, and vet-boundary language.",
    proofRequired: "AI provider key location, approved model policy, citation/source rules, owner-review write gate, and veterinary-boundary copy review.",
  },
  {
    key: "payments",
    label: "WoofWatcher Plus payments",
    owner: "Apollo / business",
    field: "paymentsEnabled",
    readyDetail: "Subscription checkout is staged under approved product, support, refund, and store obligations.",
    blockedDetail: "Paid checkout must stay disabled until subscription packaging, refund policy, and store rules are approved.",
    nextAction: "Finalize Plus tiers, App Store/Play billing path, refund/support policy, receipts, and entitlement checks.",
    proofRequired: "Plus/Family product ids, sandbox receipt test, refund/support policy, entitlement mapping, and store billing decision record.",
  },
  {
    key: "push",
    label: "Push notifications",
    owner: "Developer",
    field: "pushNotificationsConfigured",
    readyDetail: "Reminder notifications are configured for production QA and store privacy disclosures.",
    blockedDetail: "Reminder Center can run in-app, but production push reminders are not configured.",
    nextAction: "Configure Expo push, Apple APNs, Firebase/FCM, permissions copy, quiet hours, and opt-out behavior.",
    proofRequired: "Expo push project config, APNs/FCM credentials, permission prompt copy, quiet-hours setting, and opt-out QA evidence.",
  },
  {
    key: "storeAccounts",
    label: "Apple and Google store accounts",
    owner: "Apollo",
    field: "appStoreAccountsReady",
    readyDetail: "Apple Developer and Google Play Console access are ready for submission prep.",
    blockedDetail: "Public mobile launch cannot proceed until store accounts, bundle ids, and submission roles are confirmed.",
    nextAction: "Confirm Apple Developer, App Store Connect, Google Play Console, bundle identifiers, screenshots, and review access.",
    proofRequired: "Apple Developer team id, App Store Connect app record, Google Play package record, bundle ids, and reviewer access notes.",
  },
  {
    key: "accountDeletion",
    label: "Self-serve account deletion",
    owner: "Developer / privacy",
    field: "accountDeletionEnabled",
    readyDetail: "Account deletion has a provider-backed destructive path, export warning, and audit receipt.",
    blockedDetail: "Deletion is still manual/non-destructive until provider-backed deletion and audit receipts are approved.",
    nextAction: "Implement and approve account deletion, export-before-delete flow, object deletion, audit receipts, and recovery window.",
    proofRequired: "Self-serve deletion route, export-before-delete warning, data/object deletion receipt, audit trail, and recovery-window policy.",
  },
];

function statusLabel(status: LaunchProviderSetupStatus): string {
  if (status === "provider-approved") return "Provider approved";
  if (status === "owner-reviewed") return "Owner reviewed";
  return "Local draft";
}

export function deriveLaunchProviderSetup(input: LaunchProviderProfileInput): LaunchProviderSetupPlan {
  const profile = normalizeLaunchProviderProfile(input);
  const rows = ROW_DEFINITIONS.map<LaunchProviderSetupRow>((definition) => {
    const ready = Boolean(profile[definition.field]);
    return {
      key: definition.key,
      label: definition.label,
      owner: definition.owner,
      status: ready ? "ready" : "blocked",
      statusLabel: ready ? "Ready" : "Open",
      detail: ready ? definition.readyDetail : definition.blockedDetail,
      nextAction: definition.nextAction,
      proofRequired: definition.proofRequired,
      proofChecklist: [...(definition.proofChecklist ?? [])],
    };
  });

  const readyCount = rows.filter((row) => row.status === "ready").length;
  const totalCount = rows.length;
  const openRows = rows.filter((row) => row.status === "blocked");
  const openCount = openRows.length;
  const percent = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const blockers = openRows.map((row) => `${row.label}: ${row.nextAction}`);
  const nextActions = blockers.slice(0, 4);
  const nextGate = openRows[0] ?? null;
  const allReady = readyCount === totalCount;
  const status =
    allReady && profile.providerStatus === "provider-approved"
      ? "provider-approved"
      : profile.providerStatus === "provider-approved"
        ? "owner-reviewed"
        : profile.providerStatus;

  return {
    title: "Provider Launch Setup",
    status,
    statusLabel: statusLabel(status),
    readyCount,
    totalCount,
    openCount,
    percent,
    headline: `${readyCount}/${totalCount} provider gates ready`,
    summary: allReady
      ? "Production providers are configured for final native QA and owner approval."
      : "Production providers still need setup before WoofWatcher can honestly move from local preview to public launch.",
    notes: profile.notes,
    rows,
    nextGate,
    blockers,
    nextActions,
    providerInput: {
      authConfigured: profile.authConfigured,
      databaseConfigured: profile.databaseConfigured,
      storageProviderConfigured: profile.storageProviderConfigured,
      aiProviderConfigured: profile.aiProviderConfigured,
      paymentsEnabled: profile.paymentsEnabled,
      pushNotificationsConfigured: profile.pushNotificationsConfigured,
      appStoreAccountsReady: profile.appStoreAccountsReady,
      accountDeletionEnabled: profile.accountDeletionEnabled,
    },
  };
}

function formatRows(rows: readonly LaunchProviderSetupRow[]): string[] {
  return rows.map((row) => `- ${row.label}: ${row.statusLabel}. ${row.nextAction}`);
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
  const openRows = plan.rows.filter((row) => row.status === "blocked");
  const nextGateLines = plan.nextGate
    ? [
        `- ${plan.nextGate.label}`,
        `  Owner: ${plan.nextGate.owner}`,
        `  Action: ${plan.nextGate.nextAction}`,
        `  Proof: ${plan.nextGate.proofRequired}`,
      ]
    : ["- All provider gates are ready for final owner review."];

  return [
    "WoofWatcher Provider Launch Setup",
    `Generated: ${generatedAtIso}`,
    `Status: ${plan.statusLabel}`,
    `Progress: ${plan.readyCount}/${plan.totalCount} ready (${plan.percent}%)`,
    "",
    plan.summary,
    plan.notes ? `Notes: ${plan.notes}` : "",
    "",
    "Ready",
    ...(readyRows.length ? formatRows(readyRows) : ["- Nothing is fully ready yet."]),
    "",
    "Open",
    ...(openRows.length ? formatRows(openRows) : ["- No provider gates are open."]),
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
