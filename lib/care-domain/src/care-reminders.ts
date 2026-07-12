import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { deriveGroomingCare } from "./grooming-care.ts";
import {
  deriveMedicationFollowUps,
  type MedicationRecord,
} from "./medication.ts";
import { deriveRecordReminders, type CareRecord } from "./record-vault.ts";
import {
  deriveRoutineBoard,
  type RoutineBoardCaregiver,
} from "./routine-board.ts";

export type CareReminderKind = "routine" | "medication" | "record" | "grooming";
export type CareReminderUrgency = "alert" | "watch" | "info";
export type CareReminderStatus = "clear" | "attention" | "watch";

export interface CareReminderRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
  dose?: string | null;
}

export interface CareReminderEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface CareReminderRecord extends CareRecord, MedicationRecord {}

export interface CareReminderCaregiver extends RoutineBoardCaregiver {}

export type CareReminderNotificationPermissionStatus = "unknown" | "granted" | "denied" | "unavailable";

export interface CareReminderNotificationPreferences {
  providerConfigured?: boolean;
  providerStaged?: boolean;
  providerProofReady?: boolean;
  pushEnabled?: boolean;
  permissionStatus?: CareReminderNotificationPermissionStatus;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  optOut?: boolean;
}

export interface CareReminderCenterInput {
  routines: readonly CareReminderRoutine[];
  entries: readonly CareReminderEntry[];
  records?: readonly CareReminderRecord[];
  caregivers?: readonly CareReminderCaregiver[];
  notificationPreferences?: CareReminderNotificationPreferences;
  now?: number;
  limit?: number;
  routineLookaheadHours?: number;
}

export interface CareReminderItem {
  id: string;
  kind: CareReminderKind;
  label: string;
  detail: string;
  action: string;
  urgency: CareReminderUrgency;
  owner: string;
  time?: string;
  sourceId?: string;
  daysUntil?: number;
}

export interface CareReminderCenter {
  items: CareReminderItem[];
  total: number;
  alertCount: number;
  watchCount: number;
  routineCount: number;
  medicationCount: number;
  recordCount: number;
  groomingCount: number;
  status: CareReminderStatus;
  summary: string;
  nextStep: string;
  notificationReadiness: string;
  notificationPreferenceSummary: string;
  notificationQuietHours: string;
  notificationOptOut: string;
  providerBackedNotifications: boolean;
}

const DAY_MS = 86400000;
const URGENCY_RANK: Record<CareReminderUrgency, number> = { alert: 0, watch: 1, info: 2 };
const KIND_RANK: Record<CareReminderKind, number> = { routine: 0, medication: 1, record: 2, grooming: 3 };

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDateMs(value: unknown): number | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function daysUntil(value: unknown, now: number): number | undefined {
  const dueMs = parseDateMs(value);
  if (dueMs == null) return undefined;
  return Math.ceil((dueMs - now) / DAY_MS);
}

function routineDetail(time: string, owner: string): string {
  return [time ? `Scheduled ${time}` : "", owner ? `owner ${owner}` : ""].filter(Boolean).join(" with ") || "Routine needs review.";
}

function sortReminderItems(items: CareReminderItem[]): CareReminderItem[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999) ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.label.localeCompare(b.label),
  );
}

function summaryFor(total: number, alertCount: number, watchCount: number): string {
  if (total === 0) return "No reminder candidates need attention right now.";
  return `${total} reminder candidate${total === 1 ? "" : "s"} - ${alertCount} urgent, ${watchCount} watch.`;
}

function nextStepFor(status: CareReminderStatus): string {
  if (status === "attention") {
    return "Handle overdue or missed care first, then update the shared log so the household sees the result.";
  }
  if (status === "watch") {
    return "Review due-soon reminders and assign the owner before the care window closes.";
  }
  return "Keep routines and records current; push notifications still need provider setup.";
}

function notificationPreferenceSummaryFor(preferences: CareReminderNotificationPreferences = {}): string {
  const providerConfigured = preferences.providerConfigured === true;
  const pushEnabled = preferences.pushEnabled === true;
  const permissionStatus = preferences.permissionStatus ?? "unknown";
  const optedOut = preferences.optOut === true;

  if (!providerConfigured) {
    if (preferences.providerStaged === true && preferences.providerProofReady !== true) {
      return "Push provider is staged, but Reminder Center stays in-app until structured Expo/APNs/FCM, permission, quiet-hours, opt-out, and native delivery proof is attached.";
    }
    return "Push provider not configured; push notifications stay in-app until Expo, APNs, and Firebase/FCM proof is attached.";
  }
  if (optedOut) {
    return "Notifications are off by your choice; Reminder Center stays visible in app until you turn them back on.";
  }
  if (!pushEnabled) {
    return "Push reminders are off; Reminder Center stays in-app until you enable delivery.";
  }
  if (permissionStatus === "denied") {
    return "Device permission is denied; reminders stay in-app until permission is enabled on the device.";
  }
  if (permissionStatus === "unavailable") {
    return "Device notifications are unavailable here; use Reminder Center until native notification support is available.";
  }
  if (permissionStatus !== "granted") {
    return "Notification permission is not approved yet; review prompt copy before enabling provider-backed reminders.";
  }
  return "Push reminders are eligible for delivery QA; attach delivered-notification proof before launch.";
}

function notificationQuietHoursFor(preferences: CareReminderNotificationPreferences = {}): string {
  const start = clean(preferences.quietHoursStart);
  const end = clean(preferences.quietHoursEnd);
  if (start && end) {
    return `Quiet hours ${start}-${end} must mute non-urgent reminders until delivery QA proves the window.`;
  }
  return "Quiet hours not set; choose a quiet window before enabling reminder delivery.";
}

function notificationOptOutFor(preferences: CareReminderNotificationPreferences = {}): string {
  if (preferences.optOut === true) {
    return "Opted out; do not deliver push notifications until you turn them back on.";
  }
  return "Opt-out remains available; Opt-out control must stay visible before provider-backed delivery.";
}

function hasProviderBackedNotifications(preferences: CareReminderNotificationPreferences = {}): boolean {
  return preferences.providerConfigured === true
    && preferences.pushEnabled === true
    && preferences.permissionStatus === "granted"
    && preferences.optOut !== true;
}

export function deriveCareReminderCenter(input: CareReminderCenterInput): CareReminderCenter {
  const now = input.now ?? Date.now();
  const limit = Math.max(0, input.limit ?? 5);
  const routineLookaheadMinutes = Math.max(0, input.routineLookaheadHours ?? 3) * 60;
  const records = input.records ?? [];

  const routineBoard = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    caregivers: input.caregivers,
    now,
  });

  const routineItems = routineBoard.items
    .filter((item) => item.status !== "done")
    .filter((item) => normalizeCareEventType(item.type) !== "medication")
    .filter((item) => item.status !== "upcoming" || item.minutesFromNow <= routineLookaheadMinutes)
    .map((item): CareReminderItem => {
      const urgency: CareReminderUrgency =
        item.status === "overdue" ? "alert" : item.status === "due" ? "watch" : "info";
      const labelStatus = item.status === "overdue" ? "overdue" : item.status === "due" ? "due now" : "coming up";
      return {
        id: `routine_${item.id}_${item.status}`,
        kind: "routine",
        label: `${clean(item.label) || "Routine"} ${labelStatus}`,
        detail: routineDetail(item.time, item.owner),
        action:
          item.status === "overdue"
            ? "Log it, reschedule it, or assign an owner."
            : "Log completion from Calendar or open the full Log composer.",
        urgency,
        owner: item.owner || "Household",
        time: item.time,
        sourceId: item.id,
      };
    });

  const medicationItems = deriveMedicationFollowUps({
    routines: input.routines,
    entries: input.entries,
    records,
    now,
  }).map((item): CareReminderItem => ({
    id: `medication_${item.id}`,
    kind: "medication",
    label: item.label,
    detail: item.detail,
    action: item.action,
    urgency: item.urgency,
    owner: "Household",
    sourceId: item.routineId ?? item.recordId,
    daysUntil: item.daysUntil,
  }));

  const recordItems = deriveRecordReminders(records, { now })
    .slice(0, 4)
    .map((item): CareReminderItem => ({
      id: `record_${item.recordId ?? item.section ?? item.label}`,
      kind: "record",
      label: item.label,
      detail: item.detail,
      action: item.action,
      urgency: item.urgency,
      owner: "Household",
      sourceId: item.recordId,
      daysUntil: item.daysUntil,
    }));

  const grooming = deriveGroomingCare({ entries: input.entries, now, lookbackDays: 60, limit: 1 });
  const groomingDueIn = daysUntil(grooming.nextDue, now);
  const groomingItems =
    grooming.status === "watch"
      ? [
          {
            id: "grooming_watch",
            kind: "grooming" as const,
            label: "Grooming watch",
            detail: grooming.summary,
            action: grooming.nextStep,
            urgency: "watch" as const,
            owner: grooming.latest?.caregiver ?? "Household",
            sourceId: grooming.latest?.id,
            daysUntil: groomingDueIn,
          },
        ]
      : groomingDueIn != null && groomingDueIn <= 14
        ? [
            {
              id: "grooming_due",
              kind: "grooming" as const,
              label: groomingDueIn < 0 ? "Grooming overdue" : "Grooming due soon",
              detail:
                groomingDueIn < 0
                  ? `The next grooming date was ${grooming.nextDue}.`
                  : `The next grooming date is ${grooming.nextDue}.`,
              action: grooming.nextStep,
              urgency: groomingDueIn < 0 ? "alert" as const : "watch" as const,
              owner: grooming.latest?.caregiver ?? "Household",
              sourceId: grooming.latest?.id,
              daysUntil: groomingDueIn,
            },
          ]
        : [];

  const allItems = sortReminderItems([
    ...routineItems,
    ...medicationItems,
    ...recordItems,
    ...groomingItems,
  ]);
  const alertCount = allItems.filter((item) => item.urgency === "alert").length;
  const watchCount = allItems.filter((item) => item.urgency === "watch").length;
  const status: CareReminderStatus = alertCount > 0 ? "attention" : watchCount > 0 ? "watch" : "clear";
  const notificationPreferenceSummary = notificationPreferenceSummaryFor(input.notificationPreferences);
  const providerBackedNotifications = hasProviderBackedNotifications(input.notificationPreferences);

  return {
    items: allItems.slice(0, limit),
    total: allItems.length,
    alertCount,
    watchCount,
    routineCount: allItems.filter((item) => item.kind === "routine").length,
    medicationCount: allItems.filter((item) => item.kind === "medication").length,
    recordCount: allItems.filter((item) => item.kind === "record").length,
    groomingCount: allItems.filter((item) => item.kind === "grooming").length,
    status,
    summary: summaryFor(allItems.length, alertCount, watchCount),
    nextStep: nextStepFor(status),
    notificationReadiness: providerBackedNotifications
      ? "Reminder candidates are ready for owner review; push delivery is eligible for delivery QA, but launch still needs delivered-notification proof."
      : `Reminder candidates are ready for owner review; ${notificationPreferenceSummary}`,
    notificationPreferenceSummary,
    notificationQuietHours: notificationQuietHoursFor(input.notificationPreferences),
    notificationOptOut: notificationOptOutFor(input.notificationPreferences),
    providerBackedNotifications,
  };
}
