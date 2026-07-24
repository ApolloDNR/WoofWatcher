import { normalizeCareEventType } from "../../../lib/care-domain/src/index.ts";

export type EvidenceStatus = "observed" | "not-logged" | "watch";

export type EvidenceLaneId =
  | "mood"
  | "energy"
  | "appetite"
  | "hydration"
  | "stool"
  | "activity";

export interface CareEvidenceEntry {
  id?: string | null;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  amount?: string | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
}

export interface EvidenceLane {
  id: EvidenceLaneId;
  label: string;
  status: EvidenceStatus;
  value: string | null;
  detail: string;
  observedAt: string | null;
  prompt: string;
}

export interface CareEvidenceSnapshot {
  windowDays: 7;
  observedCount: number;
  totalCount: 6;
  lanes: EvidenceLane[];
}

interface LaneDefinition {
  id: EvidenceLaneId;
  label: string;
  prompt: string;
}

interface LaneObservation {
  status: Exclude<EvidenceStatus, "not-logged">;
  value: string;
  detail: string;
  observedAt: string;
}

const WINDOW_DAYS = 7 as const;
const DAY_MS = 86400000;

const LANE_DEFINITIONS: readonly LaneDefinition[] = [
  { id: "mood", label: "Mood", prompt: "Log a mood check-in" },
  { id: "energy", label: "Energy", prompt: "Log mood and energy" },
  { id: "appetite", label: "Appetite", prompt: "Log a meal outcome" },
  { id: "hydration", label: "Hydration", prompt: "Log water" },
  { id: "stool", label: "Stool", prompt: "Log a poop with stool detail" },
  { id: "activity", label: "Activity", prompt: "Log a walk" },
] as const;

const WATCH_MOODS = new Set(["anxious", "unwell", "sad", "nervous", "unsure"]);
const WATCH_ENERGY = new Set(["low", "tired", "sleepy", "sluggish"]);
const WATCH_APPETITE = new Set([
  "partial",
  "skipped",
  "refused",
  "none",
]);
const WATCH_HYDRATION = new Set(["low", "dehydrated", "dry", "reduced"]);
const WATCH_STOOL = new Set([
  "soft",
  "off",
  "loose",
  "diarrhea",
  "hard",
  "mucus",
  "blood",
  "unusual-color",
  "yellow",
  "red-black",
  "urgent",
  "straining",
]);

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().toLowerCase()
    : "";
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace(/-/g, " ")}`;
}

function detailsOf(entry: CareEvidenceEntry): Record<string, unknown> {
  return entry.details &&
    typeof entry.details === "object" &&
    !Array.isArray(entry.details)
    ? entry.details
    : {};
}

export function isHouseholdVisibleCareEntry(
  entry: CareEvidenceEntry,
): boolean {
  return detailsOf(entry).householdVisible !== false;
}

function isInWindow(
  entry: CareEvidenceEntry,
  now: number,
): entry is CareEvidenceEntry & { occurredAt: string } {
  if (!entry.occurredAt) return false;
  const occurredAt = Date.parse(entry.occurredAt);
  if (!Number.isFinite(occurredAt) || occurredAt > now) return false;
  return now - occurredAt <= WINDOW_DAYS * DAY_MS;
}

function severityNeedsReview(entry: CareEvidenceEntry): boolean {
  return ["watch", "alert", "urgent"].includes(clean(entry.severity));
}

function isPoopObservation(entry: CareEvidenceEntry): boolean {
  const rawType = clean(entry.type);
  if (rawType === "poop" || rawType === "stool") return true;
  if (normalizeCareEventType(entry.type, entry.details ?? undefined) !== "potty") {
    return false;
  }
  const details = detailsOf(entry);
  const outcome = clean(
    details.pottyOutcome ??
      details.kind ??
      details.pottyKind ??
      details.what ??
      details.outcome,
  );
  return ["poop", "both", "stool", "pee & poop"].includes(outcome);
}

function observationFor(
  laneId: EvidenceLaneId,
  entry: CareEvidenceEntry & { occurredAt: string },
): LaneObservation | null {
  const details = detailsOf(entry);
  const type = normalizeCareEventType(entry.type, entry.details ?? undefined);

  if (laneId === "mood") {
    if (type !== "mood") return null;
    const mood = clean(entry.mood ?? details.mood);
    if (!mood) return null;
    return {
      status: WATCH_MOODS.has(mood) ? "watch" : "observed",
      value: mood,
      detail: `${sentenceCase(mood)} logged`,
      observedAt: entry.occurredAt,
    };
  }

  if (laneId === "energy") {
    if (type !== "mood") return null;
    const energy = clean(details.energyLevel ?? details.energy);
    if (!energy) return null;
    return {
      status: WATCH_ENERGY.has(energy) ? "watch" : "observed",
      value: energy,
      detail: `${sentenceCase(energy)} logged`,
      observedAt: entry.occurredAt,
    };
  }

  if (laneId === "appetite") {
    if (type !== "meal") return null;
    const completion = clean(
      details.mealCompletion ??
        details.completion ??
        details.outcome,
    );
    const lifecycle = clean(details.mealLifecycle);
    const eatenAmount =
      typeof details.eatenAmount === "number" &&
      Number.isFinite(details.eatenAmount) &&
      details.eatenAmount >= 0
        ? String(details.eatenAmount)
        : clean(details.eatenAmount);
    if (
      lifecycle === "outcome-pending" ||
      completion === "served" ||
      completion === "grazing" ||
      (!completion && !eatenAmount)
    ) {
      return null;
    }
    const watch =
      WATCH_APPETITE.has(completion) ||
      (eatenAmount !== "" && Number(eatenAmount) === 0) ||
      severityNeedsReview(entry);
    const value = completion || `${eatenAmount} eaten`;
    return {
      status: watch ? "watch" : "observed",
      value,
      detail: completion
        ? `${sentenceCase(completion)} logged`
        : `${sentenceCase(eatenAmount)} eaten logged`,
      observedAt: entry.occurredAt,
    };
  }

  if (laneId === "hydration") {
    if (type !== "water") return null;
    const hydration = clean(
      details.hydration ??
        details.waterState ??
        details.bowlStatus ??
        details.amount ??
        details.waterAmount ??
        entry.amount,
    );
    return {
      status:
        WATCH_HYDRATION.has(hydration) || severityNeedsReview(entry)
          ? "watch"
          : "observed",
      value: hydration || "water",
      detail: hydration
        ? `${sentenceCase(hydration)} water logged`
        : "Water logged",
      observedAt: entry.occurredAt,
    };
  }

  if (laneId === "stool") {
    if (!isPoopObservation(entry)) return null;
    const condition = clean(details.condition ?? details.stoolCondition);
    const color = clean(details.stoolColor);
    const context = clean(details.pottyContext ?? details.context);
    const explicit = condition || color || context;
    const watch =
      WATCH_STOOL.has(condition) ||
      WATCH_STOOL.has(color) ||
      WATCH_STOOL.has(context) ||
      severityNeedsReview(entry);
    return {
      status: watch ? "watch" : "observed",
      value: explicit || "poop",
      detail: explicit
        ? `${sentenceCase(explicit)} logged`
        : "Poop logged",
      observedAt: entry.occurredAt,
    };
  }

  if (type !== "walk") return null;
  const duration =
    typeof entry.durationMinutes === "number" &&
    Number.isFinite(entry.durationMinutes) &&
    entry.durationMinutes > 0
      ? Math.round(entry.durationMinutes)
      : null;
  return {
    status: severityNeedsReview(entry) ? "watch" : "observed",
    value: duration ? String(duration) : "walk",
    detail: duration ? `${duration} min walk logged` : "Walk logged",
    observedAt: entry.occurredAt,
  };
}

export function deriveCareEvidenceSnapshot(
  entries: readonly CareEvidenceEntry[],
  now: number = Date.now(),
): CareEvidenceSnapshot {
  const eligible = entries
    .filter(isHouseholdVisibleCareEntry)
    .filter((entry) => isInWindow(entry, now))
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
    );

  const lanes = LANE_DEFINITIONS.map((definition): EvidenceLane => {
    const observation = eligible
      .map((entry) => observationFor(definition.id, entry))
      .find((candidate): candidate is LaneObservation => candidate !== null);

    return observation
      ? { ...definition, ...observation }
      : {
          ...definition,
          status: "not-logged",
          value: null,
          detail: "Not logged",
          observedAt: null,
        };
  });

  return {
    windowDays: WINDOW_DAYS,
    observedCount: lanes.filter((lane) => lane.status !== "not-logged").length,
    totalCount: LANE_DEFINITIONS.length as 6,
    lanes,
  };
}

export function selectEvidenceBackedHealthPatterns<
  T extends { kind: string },
>(patterns: readonly T[]): T[] {
  return patterns.filter((pattern) => pattern.kind !== "steady");
}
