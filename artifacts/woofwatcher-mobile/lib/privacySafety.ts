import {
  buildAttachmentReviewRows,
  deriveAttachmentManifest,
  formatAttachmentManifestSummary,
  isAttachmentStorageProviderProofReady,
  type AttachmentReviewRow,
  type AttachmentManifestOptions,
  type AttachmentLaunchQueue,
  type AttachmentStorageProviderEvidence,
} from "./attachmentManifest.ts";
import { buildAiProviderProofManifest, type AiProviderProofEvidence } from "./aiProviderProof.ts";
import { buildAccountDeletionProofManifest, type AccountDeletionProofEvidence } from "./accountDeletionProof.ts";
import { buildPaymentsProviderProofManifest, type PaymentsProviderProofManifestInput } from "./paymentsProviderProof.ts";
import {
  deriveLaunchProviderSetup,
  normalizeLaunchProviderProfile,
  type LaunchProviderProfile,
} from "./launchProviderSetup.ts";
import {
  deriveSupportRunbookPlan,
  type SupportRunbookInput,
} from "./supportRunbook.ts";

export interface PrivacyExportProfile {
  name?: string;
  breed?: string;
  vetBoundary?: string;
}

export interface PrivacyExportPet {
  id?: string;
  name?: string;
  breed?: string;
  status?: string;
  createdAt?: string;
}

export interface PrivacyExportRecord {
  id?: string;
  type?: string;
  title?: string;
  due?: string;
  note?: string;
  attachmentName?: string;
  attachmentUri?: string;
}

export interface PrivacyExportEntry {
  id?: string;
  type?: string;
  title?: string;
  caregiver?: string;
  occurredAt?: string;
  note?: string;
  details?: JsonRecord | null;
}

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface PrivacyExportState {
  activePetId?: string;
  profile?: PrivacyExportProfile;
  pets?: readonly PrivacyExportPet[];
  householdSetup?: unknown;
  launchSupportProfile?: unknown;
  launchProviderProfile?: unknown;
  reminderNotificationPreferences?: unknown;
  accessPasses?: readonly unknown[];
  adventureMemories?: readonly unknown[];
  caregivers?: readonly unknown[];
  dietProfile?: unknown;
  routines?: readonly unknown[];
  goals?: readonly unknown[];
  records?: readonly PrivacyExportRecord[];
  calendarEvents?: readonly unknown[];
  reportArtifacts?: readonly unknown[];
  entries?: readonly PrivacyExportEntry[];
}

export interface PrivacyExportContext {
  userId?: string | null;
  householdId?: string | null;
  householdName?: string | null;
}

export interface PrivacyExportBundle {
  app: "WoofWatcher";
  formatVersion: 1;
  generatedAt: string;
  scope: "owner_care_export";
  dogName: string;
  owner: {
    userId: string | null;
  };
  household: {
    id: string | null;
    name: string | null;
  };
  counts: {
    caregivers: number;
    pets: number;
    accessPasses: number;
    adventureMemories: number;
    routines: number;
    entries: number;
    records: number;
    reportArtifacts: number;
    calendarEvents: number;
    attachedDocuments: number;
    localAttachments: number;
  };
  storage: {
    attachmentQueue: AttachmentLaunchQueue;
    attachmentReviewRows: AttachmentReviewRow[];
    attachmentSummary: string;
  };
  care: {
    profile: PrivacyExportProfile | null;
    activePetId: string | null;
    pets: readonly PrivacyExportPet[];
    householdSetup: unknown | null;
    launchSupportProfile: unknown | null;
    launchProviderProfile: unknown | null;
    reminderNotificationPreferences: unknown | null;
    accessPasses: readonly unknown[];
    adventureMemories: readonly unknown[];
    caregivers: readonly unknown[];
    dietProfile: unknown | null;
    routines: readonly unknown[];
    goals: readonly unknown[];
    records: readonly PrivacyExportRecord[];
    calendarEvents: readonly unknown[];
    reportArtifacts: readonly unknown[];
    entries: readonly PrivacyExportEntry[];
  };
  disclosures: {
    ai: string;
    documents: string;
    deletion: string;
  };
}

export type AccountSafetyStatus = "ready" | "limited" | "blocked" | "manual_required";

export interface AccountSafetySection {
  status: AccountSafetyStatus;
  title: string;
  detail: string;
  action: string;
}

export interface AccountSafetyPlanInput {
  state: PrivacyExportState;
  aiProviderConfigured?: boolean;
  aiProviderEvidence?: AiProviderProofEvidence | null;
  storageProviderConfigured?: boolean;
  storageProviderEvidence?: AttachmentStorageProviderEvidence | null;
  accountDeletionEnabled?: boolean;
  accountDeletionEvidence?: AccountDeletionProofEvidence | null;
  paymentsEnabled?: boolean;
  paymentsProviderEvidence?: PaymentsProviderProofManifestInput | null;
}

export interface AccountSafetyPlan {
  export: AccountSafetySection;
  accountDeletion: AccountSafetySection;
  aiDisclosure: AccountSafetySection;
  documentStorage: AccountSafetySection;
  payments: AccountSafetySection;
  launchBlockers: string[];
}

export interface AccountDeletionRequest {
  subject: string;
  body: string;
}

function safeArray<T>(value: readonly T[] | undefined): readonly T[] {
  return Array.isArray(value) ? value : [];
}

function dogName(state: PrivacyExportState): string {
  return state.profile?.name?.trim() || "your dog";
}

function generatedAt(now: number): string {
  return new Date(now).toISOString();
}

function attachedDocumentCount(records: readonly PrivacyExportRecord[]): number {
  return records.filter((record) => Boolean(record.attachmentName || record.attachmentUri)).length;
}

function clampLaunchSupportProfileForExport(value: unknown): unknown | null {
  if (!isJsonRecord(value)) return value ?? null;
  const plan = deriveSupportRunbookPlan(value as SupportRunbookInput);
  if (value.providerStatus === "provider-approved" && !plan.launchReady) {
    return { ...value, providerStatus: "owner-reviewed" };
  }
  return value;
}

function clampLaunchProviderProfileForExport(value: unknown): unknown | null {
  if (!isJsonRecord(value)) return value ?? null;
  if (value.providerStatus !== "provider-approved") return value;

  const plan = deriveLaunchProviderSetup(value as Partial<LaunchProviderProfile>);
  return plan.status === "provider-approved" ? value : { ...value, providerStatus: plan.status };
}

function attachmentStorageOptionsForState(state: PrivacyExportState): AttachmentManifestOptions {
  const profile = normalizeLaunchProviderProfile(
    isJsonRecord(state.launchProviderProfile) ? (state.launchProviderProfile as Partial<LaunchProviderProfile>) : null,
  );

  return {
    storageProviderConfigured: profile.storageProviderConfigured,
    storageProviderEvidence: profile.storageProviderEvidence as AttachmentStorageProviderEvidence | null,
  };
}

export function buildPrivacyExportBundle(
  state: PrivacyExportState,
  context: PrivacyExportContext = {},
  now: number = Date.now(),
): PrivacyExportBundle {
  const caregivers = safeArray(state.caregivers);
  const pets = safeArray(state.pets);
  const accessPasses = safeArray(state.accessPasses);
  const adventureMemories = safeArray(state.adventureMemories);
  const routines = safeArray(state.routines);
  const goals = safeArray(state.goals);
  const records = safeArray(state.records);
  const calendarEvents = safeArray(state.calendarEvents);
  const reportArtifacts = safeArray(state.reportArtifacts);
  const entries = safeArray(state.entries);
  const attachmentStorageOptions = attachmentStorageOptionsForState(state);
  const attachmentManifest = deriveAttachmentManifest(
    {
      entries,
      records,
      adventureMemories,
      reportArtifacts,
    },
    attachmentStorageOptions,
  );
  const attachmentSummary = formatAttachmentManifestSummary(attachmentManifest);

  return {
    app: "WoofWatcher",
    formatVersion: 1,
    generatedAt: generatedAt(now),
    scope: "owner_care_export",
    dogName: dogName(state),
    owner: {
      userId: context.userId ?? null,
    },
    household: {
      id: context.householdId ?? null,
      name: context.householdName ?? null,
    },
    counts: {
      caregivers: caregivers.length,
      pets: pets.length,
      accessPasses: accessPasses.length,
      adventureMemories: adventureMemories.length,
      routines: routines.length,
      entries: entries.length,
      records: records.length,
      reportArtifacts: reportArtifacts.length,
      calendarEvents: calendarEvents.length,
      attachedDocuments: attachedDocumentCount(records),
      localAttachments: attachmentManifest.total,
    },
    storage: {
      attachmentQueue: attachmentManifest.launchQueue,
      attachmentReviewRows: buildAttachmentReviewRows(attachmentManifest),
      attachmentSummary,
    },
    care: {
      profile: state.profile ?? null,
      activePetId: state.activePetId ?? null,
      pets,
      householdSetup: state.householdSetup ?? null,
      launchSupportProfile: clampLaunchSupportProfileForExport(state.launchSupportProfile),
      launchProviderProfile: clampLaunchProviderProfileForExport(state.launchProviderProfile),
      reminderNotificationPreferences: state.reminderNotificationPreferences ?? null,
      accessPasses,
      adventureMemories,
      caregivers,
      dietProfile: state.dietProfile ?? null,
      routines,
      goals,
      records,
      calendarEvents,
      reportArtifacts,
      entries,
    },
    disclosures: {
      ai: "WoofGuide may summarize owner-entered care context and draft owner-reviewed notes. It is not a veterinary diagnosis or emergency triage.",
      documents: `${attachmentSummary} Record metadata can be exported here. Real document uploads require approved storage rules before public launch.`,
      deletion: "Account deletion is not self-serve until provider-backed deletion and audit rules are enabled. Export data before deletion.",
    },
  };
}

export function serializePrivacyExportBundle(bundle: PrivacyExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

export function deriveAccountSafetyPlan(input: AccountSafetyPlanInput): AccountSafetyPlan {
  const records = safeArray(input.state.records);
  const entries = safeArray(input.state.entries);
  const launchBlockers: string[] = [];

  const accountDeletionEnabled = Boolean(input.accountDeletionEnabled);
  const accountDeletionProof = buildAccountDeletionProofManifest(input.accountDeletionEvidence);
  const accountDeletionReady = accountDeletionEnabled && accountDeletionProof.destructiveDeletionAllowed;
  const storageProviderConfigured = Boolean(input.storageProviderConfigured);
  const storageProviderProofReady = isAttachmentStorageProviderProofReady({
    storageProviderConfigured,
    storageProviderEvidence: input.storageProviderEvidence,
  });
  const aiProviderConfigured = Boolean(input.aiProviderConfigured);
  const aiProviderProof = buildAiProviderProofManifest(input.aiProviderEvidence);
  const aiProviderProofReady = aiProviderConfigured && aiProviderProof.liveAiAllowed;
  const paymentsEnabled = Boolean(input.paymentsEnabled);
  const paymentsProof = buildPaymentsProviderProofManifest(input.paymentsProviderEvidence ?? {});
  const paymentsProviderProofReady = paymentsEnabled && paymentsProof.status === "ready";
  const attachmentManifest = deriveAttachmentManifest(input.state, {
    storageProviderConfigured,
    storageProviderEvidence: input.storageProviderEvidence,
  });
  const attachmentSummary = formatAttachmentManifestSummary(attachmentManifest);

  if (!accountDeletionEnabled) {
    launchBlockers.push("Self-serve account deletion is not enabled.");
  } else if (!accountDeletionReady) {
    launchBlockers.push("Self-serve account deletion requires structured account deletion proof before destructive deletion can be enabled.");
  }
  if (!storageProviderProofReady) {
    launchBlockers.push("Document storage provider requires structured storage proof evidence.");
  }
  if (!aiProviderConfigured) {
    launchBlockers.push("AI provider key and model policy are not configured.");
  } else if (!aiProviderProofReady) {
    launchBlockers.push("WoofGuide AI provider proof requires structured OpenAI, model, source, write-gate, safety, and fallback evidence.");
  }
  if (!paymentsEnabled) {
    launchBlockers.push("Payments remain blocked until privacy, support, refund, and app-store obligations are approved.");
  } else if (!paymentsProviderProofReady) {
    launchBlockers.push("Payments proof requires structured product, billing, receipt, restore, refund/support, and checkout evidence.");
  }

  return {
    export: {
      status: "ready",
      title: "Care data export",
      detail: `Ready to export ${entries.length} care logs, ${records.length} records, routines, diet, reports, roster, access passes, adventure memories, and household context.`,
      action: "Share export",
    },
    accountDeletion: {
      status: accountDeletionReady ? "ready" : accountDeletionEnabled ? "blocked" : "manual_required",
      title: "Account deletion",
      detail: accountDeletionReady
        ? "Provider-backed deletion is available."
        : accountDeletionEnabled
          ? "Self-serve deletion stays blocked until structured account deletion proof covers route/auth, export-before-delete, data/object receipts, audit/support, recovery/cancellation, and legal/store approval."
          : "Self-serve deletion is not connected yet. Prepare a manual deletion request and export care data first.",
      action: accountDeletionReady ? "Start deletion" : accountDeletionEnabled ? "Review deletion proof" : "Prepare request",
    },
    aiDisclosure: {
      status: aiProviderProofReady ? "ready" : "limited",
      title: "WoofGuide AI disclosure",
      detail: aiProviderProofReady
        ? "WoofGuide must cite owner-provided context, keep actions owner-reviewed, and preserve the medical boundary."
        : aiProviderConfigured
          ? "WoofGuide is limited to deterministic or fallback behavior until structured WoofGuide AI provider proof covers OpenAI key storage, model policy, source rules, owner-reviewed writes, veterinary safety, and fallback handling."
          : "WoofGuide is limited to deterministic or fallback behavior until AI provider policy is configured.",
      action: "Review disclosure",
    },
    documentStorage: {
      status: storageProviderProofReady ? "ready" : "blocked",
      title: "Document storage rules",
      detail: storageProviderProofReady
        ? attachmentManifest.uploadReady > 0
          ? `${attachmentSummary} Verify provider migration before release.`
          : "Uploaded records must stay household-scoped with reviewable export and deletion rules."
        : `${attachmentSummary} Uploads stay disabled until structured storage proof covers buckets, signed access, household scope, retention, export, deletion, QA evidence storage, and Apollo approval.`,
      action: "Review rules",
    },
    payments: {
      status: paymentsProviderProofReady ? "ready" : "blocked",
      title: "Payments and subscriptions",
      detail: paymentsProviderProofReady
        ? "Checkout can run only under approved subscription terms."
        : paymentsEnabled
          ? "Checkout stays disabled until structured payments proof covers product catalog, billing path, iOS App Store and Android Google Play sandbox receipts, restore purchases, refund/support policy, and Apollo checkout approval."
          : "Checkout stays disabled until privacy, support, refund, and app-store subscription obligations are approved.",
      action: paymentsProviderProofReady ? "Review terms" : paymentsEnabled ? "Review payments proof" : "View launch blockers",
    },
    launchBlockers,
  };
}

export function buildAccountDeletionRequest(
  state: PrivacyExportState,
  context: PrivacyExportContext = {},
  now: number = Date.now(),
): AccountDeletionRequest {
  const name = dogName(state);
  const when = generatedAt(now);
  const householdName = context.householdName?.trim() || "Unknown household";
  const userId = context.userId?.trim() || "Unknown user";
  const householdId = context.householdId?.trim() || "Unknown household id";
  const attachmentManifest = deriveAttachmentManifest(state, attachmentStorageOptionsForState(state));
  const attachmentSummary = formatAttachmentManifestSummary(attachmentManifest);

  return {
    subject: `WoofWatcher Account deletion request - ${name}`,
    body: [
      "WoofWatcher account deletion request",
      "",
      `Requested at: ${when}`,
      `Dog: ${name}`,
      `User id: ${userId}`,
      `Household: ${householdName}`,
      `Household id: ${householdId}`,
      "",
      "Requested scope:",
      "- Delete my account profile and household membership.",
      "- Delete or anonymize care logs, routines, diet profile, pet roster slots, Access Pass drafts, Adventure memories, records, report artifacts, and calendar reminders where legally and technically allowed.",
      `- Review the local attachment queue before deletion: ${attachmentSummary}`,
      "- Delete generated report artifacts and uploaded documents once production storage exists.",
      "",
      "Safety note: manual review is required before destructive deletion.",
      "Export data before deletion.",
    ].join("\n"),
  };
}
