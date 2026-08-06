import {
  deriveHealthWatch,
  deriveRecordReminders,
  getRecordDueStatus,
  normalizeCareEventType,
  summarizeRecordVault,
} from "../../../lib/care-domain/src/index.ts";
import { localDateKey, todayLocalDateKey } from "./localCalendar.ts";
import {
  canonicalHealthRoute,
  canonicalHomeRoute,
  canonicalLogRoute,
  canonicalPlansRoute,
} from "./canonicalRouteBuilders.ts";

export type WoofGuideActionUrgency = "normal" | "watch" | "alert";

export type WoofGuideActionRoute =
  | ReturnType<typeof canonicalHealthRoute>
  | ReturnType<typeof canonicalLogRoute>
  | ReturnType<typeof canonicalPlansRoute>;

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
  correctionIssues?: readonly unknown[];
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
  };
  dietProfile?: WoofGuideActionDiet;
  caregivers?: readonly WoofGuideActionCaregiver[];
  entries: readonly WoofGuideActionEntry[];
  routines: readonly WoofGuideActionRoutine[];
  records?: readonly WoofGuideActionRecord[];
}

export type WoofGuideDraftKind = "log_entry" | "reminder" | "vet_note" | "care_pass";

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
  return Number.isFinite(d.getTime()) && localDateKey(d) === todayLocalDateKey(new Date(now));
}

function dogName(state: WoofGuideActionState): string {
  return state.profile?.name?.trim() || "your dog";
}

function hasDietBaseline(diet?: WoofGuideActionDiet): boolean {
  return Boolean(diet?.primaryFood?.trim() && diet.normalPortion?.trim() && diet.mealSchedule?.trim());
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
    title: "Review meal served draft",
    body: `Create a reviewed served-meal log for ${name}. Expected portion: ${expectedPortion}. Save it with outcome pending, then update whether ${name} ate all, ate some, refused, or kept grazing.`,
    cta: "Add reviewed log",
    entry: {
      type: "meal",
      title: "Meal",
      caregiver,
      occurredAt: new Date(now).toISOString(),
      details: {
        expectedPortion,
        mealCompletion: "served",
        mealLifecycle: "outcome-pending",
        requiresOutcomeUpdate: true,
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
      date: todayLocalDateKey(new Date(now)),
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

export type WoofGuideAssistantGateReason =
  | "ready"
  | "provider-proof-missing"
  | "api-domain-missing";

export interface WoofGuideAssistantGateInput {
  /** Base URL of the care-helper API, empty when no deployment domain exists. */
  apiBaseUrl?: string | null;
  /** True only when the structured AI provider proof manifest allows live AI. */
  liveAiProofReady: boolean;
}

export interface WoofGuideAssistantGate {
  enabled: boolean;
  reason: WoofGuideAssistantGateReason;
  statusLabel: string;
  headline: string;
  privacyNote: string;
  composerNote: string;
}

export const WOOFGUIDE_ASSISTANT_OFF_STATUS_LABEL = "Not in this build";

export const WOOFGUIDE_ASSISTANT_OFF_HEADLINE =
  "WoofGuide's assistant isn't enabled in this build, so live answers are off.";

export const WOOFGUIDE_ASSISTANT_OFF_PRIVACY_NOTE =
  "Nothing you type here is sent anywhere, so the ask box is off until an assistant provider passes owner review.";

export const WOOFGUIDE_ASSISTANT_OFF_COMPOSER_NOTE =
  "Assistant off in this build — nothing typed here would be sent.";

/**
 * Mirrors the PWA rule from the decision log: WoofGuide never calls the live
 * care-helper until structured AI provider proof is ready AND a deployment
 * domain exists. Until both are true the screen must say so honestly instead
 * of pretending the assistant is temporarily down.
 */
export function resolveWoofGuideAssistantGate(
  input: WoofGuideAssistantGateInput,
): WoofGuideAssistantGate {
  const offGate = {
    enabled: false,
    statusLabel: WOOFGUIDE_ASSISTANT_OFF_STATUS_LABEL,
    headline: WOOFGUIDE_ASSISTANT_OFF_HEADLINE,
    privacyNote: WOOFGUIDE_ASSISTANT_OFF_PRIVACY_NOTE,
    composerNote: WOOFGUIDE_ASSISTANT_OFF_COMPOSER_NOTE,
  } as const;
  if (!input.liveAiProofReady) {
    return { ...offGate, reason: "provider-proof-missing" };
  }
  if (!(input.apiBaseUrl ?? "").trim()) {
    return { ...offGate, reason: "api-domain-missing" };
  }
  return {
    enabled: true,
    reason: "ready",
    statusLabel: "Ready",
    headline: "",
    privacyNote: "",
    composerNote: "",
  };
}

export interface WoofGuideAssistantFallbackLink {
  id: "health" | "records" | "home";
  label: string;
  detail: string;
  route:
    | ReturnType<typeof canonicalHealthRoute>
    | ReturnType<typeof canonicalHomeRoute>;
  icon: WoofGuideActionIcon;
}

/** Honest, working destinations shown while the assistant is gated off. */
export const WOOFGUIDE_ASSISTANT_FALLBACK_LINKS: readonly WoofGuideAssistantFallbackLink[] = [
  {
    id: "health",
    label: "Health Watch patterns",
    detail: "Non-diagnostic patterns from your own logs.",
    route: canonicalHealthRoute("health-watch"),
    icon: "heart",
  },
  {
    id: "records",
    label: "Records and Care Pass",
    detail: "Vaccines, documents, and shareable care summaries.",
    route: canonicalHealthRoute("records"),
    icon: "records",
  },
  {
    id: "home",
    label: "Today's care",
    detail: "Back to the room to log meals, potty, and walks.",
    route: canonicalHomeRoute(),
    icon: "paw",
  },
];

/**
 * Deterministic owner-reviewed vet-note draft for the Health Watch
 * "Draft vet questions" funnel. Reuses the existing vetNoteDraft mechanism —
 * no live AI and no new medical guidance.
 */
export function deriveWoofGuideVetNoteAction(
  state: WoofGuideActionState,
  now: number = Date.now(),
): WoofGuideActionCard {
  const health = deriveHealthWatch({ entries: state.entries, routines: state.routines, now });
  return {
    id: "health-review-vet-note",
    label: "Draft vet note",
    detail: health.summary,
    urgency: health.status === "alert" ? "alert" : health.status === "watch" ? "watch" : "normal",
    icon: "heart",
    draft: vetNoteDraft(state, now),
  };
}

export function deriveWoofGuideActions(
  state: WoofGuideActionState,
  now: number = Date.now(),
): WoofGuideActionCard[] {
  const name = dogName(state);
  const health = deriveHealthWatch({ entries: state.entries, routines: state.routines, now });
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
      route: canonicalHealthRoute("records"),
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
      route: canonicalHealthRoute("diet"),
    });
  } else if (mealsToday.length === 0) {
    actions.push({
      id: "log-meal",
      label: "Log first meal",
      detail: `${name} has no meal logged today.`,
      urgency: "normal",
      icon: "bowl",
      route: canonicalLogRoute(),
      draft: mealLogDraft(state, now),
    });
  }

  if (state.routines.length === 0) {
    actions.push({
      id: "routine-setup",
      label: "Create routine",
      detail: "Add a starter schedule so WoofGuide can watch what is due next.",
      urgency: "watch",
      icon: "calendar",
      route: canonicalPlansRoute(),
    });
  }

  actions.push({
    id: "care-pass",
    label: "Preview Care Pass",
    detail: "Review sitter, vet, trainer, or caregiver report sections before sharing.",
    urgency: "normal",
    icon: "spark",
    route: canonicalHealthRoute("care-pass"),
    draft: carePassDraft(),
  });

  return actions.slice(0, 4);
}
