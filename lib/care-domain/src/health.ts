import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { deriveCareDayStatus, type CareStatusRoutine } from "./status.ts";

export type CareHealthStatus = "good" | "watch" | "alert";

export type CareHealthSignalKind =
  | "vomit-pattern"
  | "appetite-watch"
  | "stool-watch"
  | "anxiety-watch";

export interface CareHealthEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  amount?: string | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface CareHealthInput {
  entries: readonly CareHealthEntry[];
  routines?: readonly CareStatusRoutine[];
  now?: number;
}

export interface CareHealthSignal {
  kind: CareHealthSignalKind;
  label: string;
  detail: string;
  urgency: CareHealthStatus;
  entryIds: string[];
}

export interface CareHealthRedFlag {
  label: string;
  detail: string;
  entryId: string | null;
}

export interface CareHealthWatch {
  status: CareHealthStatus;
  summary: string;
  signals: CareHealthSignal[];
  redFlags: CareHealthRedFlag[];
  counts: {
    vomit7: number;
    vomit30: number;
    appetiteWatch7: number;
    stoolWatch7: number;
    anxiety7: number;
    medication7: number;
  };
  vetBoundary: string;
}

const VET_BOUNDARY =
  "WoofWatcher tracks patterns for caregiver and veterinarian review; it does not diagnose or replace veterinary care.";

function daysBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 86400000;
}

function withinDays(entry: CareHealthEntry, days: number, now: number): boolean {
  const age = daysBetween(entry.occurredAt, now);
  return age >= 0 && age <= days;
}

function entryId(entry: CareHealthEntry): string {
  return entry.id ?? `${entry.type}_${entry.occurredAt}`;
}

function detailString(entry: CareHealthEntry, key: string): string {
  const value = entry.details?.[key];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function entryText(entry: CareHealthEntry): string {
  const detailValues = entry.details
    ? Object.values(entry.details)
        .filter((value): value is string => typeof value === "string")
        .join(" ")
    : "";
  return `${entry.title ?? ""} ${entry.note ?? ""} ${detailValues}`.toLowerCase();
}

function countPhrase(count: number, singular: string, multiple = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : multiple}`;
}

function isYellowBile(entry: CareHealthEntry): boolean {
  const text = entryText(entry);
  return text.includes("bile") || (text.includes("yellow") && text.includes("vomit"));
}

function isReducedMeal(entry: CareHealthEntry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const portion = detailString(entry, "portion");
  const text = entryText(entry);
  return (
    ["half", "light", "small", "snack", "skipped"].includes(portion) ||
    text.includes("half") ||
    text.includes("light") ||
    text.includes("left some") ||
    text.includes("skipped")
  );
}

function isStoolWatch(entry: CareHealthEntry): boolean {
  const type = normalizeCareEventType(entry.type, entry.details);
  const condition = detailString(entry, "condition");
  const what = detailString(entry, "what");
  const text = entryText(entry);
  return (
    (type === "potty" &&
      ["soft", "off", "diarrhea", "loose"].includes(condition)) ||
    what === "diarrhea" ||
    text.includes("diarrhea") ||
    text.includes("soft stool") ||
    text.includes("loose stool")
  );
}

function isAnxietyWatch(entry: CareHealthEntry): boolean {
  const type = normalizeCareEventType(entry.type, entry.details);
  const mood = (entry.mood ?? "").toLowerCase();
  const text = entryText(entry);
  return (
    type === "alone" ||
    mood.includes("anx") ||
    mood.includes("nerv") ||
    mood.includes("unsure") ||
    text.includes("anxious") ||
    text.includes("nervous")
  );
}

function isHealthUrgent(entry: CareHealthEntry): boolean {
  return ["alert", "urgent"].includes((entry.severity ?? "").toLowerCase());
}

export function deriveHealthWatch(input: CareHealthInput): CareHealthWatch {
  const now = input.now ?? Date.now();
  const entries = input.entries ?? [];
  const recent7 = entries.filter((entry) => withinDays(entry, 7, now));
  const recent30 = entries.filter((entry) => withinDays(entry, 30, now));
  const dayStatus = deriveCareDayStatus(entries, input.routines ?? [], now);

  const vomit7 = recent7.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "vomit",
  );
  const vomit30 = recent30.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "vomit",
  );
  const yellowBile = vomit30.filter(isYellowBile);
  const reducedMeals = recent7.filter(isReducedMeal);
  const stoolWatch = recent7.filter(isStoolWatch);
  const anxietyWatch = recent7.filter(isAnxietyWatch);
  const medication7 = recent7.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "medication",
  );

  const redFlags = recent30.filter(isHealthUrgent).map((entry) => ({
    label: entry.title ?? "Health alert",
    detail: entry.note ?? `${entry.type} marked ${entry.severity}`,
    entryId: entry.id ?? null,
  }));

  const signals: CareHealthSignal[] = [];

  if (vomit7.length >= 2 || yellowBile.length > 0 || dayStatus.healthAlert) {
    const vomitDetail =
      vomit7.length > 0
        ? `${countPhrase(vomit7.length, "vomit incident")} in 7 days`
        : `${countPhrase(yellowBile.length, "yellow bile note")} in 30 days`;
    signals.push({
      kind: "vomit-pattern",
      label: "Vomit pattern",
      detail:
        yellowBile.length > 0
          ? `${vomitDetail}, with yellow bile noted.`
          : `${vomitDetail}.`,
      urgency: redFlags.length > 0 ? "alert" : "watch",
      entryIds: vomit7.map(entryId),
    });
  }

  if (reducedMeals.length >= 2) {
    signals.push({
      kind: "appetite-watch",
      label: "Appetite watch",
      detail: `${countPhrase(reducedMeals.length, "reduced meal log")} in 7 days.`,
      urgency: "watch",
      entryIds: reducedMeals.map(entryId),
    });
  }

  if (stoolWatch.length > 0) {
    const stoolPhrase = countPhrase(stoolWatch.length, "stool or potty log");
    signals.push({
      kind: "stool-watch",
      label: "Stool watch",
      detail: `${stoolPhrase} ${stoolWatch.length === 1 ? "needs" : "need"} review.`,
      urgency: stoolWatch.some(isHealthUrgent) ? "alert" : "watch",
      entryIds: stoolWatch.map(entryId),
    });
  }

  if (anxietyWatch.length >= 2) {
    signals.push({
      kind: "anxiety-watch",
      label: "Anxiety watch",
      detail: `${countPhrase(anxietyWatch.length, "anxiety or alone-time signal")} in 7 days.`,
      urgency: "watch",
      entryIds: anxietyWatch.map(entryId),
    });
  }

  const status: CareHealthStatus =
    redFlags.length > 0 || signals.some((signal) => signal.urgency === "alert")
      ? "alert"
      : signals.length > 0
        ? "watch"
        : "good";

  const summary =
    status === "alert"
      ? "A health alert needs caregiver review."
      : signals.length > 0
        ? signals[0].detail
        : "No health watch signals logged in the selected window.";

  return {
    status,
    summary,
    signals,
    redFlags,
    counts: {
      vomit7: vomit7.length,
      vomit30: vomit30.length,
      appetiteWatch7: reducedMeals.length,
      stoolWatch7: stoolWatch.length,
      anxiety7: anxietyWatch.length,
      medication7: medication7.length,
    },
    vetBoundary: VET_BOUNDARY,
  };
}
