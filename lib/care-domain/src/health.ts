import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { resolvePetName } from "./pet-identity.ts";
import { selectSharedCareEvidence } from "./shared-evidence.ts";
import {
  isOwnerMarkedUrgentHealthEntry,
  isStructuredAnxietyEvidence,
  type CareStatusRoutine,
} from "./status.ts";

export type CareHealthStatus = "good" | "watch" | "alert";

export type CareHealthSignalKind =
  | "vomit-pattern"
  | "appetite-watch"
  | "stool-watch"
  | "anxiety-watch";

export type CareHealthPatternKind =
  | CareHealthSignalKind
  | "red-flag"
  | "steady";

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
  /** Display name for owner-facing copy; resolved to the current name or neutral fresh-install fallback. */
  petName?: string | null;
}

export const BILE_VOMIT_EVIDENCE_WINDOW_DAYS = 30;

export interface CareBileVomitEvidence30<
  TEntry extends CareHealthEntry = CareHealthEntry,
> {
  readonly windowDays: typeof BILE_VOMIT_EVIDENCE_WINDOW_DAYS;
  readonly startMs: number;
  readonly endMs: number;
  /** All arrays are ordered by occurredAt from newest to oldest. */
  readonly vomitEntriesNewestFirst: readonly TEntry[];
  readonly yellowBileEntriesNewestFirst: readonly TEntry[];
  readonly urgentVomitEntriesNewestFirst: readonly TEntry[];
}

export type BileWatchStatus = "No data" | "Watch" | "Review";

/** One status policy for every Bile Watch consumer. */
export function deriveBileWatchStatus(
  evidence: Pick<
    CareBileVomitEvidence30,
    "vomitEntriesNewestFirst" | "urgentVomitEntriesNewestFirst"
  >,
): BileWatchStatus {
  if (evidence.urgentVomitEntriesNewestFirst.length > 0) return "Review";
  if (evidence.vomitEntriesNewestFirst.length > 0) return "Watch";
  return "No data";
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

export interface CareHealthPattern {
  kind: CareHealthPatternKind;
  label: string;
  status: CareHealthStatus;
  window: string;
  evidence: string;
  nextStep: string;
  entryIds: string[];
}

export interface CareHealthWatch {
  status: CareHealthStatus;
  summary: string;
  signals: CareHealthSignal[];
  patterns: CareHealthPattern[];
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
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, " ")
    : "";
}

function countPhrase(count: number, singular: string, multiple = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : multiple}`;
}

const EXPLICIT_BILE_VALUES = new Set([
  "bile",
  "yellow bile",
  "yellow-bile",
  "bilious",
]);

function hasNegatedBileMention(value: string): boolean {
  return (
    /\b(?:no|not|without)\s+(?:(?:signs?|evidence)\s+of\s+)?(?:any\s+)?(?:(?:yellow\s+)?bile|yellow\s+(?:fluid|vomit|throw[ -]?up))\b/.test(value) ||
    /\b(?:denied?|denies|negative\s+for)\s+(?:any\s+)?(?:(?:yellow\s+)?bile|yellow\s+(?:fluid|vomit|throw[ -]?up))\b/.test(value) ||
    /\b(?:did\s+not|never)\s+(?:see|observe|notice|note)\s+(?:any\s+)?(?:(?:yellow\s+)?bile|yellow\s+(?:fluid|vomit|throw[ -]?up))\b/.test(value) ||
    /\b(?:(?:yellow\s+)?bile|yellow\s+(?:fluid|vomit|throw[ -]?up))\s+(?:was\s+|is\s+)?(?:not|never)\s+(?:seen|observed|present|noted)\b/.test(value) ||
    /\b(?:(?:yellow\s+)?bile|yellow\s+(?:fluid|vomit|throw[ -]?up))\s+(?:was\s+|is\s+)?(?:absent|ruled\s+out|excluded)\b/.test(value)
  );
}

function hasAffirmedBileMention(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;

  // Negation belongs to its own sentence/local clause. Treating the whole
  // note as one scope hid a real later observation such as "No bile at
  // breakfast. Yellow bile observed after lunch."
  const clauses = normalized.split(
    /(?:[.!?;\n]+|,\s*(?=(?:but|however|then|later|afterward|subsequently)\b)|\s+(?:but|however|then|later|afterward|subsequently)\s+)/,
  );
  return clauses.some((clause) => {
    const mentionsBile =
      /\bbile\b/.test(clause) ||
      /\byellow\s+(?:fluid|vomit|throw[ -]?up)\b/.test(clause);
    return mentionsBile && !hasNegatedBileMention(clause);
  });
}

function isYellowBile(entry: CareHealthEntry): boolean {
  const what = detailString(entry, "what");
  const kind = detailString(entry, "kind");
  const appearance = detailString(entry, "appearance");
  const color = detailString(entry, "color") || detailString(entry, "vomitColor");
  if (
    EXPLICIT_BILE_VALUES.has(what) ||
    EXPLICIT_BILE_VALUES.has(kind) ||
    EXPLICIT_BILE_VALUES.has(appearance) ||
    (color === "yellow" &&
      normalizeCareEventType(entry.type, entry.details) === "vomit")
  ) {
    return true;
  }
  return hasAffirmedBileMention(
    [entry.title, entry.note]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(". "),
  );
}

function isReducedMeal(entry: CareHealthEntry): boolean {
  if (normalizeCareEventType(entry.type, entry.details) !== "meal") return false;
  const portion = detailString(entry, "portion");
  const completion = detailString(entry, "mealCompletion");
  if (completion) return ["partial", "skipped"].includes(completion);
  return ["half", "light", "small", "snack", "skipped"].includes(portion);
}

const NON_STOOL_POTTY_OUTCOMES = new Set([
  "pee",
  "urine",
  "pee-only",
  "attempt",
  "tried-nothing",
  "tried nothing",
  "tried, nothing",
  "nothing",
]);
const WATCH_STOOL_CONDITIONS = new Set([
  "soft",
  "off",
  "diarrhea",
  "loose",
  "hard",
  "mucus",
  "blood",
  "unusual-color",
]);
const RECOGNIZED_STOOL_CONDITIONS = new Set([
  "normal",
  "not-sure",
  ...WATCH_STOOL_CONDITIONS,
]);
const WATCH_STOOL_COLORS = new Set([
  "yellow",
  "red",
  "red-black",
  "red/black",
  "black",
  "black-tarry",
  "black tarry",
  "gray",
  "grey",
  "white",
]);
const RECOGNIZED_STOOL_COLORS = new Set([
  "brown",
  "green",
  ...WATCH_STOOL_COLORS,
]);
const STOOL_POTTY_OUTCOMES = new Set([
  "poop",
  "both",
  "stool",
  "pee-poop",
  "pee & poop",
]);

function pottyOutcome(entry: CareHealthEntry): string {
  for (const key of ["pottyOutcome", "pottyResult", "kind"]) {
    const value = detailString(entry, key);
    if (value) return value;
  }
  return "";
}

function isStoolWatch(entry: CareHealthEntry): boolean {
  const rawType = entry.type.trim().toLowerCase();
  const type = normalizeCareEventType(entry.type, entry.details);
  const outcome = pottyOutcome(entry);
  if (rawType === "pee" || NON_STOOL_POTTY_OUTCOMES.has(outcome)) {
    return false;
  }
  const condition =
    detailString(entry, "condition") || detailString(entry, "stoolCondition");
  const stoolColor = detailString(entry, "stoolColor") || detailString(entry, "color");
  const what = detailString(entry, "what");
  const kind = detailString(entry, "kind");
  const structuredStoolFinding = [what, kind].some((value) =>
    ["diarrhea", "soft stool", "loose stool"].includes(value),
  );
  if (type === "symptom") return structuredStoolFinding;
  if (type !== "potty") return false;
  const hasStructuredStoolEvidence =
    rawType === "poop" ||
    STOOL_POTTY_OUTCOMES.has(outcome) ||
    RECOGNIZED_STOOL_CONDITIONS.has(condition) ||
    RECOGNIZED_STOOL_COLORS.has(stoolColor) ||
    structuredStoolFinding;
  return (
    (hasStructuredStoolEvidence && isHealthUrgent(entry)) ||
    WATCH_STOOL_CONDITIONS.has(condition) ||
    WATCH_STOOL_COLORS.has(stoolColor) ||
    structuredStoolFinding
  );
}

function isHealthUrgent(entry: CareHealthEntry): boolean {
  return ["alert", "urgent"].includes((entry.severity ?? "").trim().toLowerCase());
}

/**
 * Selects the canonical rolling 30-day evidence used by Bile Watch. Invalid
 * and future timestamps are excluded, the lower boundary is inclusive, and
 * every returned lane is newest-first regardless of caller ordering.
 */
export function deriveBileVomitEvidence30<TEntry extends CareHealthEntry>({
  entries,
  now = Date.now(),
}: {
  entries: readonly TEntry[];
  now?: number;
}): CareBileVomitEvidence30<TEntry> {
  const startMs = now - BILE_VOMIT_EVIDENCE_WINDOW_DAYS * 86_400_000;
  const vomitEntriesNewestFirst = selectSharedCareEvidence(entries, now)
    .filter((entry) => {
      const occurredAt = Date.parse(entry.occurredAt);
      return (
        Number.isFinite(occurredAt) &&
        occurredAt >= startMs &&
        occurredAt <= now &&
        normalizeCareEventType(entry.type, entry.details) === "vomit"
      );
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  return {
    windowDays: BILE_VOMIT_EVIDENCE_WINDOW_DAYS,
    startMs,
    endMs: now,
    vomitEntriesNewestFirst,
    yellowBileEntriesNewestFirst: vomitEntriesNewestFirst.filter(isYellowBile),
    urgentVomitEntriesNewestFirst: vomitEntriesNewestFirst.filter(isHealthUrgent),
  };
}

function patternNextStep(signal: CareHealthSignal, petName: string): string {
  if (signal.kind === "vomit-pattern") {
    return "Track timing, color, meals, energy, and hydration. Contact a vet promptly if vomiting repeats, blood appears, belly pain, lethargy, dehydration, or appetite loss show up.";
  }
  if (signal.kind === "appetite-watch") {
    return "Compare meal notes, portion served, amount eaten, treats, anxiety context, and energy. Share the pattern with a vet if skipped or partial meals continue.";
  }
  if (signal.kind === "stool-watch") {
    return `Log stool detail, hydration, food changes, and energy. Contact a vet if diarrhea repeats, blood appears, or ${petName} seems painful, weak, or dehydrated.`;
  }
  return "Capture alone-time length, triggers, recovery time, exercise, and calming supports so the household can adjust the routine together.";
}

function patternForSignal(signal: CareHealthSignal, petName: string): CareHealthPattern {
  return {
    kind: signal.kind,
    label: signal.label,
    status: signal.urgency,
    window: signal.kind === "vomit-pattern" ? "7-30 day pattern" : "7 day pattern",
    evidence: signal.detail,
    nextStep: patternNextStep(signal, petName),
    entryIds: signal.entryIds,
  };
}

function noActiveSignalPattern(): CareHealthPattern {
  return {
    kind: "steady",
    label: "No active Health Watch signals",
    status: "good",
    window: "7 day pattern",
    evidence: "No Health Watch signals are active in the selected window.",
    nextStep: "Keep logging meals, stool, vomit, mood, energy, and medication so future changes are easier to review.",
    entryIds: [],
  };
}

function redFlagPattern(
  redFlags: readonly CareHealthRedFlag[],
): CareHealthPattern {
  const count = redFlags.length;
  return {
    kind: "red-flag",
    label: count === 1 ? redFlags[0]?.label ?? "Health alert logged" : "Health alerts logged",
    status: "alert",
    window: "30 day alert review",
    evidence: `${countPhrase(count, "owner-marked urgent health log")} in the selected window.`,
    nextStep:
      "Review the owner-entered observation and contact a veterinarian or emergency clinic promptly when urgent signs are present.",
    entryIds: redFlags.flatMap((flag) => (flag.entryId ? [flag.entryId] : [])),
  };
}

export function deriveHealthWatch(input: CareHealthInput): CareHealthWatch {
  const now = input.now ?? Date.now();
  const entries = selectSharedCareEvidence(input.entries ?? [], now);
  const petName = resolvePetName(input.petName);
  const recent7 = entries.filter((entry) => withinDays(entry, 7, now));
  const recent30 = entries.filter((entry) => withinDays(entry, 30, now));
  const bileVomitEvidence30 = deriveBileVomitEvidence30({ entries, now });

  const vomit7 = recent7.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "vomit",
  );
  const vomit30 = bileVomitEvidence30.vomitEntriesNewestFirst;
  const yellowBile = bileVomitEvidence30.yellowBileEntriesNewestFirst;
  const urgentVomit = bileVomitEvidence30.urgentVomitEntriesNewestFirst;
  const reducedMeals = recent7.filter(isReducedMeal);
  const stoolWatch = recent7.filter(isStoolWatch);
  const anxietyWatch = recent7.filter(isStructuredAnxietyEvidence);
  const medication7 = recent7.filter(
    (entry) => normalizeCareEventType(entry.type, entry.details) === "medication",
  );

  const redFlags = recent30.filter(isOwnerMarkedUrgentHealthEntry).map((entry) => ({
    label: entry.title ?? "Health alert",
    detail: entry.note ?? `${entry.type} marked ${entry.severity}`,
    entryId: entry.id ?? null,
  }));

  const signals: CareHealthSignal[] = [];

  if (
    vomit7.length >= 2 ||
    yellowBile.length > 0 ||
    urgentVomit.length > 0
  ) {
    const vomitDetail =
      vomit7.length > 0
        ? `${countPhrase(vomit7.length, "vomit incident")} in 7 days`
        : yellowBile.length > 0
          ? `${countPhrase(yellowBile.length, "yellow bile note")} in 30 days`
          : `${countPhrase(urgentVomit.length, "urgent vomit log")} in 30 days`;
    const vomitEvidence = [
      ...new Set(
        [...vomit7, ...yellowBile, ...urgentVomit].map(entryId),
      ),
    ];
    signals.push({
      kind: "vomit-pattern",
      label: "Vomit pattern",
      detail:
        yellowBile.length > 0
          ? `${vomitDetail}, with yellow bile noted.`
          : `${vomitDetail}.`,
      urgency: urgentVomit.length > 0 ? "alert" : "watch",
      entryIds: vomitEvidence,
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
  const patterns = [
    ...(redFlags.length > 0 ? [redFlagPattern(redFlags)] : []),
    ...signals.map((signal) => patternForSignal(signal, petName)),
  ];
  if (patterns.length === 0) patterns.push(noActiveSignalPattern());

  return {
    status,
    summary,
    signals,
    patterns,
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
