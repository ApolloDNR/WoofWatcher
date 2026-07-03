import {
  buildAttachmentReviewRows,
  deriveAttachmentManifest,
  formatAttachmentManifestSummary,
  type AttachmentReviewRow,
  type AttachmentLaunchQueue,
} from "./attachmentManifest.ts";

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
  storageProviderConfigured?: boolean;
  accountDeletionEnabled?: boolean;
  paymentsEnabled?: boolean;
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
  const attachmentManifest = deriveAttachmentManifest(
    {
      entries,
      records,
      adventureMemories,
      reportArtifacts,
    },
    { storageProviderConfigured: false },
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
      launchSupportProfile: state.launchSupportProfile ?? null,
      launchProviderProfile: state.launchProviderProfile ?? null,
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
  const storageProviderConfigured = Boolean(input.storageProviderConfigured);
  const aiProviderConfigured = Boolean(input.aiProviderConfigured);
  const paymentsEnabled = Boolean(input.paymentsEnabled);
  const attachmentManifest = deriveAttachmentManifest(input.state, { storageProviderConfigured });
  const attachmentSummary = formatAttachmentManifestSummary(attachmentManifest);

  if (!accountDeletionEnabled) {
    launchBlockers.push("Self-serve account deletion is not enabled.");
  }
  if (!storageProviderConfigured) {
    launchBlockers.push("Document storage provider and access rules are not approved.");
  }
  if (!aiProviderConfigured) {
    launchBlockers.push("AI provider key and model policy are not configured.");
  }
  if (!paymentsEnabled) {
    launchBlockers.push("Payments remain blocked until privacy, support, refund, and app-store obligations are approved.");
  }

  return {
    export: {
      status: "ready",
      title: "Care data export",
      detail: `Ready to export ${entries.length} care logs, ${records.length} records, routines, diet, reports, roster, access passes, adventure memories, and household context.`,
      action: "Share export",
    },
    accountDeletion: {
      status: accountDeletionEnabled ? "ready" : "manual_required",
      title: "Account deletion",
      detail: accountDeletionEnabled
        ? "Provider-backed deletion is available."
        : "Self-serve deletion is not connected yet. Prepare a manual deletion request and export care data first.",
      action: accountDeletionEnabled ? "Start deletion" : "Prepare request",
    },
    aiDisclosure: {
      status: aiProviderConfigured ? "ready" : "limited",
      title: "WoofGuide AI disclosure",
      detail: aiProviderConfigured
        ? "WoofGuide must cite owner-provided context, keep actions owner-reviewed, and preserve the medical boundary."
        : "WoofGuide is limited to deterministic or fallback behavior until AI provider policy is configured.",
      action: "Review disclosure",
    },
    documentStorage: {
      status: storageProviderConfigured ? "ready" : "blocked",
      title: "Document storage rules",
      detail: storageProviderConfigured
        ? attachmentManifest.uploadReady > 0
          ? `${attachmentSummary} Verify provider migration before release.`
          : "Uploaded records must stay household-scoped with reviewable export and deletion rules."
        : `${attachmentSummary} Uploads stay disabled until storage, signed access, retention, and deletion rules are approved.`,
      action: "Review rules",
    },
    payments: {
      status: paymentsEnabled ? "ready" : "blocked",
      title: "Payments and subscriptions",
      detail: paymentsEnabled
        ? "Checkout can run only under approved subscription terms."
        : "Checkout stays disabled until privacy, support, refund, and app-store subscription obligations are approved.",
      action: "View launch blockers",
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
  const attachmentManifest = deriveAttachmentManifest(state, { storageProviderConfigured: false });
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
