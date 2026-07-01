import {
  derivePetCredentialReadiness,
  deriveHealthWatch,
  deriveMoodTrend,
  deriveRecordReminders,
  describeReportArtifactSource,
  getRecordDueStatus,
  normalizeCareEventType,
  summarizePetCredentialArtifacts,
  summarizeReportArtifacts,
  summarizeRecordVault,
  type ReportArtifact,
} from "../../../lib/care-domain/src/index.ts";

export type WoofGuideActionUrgency = "normal" | "watch" | "alert";

export type WoofGuideActionRoute =
  | "/log"
  | "/calendar"
  | "/records"
  | "/more";

export type WoofGuideActionIcon =
  | "bowl"
  | "calendar"
  | "heart"
  | "paw"
  | "records"
  | "spark";

export interface WoofGuideActionEntry {
  id: string;
  type: string;
  title?: string;
  caregiver?: string;
  occurredAt: string;
  severity?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
}

export interface WoofGuideActionRoutine {
  id?: string;
  type: string;
  label: string;
  time: string;
  owner?: string;
  note?: string;
}

export interface WoofGuideActionRecord {
  id?: string;
  type: string;
  title: string;
  due?: string;
  note?: string;
  attachmentUri?: string;
  attachmentName?: string;
}

export interface WoofGuideActionDiet {
  primaryFood?: string;
  normalPortion?: string;
  mealSchedule?: string;
  appetiteQuirks?: string;
  vetNotes?: string;
}

export interface WoofGuideActionCaregiver {
  name?: string;
  role?: string;
}

export interface WoofGuideActionState {
  profile?: {
    name?: string;
    breed?: string;
    careFocus?: string;
    vetBoundary?: string;
    microchipNumber?: string;
    insuranceProvider?: string;
    insurancePolicy?: string;
    primaryVet?: string;
    emergencyContact?: string;
    weight?: {
      current?: number;
      unit?: string;
    };
  };
  dietProfile?: WoofGuideActionDiet;
  caregivers?: readonly WoofGuideActionCaregiver[];
  entries: readonly WoofGuideActionEntry[];
  routines: readonly WoofGuideActionRoutine[];
  records?: readonly WoofGuideActionRecord[];
  reportArtifacts?: readonly ReportArtifact[];
}

export type WoofGuideDraftKind =
  | "log_entry"
  | "reminder"
  | "vet_note"
  | "care_pass"
  | "mood_summary"
  | "records_attachment_prep"
  | "pet_credential_prep"
  | "report_history"
  | "pet_credential_history";

export interface WoofGuideDraftEntry {
  type: string;
  title: string;
  caregiver: string;
  occurredAt: string;
  note?: string;
  details?: Record<string, unknown>;
}

export interface WoofGuideDraftCalendarEvent {
  title: string;
  type: string;
  date: string;
  time?: string;
  note?: string;
  source: "woofguide";
}

export interface WoofGuideActionDraft {
  kind: WoofGuideDraftKind;
  title: string;
  body: string;
  cta: string;
  safety?: string;
  sourceEntryIds?: string[];
  entry?: WoofGuideDraftEntry;
  calendarEvent?: WoofGuideDraftCalendarEvent;
}

export interface WoofGuideActionCard {
  id: string;
  label: string;
  detail: string;
  urgency: WoofGuideActionUrgency;
  icon: WoofGuideActionIcon;
  route?: WoofGuideActionRoute;
  prompt?: string;
  draft?: WoofGuideActionDraft;
}

function isToday(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function dogName(state: WoofGuideActionState): string {
  return state.profile?.name?.trim() || "your dog";
}

function hasDietBaseline(diet?: WoofGuideActionDiet): boolean {
  return Boolean(diet?.primaryFood?.trim() && diet.normalPortion?.trim() && diet.mealSchedule?.trim());
}

function localDateKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function caregiverName(state: WoofGuideActionState): string {
  return state.caregivers?.map((caregiver) => caregiver.name?.trim()).find(Boolean) ?? "You";
}

function mealLogDraft(
  state: WoofGuideActionState,
  now: number,
): WoofGuideActionDraft {
  const name = dogName(state);
  const expectedPortion = state.dietProfile?.normalPortion?.trim() || "normal portion";
  const caregiver = caregiverName(state);
  return {
    kind: "log_entry",
    title: "Review meal log draft",
    body: `Create a reviewed meal log for ${name}. Expected portion: ${expectedPortion}. Adjust served/eaten amounts before saving if this was partial or skipped.`,
    cta: "Add reviewed log",
    entry: {
      type: "meal",
      title: "Meal",
      caregiver,
      occurredAt: new Date(now).toISOString(),
      details: {
        expectedPortion,
        mealCompletion: "complete",
        householdVisible: true,
      },
    },
  };
}

function vetNoteDraft(
  state: WoofGuideActionState,
  now: number,
): WoofGuideActionDraft {
  const name = dogName(state);
  const health = deriveHealthWatch({ entries: state.entries, routines: state.routines, now });
  const sourceEntryIds = health.patterns.flatMap((pattern) => pattern.entryIds);
  const patternLines = health.patterns
    .map((pattern) => `- ${pattern.label} (${pattern.window}): ${pattern.evidence} Next: ${pattern.nextStep}`)
    .join("\n");
  const redFlags = health.redFlags.length
    ? `\nRed flags:\n${health.redFlags.map((flag) => `- ${flag.label}${flag.detail ? `: ${flag.detail}` : ""}`).join("\n")}`
    : "";
  return {
    kind: "vet_note",
    title: "Review vet note draft",
    body: [
      `${name} vet note draft`,
      "",
      `Status: ${health.status}`,
      `Summary: ${health.summary}`,
      "",
      "Health Pattern Review",
      patternLines,
      redFlags,
      "",
      state.profile?.name ? `Owner note: This is owner-entered WoofWatcher context for ${name}.` : "Owner note: This is owner-entered WoofWatcher context.",
      "Safety boundary: This is not a diagnosis.",
      health.vetBoundary,
    ].filter(Boolean).join("\n"),
    cta: "Insert draft",
    safety: "Owner-reviewed context only; not a diagnosis or emergency triage.",
    sourceEntryIds,
  };
}

function reminderDraft(
  state: WoofGuideActionState,
  now: number,
): WoofGuideActionDraft | undefined {
  const reminder = deriveRecordReminders(state.records ?? [], { now })[0];
  if (!reminder) return undefined;
  return {
    kind: "reminder",
    title: "Review reminder draft",
    body: `${reminder.label}\n${reminder.detail}\n${reminder.action}`,
    cta: "Add reminder",
    calendarEvent: {
      title: reminder.label,
      type: reminder.section ?? "document",
      date: localDateKey(now),
      note: `${reminder.detail} ${reminder.action}`,
      source: "woofguide",
    },
  };
}

function carePassDraft(): WoofGuideActionDraft {
  return {
    kind: "care_pass",
    title: "Review Care Pass draft",
    body: "Open Records to preview sitter, vet, trainer, or caregiver Care Pass sections before sharing. Care Passes include routines, diet, Health Pattern Review, records, and handoff checklists.",
    cta: "Open Care Pass review",
    safety: "Review before sharing with anyone outside the household.",
  };
}

function moodSummaryDraft(
  state: WoofGuideActionState,
  now: number,
): WoofGuideActionDraft | undefined {
  const name = dogName(state);
  const trend = deriveMoodTrend({ entries: state.entries, now, lookbackDays: 30, limit: 4 });
  if (trend.total === 0) return undefined;

  const energyLine = `Energy: ${trend.energy.low} low, ${trend.energy.steady} steady, ${trend.energy.high} high.`;
  const latest = trend.latest
    ? `Latest: ${trend.latest.moodLabel}${trend.latest.energyLevel ? `, ${trend.latest.energyLevel} energy` : ""} by ${trend.latest.caregiver}${trend.latest.context ? ` after ${trend.latest.context}` : ""}.`
    : "";
  const visibleItems = trend.items
    .map((item) => `- ${item.moodLabel}${item.energyLevel ? `, ${item.energyLevel} energy` : ""} by ${item.caregiver}${item.context ? ` (${item.context})` : ""}`)
    .join("\n");

  return {
    kind: "mood_summary",
    title: "Review mood summary",
    body: [
      `${name} Mood & Energy Review`,
      "",
      trend.summary,
      energyLine,
      latest,
      visibleItems,
      "",
      trend.nextStep,
      "Safety boundary: Mood and energy are owner-reported context only, not a diagnosis or emergency triage.",
    ].filter(Boolean).join("\n"),
    cta: "Insert summary",
    safety: "Owner-reported context only; not a diagnosis or emergency triage.",
    sourceEntryIds: trend.items.map((item) => item.id),
  };
}

function recordsAttachmentPrepDraft(state: WoofGuideActionState): WoofGuideActionDraft | undefined {
  const vault = summarizeRecordVault(state.records ?? []);
  const attachment = vault.localAttachmentSummary;
  if (attachment.totalAttachable === 0 || attachment.missingAttachment === 0) return undefined;

  const name = dogName(state);
  const attachedLine = `${attachment.withAttachment} of ${attachment.totalAttachable} receipt/document records have local files attached.`;
  const missingLine = attachment.missingAttachmentTitles.length
    ? `Missing local files: ${attachment.missingAttachmentTitles.join(", ")}.`
    : `${attachment.missingAttachment} receipt/document records still need local files.`;

  return {
    kind: "records_attachment_prep",
    title: "Review records attachment prep",
    body: [
      `${name} Records Attachment Prep`,
      "",
      attachedLine,
      missingLine,
      attachment.boundaryLine,
      "",
      "Next step: Open Records, attach the missing local receipts or documents, then review the Care Pass or Progress Report before sharing.",
    ].join("\n"),
    cta: "Insert prep note",
    safety: "Owner-reviewed prep only; cloud storage is not enabled and files stay local until provider-backed document storage is approved.",
  };
}

function petCredentialPrepDraft(state: WoofGuideActionState): WoofGuideActionDraft | undefined {
  const readiness = derivePetCredentialReadiness({
    profile: state.profile,
    caregivers: state.caregivers,
    records: state.records,
  });
  if (readiness.status === "ready" || readiness.readyCount === 0) return undefined;

  const name = dogName(state);
  return {
    kind: "pet_credential_prep",
    title: "Review Dog ID prep",
    body: [
      `${name} Dog ID Prep`,
      "",
      readiness.summary,
      readiness.availableLabels.length ? `Ready fields: ${readiness.availableLabels.join(", ")}.` : "",
      readiness.missingLabels.length ? `Missing fields: ${readiness.missingLabels.join(", ")}.` : "",
      readiness.boundaryLine,
      "",
      "Next step: Open Records, add the missing credential details, then review the Dog ID card and printable source before sharing.",
    ].filter(Boolean).join("\n"),
    cta: "Insert Dog ID prep",
    safety: "Owner-reviewed prep only; Dog ID image/PDF export and provider-backed credential storage are not enabled.",
  };
}

function petCredentialHistoryDraft(state: WoofGuideActionState): WoofGuideActionDraft | undefined {
  const summary = summarizePetCredentialArtifacts(state.reportArtifacts ?? []);
  if (!summary.latest) return undefined;

  const name = dogName(state);
  return {
    kind: "pet_credential_history",
    title: "Review saved Dog ID source",
    body: [
      `${name} Dog ID Report History`,
      "",
      summary.summary,
      summary.latestLine,
      summary.action,
      summary.boundaryLine,
    ].filter(Boolean).join("\n"),
    cta: "Open Report History",
    safety: "Owner-reviewed resend only; credential storage, PDF/image export, cloud sharing, retention, and deletion policy are not enabled.",
  };
}

function reportHistoryDraft(state: WoofGuideActionState): WoofGuideActionDraft | undefined {
  const summary = summarizeReportArtifacts(state.reportArtifacts ?? []);
  if (!summary.latest || (summary.carePassCount === 0 && summary.progressReportCount === 0)) return undefined;

  const name = dogName(state);
  const latestSource = describeReportArtifactSource(summary.latest);
  return {
    kind: "report_history",
    title: "Review saved handoff sources",
    body: [
      `${name} Report History Review`,
      "",
      summary.summary,
      summary.latestLine,
      latestSource.metadataLine,
      latestSource.fileLine,
      summary.action,
      summary.readinessLine,
      summary.reviewLine,
      summary.cleanupLine,
      latestSource.lifecycleLine,
      summary.boundaryLine,
    ].filter(Boolean).join("\n"),
    cta: "Open Report History",
    safety: "Owner-reviewed resend only; native PDF export, server-backed report storage, cloud sharing, retention, and deletion policy are not enabled.",
  };
}

export function deriveWoofGuideActions(
  state: WoofGuideActionState,
  now: number = Date.now(),
): WoofGuideActionCard[] {
  const name = dogName(state);
  const health = deriveHealthWatch({ entries: state.entries, routines: state.routines, now });
  const moodDraft = moodSummaryDraft(state, now);
  const attachmentPrepDraft = recordsAttachmentPrepDraft(state);
  const credentialPrepDraft = petCredentialPrepDraft(state);
  const savedReportHistoryDraft = reportHistoryDraft(state);
  const credentialHistoryDraft = petCredentialHistoryDraft(state);
  const moodUrgency = moodDraft
    ? deriveMoodTrend({ entries: state.entries, now, lookbackDays: 30, limit: 1 }).status === "watch"
      ? "watch"
      : "normal"
    : "normal";
  const records = state.records ?? [];
  const recordVault = summarizeRecordVault(records);
  const recordReminders = deriveRecordReminders(records, { now });
  const recordAttention = records.filter((record) => {
    const status = getRecordDueStatus(record, now).status;
    return status === "expired" || status === "due_soon";
  });
  const todaysEntries = state.entries.filter((entry) => isToday(entry.occurredAt, now));
  const mealsToday = todaysEntries.filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal");
  const actions: WoofGuideActionCard[] = [];

  if (health.status !== "good") {
    actions.push({
      id: "vet-note",
      label: "Draft vet note",
      detail: health.summary,
      urgency: health.status === "alert" ? "alert" : "watch",
      icon: "heart",
      prompt: `Draft a concise vet note for ${name} using recent health logs, red flags, and the non-diagnostic boundary.`,
      draft: vetNoteDraft(state, now),
    });
  }

  if (recordVault.missingCritical.length > 0 || recordAttention.length > 0) {
    const topReminder = recordReminders[0];
    actions.push({
      id: "records-review",
      label: "Review records",
      detail: topReminder
        ? topReminder.detail
        : recordAttention.length
        ? `${recordAttention.length} record needs date attention.`
        : `Missing ${recordVault.missingCritical.join(", ").toLowerCase()}.`,
      urgency: recordAttention.some((record) => getRecordDueStatus(record, now).status === "expired") ? "alert" : "watch",
      icon: "records",
      route: "/records",
      draft: reminderDraft(state, now),
    });
  }

  if (!hasDietBaseline(state.dietProfile)) {
    actions.push({
      id: "diet-baseline",
      label: "Set diet baseline",
      detail: "Food, portion, and meal schedule are needed for better feeding guidance.",
      urgency: "watch",
      icon: "bowl",
      route: "/more",
    });
  } else if (mealsToday.length === 0) {
    actions.push({
      id: "log-meal",
      label: "Log first meal",
      detail: `${name} has no meal logged today.`,
      urgency: "normal",
      icon: "bowl",
      route: "/log",
      draft: mealLogDraft(state, now),
    });
  }

  if (moodDraft) {
    actions.push({
      id: "mood-summary",
      label: "Review mood summary",
      detail: moodDraft.body.split("\n").find((line) => line.includes("shared mood check-ins")) ?? "Summarize recent shared mood and energy context.",
      urgency: moodUrgency,
      icon: "heart",
      draft: moodDraft,
    });
  }

  if (attachmentPrepDraft) {
    const attachment = recordVault.localAttachmentSummary;
    actions.push({
      id: "records-attachment-prep",
      label: "Prep record files",
      detail: `${attachment.withAttachment} of ${attachment.totalAttachable} receipt/document records have local files attached.`,
      urgency: "watch",
      icon: "records",
      route: "/records",
      draft: attachmentPrepDraft,
    });
  }

  if (credentialPrepDraft) {
    actions.push({
      id: "dog-id-prep",
      label: "Prep Dog ID",
      detail: credentialPrepDraft.body.split("\n").find((line) => line.includes("Dog ID needs")) ?? "Review missing Dog ID fields before sharing.",
      urgency: "watch",
      icon: "records",
      route: "/records",
      draft: credentialPrepDraft,
    });
  }

  if (savedReportHistoryDraft) {
    const reportHistory = summarizeReportArtifacts(state.reportArtifacts ?? []);
    actions.push({
      id: "report-history",
      label: "Review saved reports",
      detail: reportHistory.summary,
      urgency: "normal",
      icon: "records",
      route: "/records",
      draft: savedReportHistoryDraft,
    });
  }

  if (credentialHistoryDraft) {
    const credentialHistory = summarizePetCredentialArtifacts(state.reportArtifacts ?? []);
    actions.push({
      id: "dog-id-history",
      label: "Review Dog ID source",
      detail: credentialHistory.summary,
      urgency: "normal",
      icon: "records",
      route: "/records",
      draft: credentialHistoryDraft,
    });
  }

  if (state.routines.length === 0) {
    actions.push({
      id: "routine-setup",
      label: "Create routine",
      detail: "Add a starter schedule so WoofGuide can watch what is due next.",
      urgency: "watch",
      icon: "calendar",
      route: "/calendar",
    });
  }

  actions.push({
    id: "care-pass",
    label: "Preview Care Pass",
    detail: "Review sitter, vet, trainer, or caregiver report sections before sharing.",
    urgency: "normal",
    icon: "spark",
    route: "/records",
    draft: carePassDraft(),
  });

  return actions.slice(0, 4);
}
