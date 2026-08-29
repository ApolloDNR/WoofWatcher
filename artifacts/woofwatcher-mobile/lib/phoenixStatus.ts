import type { CareState, Entry, Routine } from "@/context/CareContext";
import type { CareSyncDashboard } from "@/lib/careSync";
import type { CareInitialSyncStatus } from "@/lib/careInitialSyncReadiness";
import type { CareStorageWarning } from "@/lib/careWriteProtection";
import {
  deriveCareDayStatus,
  deriveRoutineBoard,
  isSharedCareEvidenceObservableAt,
  isRoutineBoardScheduledItem,
  normalizeCareEventType,
  selectSharedCareEvidence,
} from "@workspace/care-domain";

export type Mood = "happy" | "excited" | "calm" | "anxious" | "unwell";
export type ObservedEnergyLevel = "low" | "steady" | "high";

export interface MoodMeta {
  label: string;
  emoji: string;
  speech: string;
}

export const MOOD_META: Record<Mood, MoodMeta> = {
  happy: {
    label: "Happy",
    emoji: "🥰",
    speech: "Best day ever! Thanks for taking such good care of me. 💚",
  },
  excited: {
    label: "Impatient",
    emoji: "😤",
    speech: "It's walk o'clock! My paws are ready and so is my tail. 🐾",
  },
  calm: {
    label: "Content",
    emoji: "😌",
    speech: "Feeling cozy and settled. Life is pretty good. ☁️",
  },
  anxious: {
    label: "Unsure",
    emoji: "🥺",
    speech: "Feeling a little uneasy today — stay close to me? 🫶",
  },
  unwell: {
    label: "Off day",
    emoji: "🤒",
    speech: "My tummy's a bit funny. Let's take it easy today. 🤍",
  },
};

export interface CountStat {
  done: number;
  target: number;
}

export interface PhoenixStatus {
  mood: Mood;
  meta: MoodMeta;
  energy: number;
  /**
   * Values that are safe to present as observed pet facts. `mood` and
   * `energy` above remain total values for animation/rendering consumers, but
   * their neutral fallback must never be labelled as measured care data.
   */
  evidence: {
    mood: Mood | null;
    energy: ObservedEnergyLevel | null;
  };
  counts: {
    meals: CountStat;
    walks: CountStat;
    potty: CountStat;
    training: number;
    walkMinutes: number;
    healthAlert: boolean;
  };
  nextRoutine: Routine | null;
  minutesUntilNext: number | null;
  routineCorrectionCount: number;
}

export interface CareStorageAvailabilityInput {
  isLoaded: boolean;
  isInitialSyncSettled?: boolean;
  storageWarning: CareStorageWarning;
}

export interface CareStorageRecoveryInput
  extends CareStorageAvailabilityInput {
  isInitialSyncSettled: boolean;
}

export type CareStorageRecoveryAction =
  | { kind: "retry-read"; label: "Retry saved data" }
  | { kind: "retry-save"; label: "Retry device save" };

export interface MoreCareFactsInput extends CareStorageAvailabilityInput {
  routineCount: number;
  todayLogCount: number;
  streakDays: number;
}

export interface MoreCareFactsPresentation {
  trusted: boolean;
  routineCount: number | null;
  todayLogCount: number | null;
  streakDays: number | null;
  careIntelligenceAvailable: boolean;
}

/**
 * Care-derived facts on More are presentable after the identity-scoped local
 * store hydrates without a read/write/reset warning. Provider freshness is a
 * separate truth boundary: an offline household check must not relabel safe
 * on-device facts as missing or claim that device storage failed.
 */
export function deriveMoreCareFactsPresentation({
  isLoaded,
  storageWarning,
  routineCount,
  todayLogCount,
  streakDays,
}: MoreCareFactsInput): MoreCareFactsPresentation {
  const trusted = isLoaded && storageWarning === null;
  return {
    trusted,
    routineCount: trusted ? routineCount : null,
    todayLogCount: trusted ? todayLogCount : null,
    streakDays: trusted ? streakDays : null,
    careIntelligenceAvailable: trusted,
  };
}

/**
 * Describes only recovery controls that can perform the action they name.
 * Loading is passive, reset needs a human review path, and newer-version data
 * needs an app update; none of those states receives a pretend generic Retry.
 */
export function deriveCareStorageRecoveryAction(
  input: CareStorageRecoveryInput,
): CareStorageRecoveryAction | null {
  if (input.storageWarning === "read-failed") {
    return { kind: "retry-read", label: "Retry saved data" };
  }
  if (input.storageWarning === "save-failed") {
    return { kind: "retry-save", label: "Retry device save" };
  }
  return null;
}

function unavailableCareStorageMetrics(
  detail: string,
): CareSyncDashboard["metrics"] {
  return [
    { label: "Care log", value: "—", detail },
    { label: "Care team", value: "—", detail },
    { label: "Waiting", value: "—", detail },
  ];
}

/**
 * Returns a dashboard override whenever the device care record is not safe to
 * describe as loaded and saved. A trusted, hydrated store returns `null` so
 * the caller can render its normal local or household-sync dashboard.
 */
export function deriveCareStorageUnavailableDashboard({
  isLoaded,
  storageWarning,
}: CareStorageAvailabilityInput): CareSyncDashboard | null {
  if (storageWarning === "read-failed") {
    return {
      status: "attention",
      title: "Saved care data unavailable",
      message:
        "WoofWatcher could not read the care record on this device. Counts are unavailable and saving is paused to protect stored data.",
      nextStep:
        "Retry reading the saved record. If this remains, export any available recovery data from Privacy & Safety before making changes.",
      actionLabel: "Retry saved data",
      metrics: unavailableCareStorageMetrics("Unavailable after the read failure"),
    };
  }

  if (storageWarning === "save-failed") {
    return {
      status: "attention",
      title: "Device save not confirmed",
      message:
        "Recent care changes are visible in this session, but device storage did not confirm that they will survive a restart.",
      nextStep:
        "Retry the device save while WoofWatcher stays open, then export a backup from Privacy & Safety before restarting or resetting this device.",
      actionLabel: "Retry device save",
      metrics: unavailableCareStorageMetrics("Save not confirmed"),
    };
  }

  if (storageWarning === "newer-version") {
    return {
      status: "attention",
      title: "Care data needs a newer version",
      message:
        "This care record was created by a newer WoofWatcher version, so this version will not overwrite it.",
      nextStep: "Update WoofWatcher before relying on or changing this care record.",
      actionLabel: "Update required",
      metrics: unavailableCareStorageMetrics("Unavailable in this version"),
    };
  }

  if (storageWarning === "reset") {
    return {
      status: "attention",
      title: "Device care data was reset",
      message:
        "WoofWatcher could not safely use the stored care record and started a clean local record. Recovery availability has not been confirmed.",
      nextStep:
        "Review the reset notice and export a backup from Privacy & Safety before adding new care history.",
      actionLabel: "Review backup options",
      metrics: unavailableCareStorageMetrics("Original counts unavailable"),
    };
  }

  if (!isLoaded) {
    return {
      status: "loading",
      title: "Checking device storage",
      message:
        "WoofWatcher is still opening the local care record. Saved status and counts are not available yet.",
      nextStep: "Wait for the care record to finish loading before relying on its status.",
      actionLabel: "Checking",
      metrics: unavailableCareStorageMetrics("Not available yet"),
    };
  }

  return null;
}

export interface CareInitialSyncDashboardInput {
  status: CareInitialSyncStatus;
  totalEntries: number;
  caregiverCount: number;
}

function initialSyncMetrics({
  totalEntries,
  caregiverCount,
  providerValue,
}: {
  totalEntries: number;
  caregiverCount: number;
  providerValue: "Checking" | "Needs retry" | "Update required";
}): CareSyncDashboard["metrics"] {
  return [
    {
      label: "Care log",
      value: `${totalEntries} ${totalEntries === 1 ? "entry" : "entries"}`,
      detail: "Available from this device",
    },
    {
      label: "Care team",
      value: `${caregiverCount} ${caregiverCount === 1 ? "member" : "members"}`,
      detail: "Available from this device",
    },
    {
      label: "Household check",
      value: providerValue,
      detail:
        providerValue === "Checking"
          ? "Provider refresh in progress"
          : providerValue === "Needs retry"
            ? "Saved device data is still available"
            : "Newer records remain preserved",
    },
  ];
}

/**
 * Describes only the first provider refresh. Local storage and local facts
 * remain available; a provider outage is reported as stale household
 * freshness with a real retry, never as failed device storage.
 */
export function deriveCareInitialSyncDashboard({
  status,
  totalEntries,
  caregiverCount,
}: CareInitialSyncDashboardInput): CareSyncDashboard | null {
  if (status.state === "settled") return null;

  if (status.state === "error") {
    if (!status.retryable) {
      return {
        status: "attention",
        title: "WoofWatcher update required",
        message: `${status.message ?? "These household records need a newer WoofWatcher version."} Existing device records remain preserved.`,
        nextStep:
          "Update WoofWatcher before using household sync with these records.",
        actionLabel: "Update required",
        metrics: initialSyncMetrics({
          totalEntries,
          caregiverCount,
          providerValue: "Update required",
        }),
      };
    }
    return {
      status: "attention",
      title: "Household refresh not confirmed",
      message: `${status.message ?? "WoofWatcher could not confirm the latest household records."} Saved device data remains available.`,
      nextStep:
        "Retry household sync when you are online. You can keep using the care record saved on this device.",
      actionLabel: "Retry household sync",
      metrics: initialSyncMetrics({
        totalEntries,
        caregiverCount,
        providerValue: "Needs retry",
      }),
    };
  }

  return {
    status: "loading",
    title: "Checking household updates",
    message:
      "Your device care record is available while WoofWatcher checks the signed-in household for newer updates.",
    nextStep:
      "You can keep using saved device data while this provider check finishes.",
    actionLabel: "Checking",
    metrics: initialSyncMetrics({
      totalEntries,
      caregiverCount,
      providerValue: "Checking",
    }),
  };
}

function isToday(iso: string, now: number): boolean {
  if (!isCareEntryObservableAt({ occurredAt: iso }, now)) return false;
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

/** Shared facts require visible, parseable, non-future evidence. */
export function isCareEntryObservableAt(
  entry: Pick<Entry, "occurredAt"> & Partial<Pick<Entry, "details">>,
  now: number = Date.now(),
): boolean {
  return isSharedCareEvidenceObservableAt(entry, now);
}

function entryDetailValue(entry: Entry, key: string): unknown {
  const details = entry.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  return (details as Record<string, unknown>)[key];
}

function isPendingMeal(entry: Entry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const completion = String(entryDetailValue(entry, "mealCompletion") ?? "");
  const lifecycle = String(entryDetailValue(entry, "mealLifecycle") ?? "");
  return lifecycle === "outcome-pending" || completion === "served" || completion === "grazing";
}

function observedMood(entry: Entry): Mood | null {
  const values = [
    entry.mood,
    entryDetailValue(entry, "mood"),
    entryDetailValue(entry, "aloneOutcome"),
    entryDetailValue(entry, "returnState"),
  ].map((value) => String(value ?? "").trim().toLowerCase());

  for (const value of values) {
    if (["unwell", "sick", "rough"].includes(value)) return "unwell";
    if (["anxious", "nervous", "distressed", "uneasy", "restless"].includes(value)) return "anxious";
    if (["excited", "eager"].includes(value)) return "excited";
    if (["happy", "great", "joyful"].includes(value)) return "happy";
    if (["calm", "good", "okay", "settled", "content"].includes(value)) return "calm";
  }
  return null;
}

function observedEnergy(entry: Entry): ObservedEnergyLevel | null {
  const value = String(entryDetailValue(entry, "energyLevel") ?? "")
    .trim()
    .toLowerCase();
  if (["low", "tired", "sleepy", "sluggish"].includes(value)) return "low";
  if (["steady", "normal"].includes(value)) return "steady";
  if (["high", "playful"].includes(value)) return "high";
  return null;
}

function observedEnergyValue(level: ObservedEnergyLevel): number {
  if (level === "low") return 35;
  if (level === "high") return 96;
  return 64;
}

export function getGreeting(now: number): { text: string; emoji: string } {
  const h = new Date(now).getHours();
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (h < 21) return { text: "Good evening", emoji: "🌅" };
  return { text: "Good night", emoji: "🌙" };
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Consecutive days (ending today, or yesterday if today is still empty) that have
 * at least one logged entry. Pure function of the logged history.
 */
export function computeCareStreak(state: CareState, now: number = Date.now()): number {
  const days = new Set<string>();
  for (const e of selectSharedCareEvidence(state.entries, now)) {
    days.add(dayKeyOf(new Date(e.occurredAt)));
  }
  const cursor = new Date(now);
  if (!days.has(dayKeyOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKeyOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 0..1 share of today's core routines (meals, walks, potty) that are done. */
export function computeDayProgress(status: PhoenixStatus): number {
  const c = status.counts;
  const parts = [
    c.meals.target ? Math.min(1, c.meals.done / c.meals.target) : 0,
    c.walks.target ? Math.min(1, c.walks.done / c.walks.target) : 0,
    c.potty.target ? Math.min(1, c.potty.done / c.potty.target) : 0,
  ];
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function derivePhoenixStatus(
  state: CareState,
  now: number = Date.now(),
): PhoenixStatus {
  const observedEntries = selectSharedCareEvidence(state.entries, now);
  const todays = observedEntries.filter((e) => isToday(e.occurredAt, now));
  const routineBoard = deriveRoutineBoard({
    routines: state.routines,
    entries: observedEntries,
    now,
  });
  const scheduledRoutines = routineBoard.items.filter(isRoutineBoardScheduledItem);
  const dayStatus = deriveCareDayStatus(observedEntries, scheduledRoutines, now);

  const countType = (types: string[]) =>
    todays.filter((e) =>
      types.includes(normalizeCareEventType(e.type, e.details)),
    ).length;

  const mealTarget = dayStatus.counts.meals.target;
  const completedMeals = todays.filter(
    (entry) =>
      normalizeCareEventType(entry.type, entry.details) === "meal" &&
      !isPendingMeal(entry),
  ).length;
  const meals: CountStat = {
    ...dayStatus.counts.meals,
    done: Math.min(completedMeals, mealTarget || completedMeals),
  };
  const walks: CountStat = dayStatus.counts.walks;
  const potty: CountStat = dayStatus.counts.potty;
  const training = dayStatus.counts.training;
  const walkMinutes = dayStatus.counts.walkMinutes;

  const healthAlert = dayStatus.healthAlert;

  const normalizedType = (entry: Entry) =>
    normalizeCareEventType(entry.type, entry.details);

  const observedMoodEntry = [...todays]
    .filter((entry) => observedMood(entry) !== null)
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )[0];
  const evidenceMood = observedMoodEntry
    ? observedMood(observedMoodEntry)
    : null;
  const observedEnergyEntry = [...todays]
    .filter((entry) => observedEnergy(entry) !== null)
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )[0];
  const explicitEnergy = observedEnergyEntry
    ? observedEnergy(observedEnergyEntry)
    : null;

  // Next upcoming routine today — earliest by clock time, independent of array order
  const nextItem = scheduledRoutines
    .filter((item) => item.minutesFromNow > 0)
    .sort((a, b) => a.minutesFromNow - b.minutesFromNow)[0] ?? null;
  const nextRoutine = nextItem
    ? state.routines.find((routine) => routine.id === nextItem.id) ?? null
    : null;
  const minutesUntilNext = nextItem?.minutesFromNow ?? null;

  let mood: Mood;
  if (evidenceMood) mood = evidenceMood;
  else mood = "calm";

  // An explicit energy observation wins. When none was logged, retain the
  // deterministic activity value for animation and activity-backed evidence.
  let energy = explicitEnergy ? observedEnergyValue(explicitEnergy) : 64;
  if (explicitEnergy === null) {
    energy += walks.done * 6;
    energy += training * 4;
    energy += countType(["play"]) * 5;
    if (mood === "excited") energy += 6;
    if (mood === "unwell") energy -= 22;
    if (mood === "anxious") energy -= 8;
    energy = Math.max(35, Math.min(96, energy));
  }

  return {
    mood,
    meta: MOOD_META[mood],
    energy,
    evidence: {
      mood: evidenceMood,
      energy: explicitEnergy,
    },
    counts: { meals, walks, potty, training, walkMinutes, healthAlert },
    nextRoutine,
    minutesUntilNext,
    routineCorrectionCount: routineBoard.correctionCount,
  };
}
