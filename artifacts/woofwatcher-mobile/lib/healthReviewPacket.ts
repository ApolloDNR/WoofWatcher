import {
  normalizeCareEventType,
  selectSharedCareEvidence,
  type BileWatchStatus,
  type CareHealthSignal,
  type CareHealthStatus,
} from "@workspace/care-domain";

import {
  canonicalMoreRoute,
  type CanonicalMoreRoute,
} from "./canonicalRouteBuilders.ts";
import { resolveCanonicalDestination } from "./navigationOwnership.ts";
import { resolveConsumerPetName } from "./petIdentity.ts";

export type HealthMetricEvidenceTone =
  | "empty"
  | "positive"
  | "watch"
  | "review";

export interface HealthMetricEvidence {
  status: string;
  detail: string;
  tone: HealthMetricEvidenceTone;
}

export interface HealthMetricEvidenceInput {
  entries: readonly {
    type: string;
    /** ISO timestamp; metric status is derived from the newest observation. */
    occurredAt: string;
    details?: Record<string, unknown> | null;
  }[];
  now?: number;
  healthCounts: {
    vomit7: number;
    appetiteWatch7: number;
    stoolWatch7: number;
  };
  signals: readonly Pick<CareHealthSignal, "kind" | "urgency">[];
}

export interface HealthMetricEvidenceSet {
  activity: HealthMetricEvidence;
  appetite: HealthMetricEvidence;
  stool: HealthMetricEvidence;
  hydration: HealthMetricEvidence;
  energy: HealthMetricEvidence;
  vomiting: HealthMetricEvidence;
}

export interface MealLogIntervalEvidenceInput {
  entries: readonly {
    type?: unknown;
    occurredAt?: unknown;
    details?: unknown;
  }[];
  now?: number;
}

export interface MealLogIntervalEvidence {
  mealLogCount: number;
  longestIntervalHours: number | null;
  label: string;
}

const MEAL_LOG_INTERVAL_WINDOW_MS = 30 * 86_400_000;

/**
 * Describes spacing between household-visible meal logs in the last 30 days.
 * This is deliberately not treated as elapsed time without food: the app
 * knows only when meals were logged, not everything eaten between those logs.
 *
 * Privacy and time eligibility are resolved before the entry type is read so
 * rejected records cannot leak content into a shared review packet.
 */
export function deriveMealLogIntervalEvidence(
  input: MealLogIntervalEvidenceInput,
): MealLogIntervalEvidence {
  const now = Number.isFinite(input.now) ? (input.now as number) : Date.now();
  const windowStart = now - MEAL_LOG_INTERVAL_WINDOW_MS;
  const mealLogTimes = selectSharedCareEvidence(input.entries, now)
    .map((entry) => ({
      entry,
      occurredAt:
        typeof entry.occurredAt === "string"
          ? Date.parse(entry.occurredAt)
          : Number.NaN,
    }))
    .filter(
      ({ occurredAt }) =>
        Number.isFinite(occurredAt) && occurredAt >= windowStart,
    )
    .filter(
      ({ entry }) =>
        typeof entry.type === "string" &&
        normalizeCareEventType(
          entry.type,
          entry.details != null &&
            typeof entry.details === "object" &&
            !Array.isArray(entry.details)
            ? (entry.details as Record<string, unknown>)
            : undefined,
        ) === "meal",
    )
    .map(({ occurredAt }) => occurredAt)
    .sort((a, b) => a - b);

  if (mealLogTimes.length < 2) {
    return {
      mealLogCount: mealLogTimes.length,
      longestIntervalHours: null,
      label: "Needs at least two meal logs in 30 days",
    };
  }

  let longestIntervalHours = 0;
  for (let index = 1; index < mealLogTimes.length; index += 1) {
    longestIntervalHours = Math.max(
      longestIntervalHours,
      (mealLogTimes[index] - mealLogTimes[index - 1]) / 3_600_000,
    );
  }

  return {
    mealLogCount: mealLogTimes.length,
    longestIntervalHours,
    label: `${longestIntervalHours.toFixed(1)} hours`,
  };
}

function evidenceCountLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function detailValue(
  details: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = details?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase().replace(/\s+/g, " ");
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

const RECOGNIZED_STOOL_CONDITIONS = new Set([
  "normal",
  "soft",
  "off",
  "diarrhea",
  "loose",
  "hard",
  "mucus",
  "blood",
  "unusual-color",
  "not-sure",
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
const RECOGNIZED_STOOL_COLORS = new Set([
  "brown",
  "yellow",
  "red",
  "red-black",
  "red/black",
  "black",
  "black-tarry",
  "black tarry",
  "green",
  "gray",
  "grey",
  "white",
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
const POOP_OUTCOMES = new Set(["poop", "both", "stool", "pee-poop", "pee & poop"]);
const NON_STOOL_OUTCOMES = new Set([
  "pee",
  "urine",
  "pee-only",
  "attempt",
  "tried-nothing",
  "tried nothing",
  "tried, nothing",
  "nothing",
]);

function deriveStoolEntryEvidence(
  entry: HealthMetricEvidenceInput["entries"][number],
): { hasEvidence: boolean; normal: boolean; watch: boolean } {
  const condition = detailValue(entry.details, "condition", "stoolCondition");
  const color = detailValue(entry.details, "stoolColor", "color");
  const outcome = detailValue(entry.details, "pottyOutcome", "pottyResult", "kind");
  const rawType = entry.type.trim().toLowerCase();
  if (rawType === "pee" || NON_STOOL_OUTCOMES.has(outcome)) {
    return { hasEvidence: false, normal: false, watch: false };
  }
  const hasCondition = RECOGNIZED_STOOL_CONDITIONS.has(condition);
  const hasColor = RECOGNIZED_STOOL_COLORS.has(color);
  const hasPoopOutcome = POOP_OUTCOMES.has(outcome) || rawType === "poop";

  return {
    hasEvidence: hasCondition || hasColor || hasPoopOutcome,
    normal: condition === "normal",
    watch: WATCH_STOOL_CONDITIONS.has(condition) || WATCH_STOOL_COLORS.has(color),
  };
}

/**
 * Builds each Health Snapshot row from evidence for that exact lane. A meal
 * log may support Appetite, for example, but it cannot establish anything
 * about activity, stool, hydration, energy, or vomiting.
 */
export function deriveHealthMetricEvidence(
  input: HealthMetricEvidenceInput,
): HealthMetricEvidenceSet {
  const entriesByType = new Map<string, HealthMetricEvidenceInput["entries"]>();
  const orderedEntries = selectSharedCareEvidence(
    input.entries,
    input.now ?? Date.now(),
  )
    .map((entry, index) => ({ entry, index, occurredAt: Date.parse(entry.occurredAt) }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a.occurredAt) ? a.occurredAt : Number.NEGATIVE_INFINITY;
      const bTime = Number.isFinite(b.occurredAt) ? b.occurredAt : Number.NEGATIVE_INFINITY;
      return bTime - aTime || a.index - b.index;
    })
    .map(({ entry }) => entry);
  for (const entry of orderedEntries) {
    const type = normalizeCareEventType(entry.type, entry.details);
    entriesByType.set(type, [...(entriesByType.get(type) ?? []), entry]);
  }

  const walks = entriesByType.get("walk") ?? [];
  const play = entriesByType.get("play") ?? [];
  const training = entriesByType.get("training") ?? [];
  const activity = [...walks, ...play, ...training];
  const meals = entriesByType.get("meal") ?? [];
  const potty = entriesByType.get("potty") ?? [];
  const water = entriesByType.get("water") ?? [];
  const mood = entriesByType.get("mood") ?? [];
  const vomit = entriesByType.get("vomit") ?? [];
  const vomitSignal =
    input.signals.find((signal) => signal.kind === "vomit-pattern" && signal.urgency === "alert") ??
    input.signals.find((signal) => signal.kind === "vomit-pattern");
  const stoolSignal =
    input.signals.find((signal) => signal.kind === "stool-watch" && signal.urgency === "alert") ??
    input.signals.find((signal) => signal.kind === "stool-watch");

  const stoolEvidence = potty.map(deriveStoolEntryEvidence);
  const stoolEvidenceCount = stoolEvidence.filter((evidence) => evidence.hasEvidence).length;
  const hasNormalStool = stoolEvidence.some((evidence) => evidence.normal);
  const hasStoolWarning = stoolEvidence.some((evidence) => evidence.watch);
  const energyLevels = mood
    .map((entry) => detailValue(entry.details, "energyLevel"))
    .filter(Boolean);
  const latestEnergy = energyLevels[0] ?? "";
  const latestEnergyIsLow = ["low", "tired", "sleepy", "sluggish"].includes(latestEnergy);
  const latestEnergyIsPositive = ["steady", "normal", "high", "playful"].includes(latestEnergy);

  return {
    activity: activity.length
      ? {
          status: "Logged",
          detail: evidenceCountLabel(activity.length, "activity log"),
          tone: "positive",
        }
      : { status: "No data", detail: "No activity logs", tone: "empty" },
    appetite: input.healthCounts.appetiteWatch7
      ? {
          status: "Watch",
          detail: `${input.healthCounts.appetiteWatch7} reduced meal${input.healthCounts.appetiteWatch7 === 1 ? "" : "s"}`,
          tone: "watch",
        }
      : meals.length
        ? {
            status: "Logged",
            detail: evidenceCountLabel(meals.length, "meal log"),
            tone: "positive",
          }
        : { status: "No data", detail: "No meal logs", tone: "empty" },
    stool: stoolSignal?.urgency === "alert"
      ? {
          status: "Review",
          detail: input.healthCounts.stoolWatch7
            ? `${evidenceCountLabel(input.healthCounts.stoolWatch7, "review log")} needs prompt review`
            : "Stool alert logged",
          tone: "review",
        }
      : input.healthCounts.stoolWatch7 || hasStoolWarning || stoolSignal
      ? {
          status: "Watch",
          detail: input.healthCounts.stoolWatch7
            ? `${input.healthCounts.stoolWatch7} review log${input.healthCounts.stoolWatch7 === 1 ? "" : "s"}`
            : hasStoolWarning
              ? `${evidenceCountLabel(stoolEvidenceCount, "stool log")} needs review`
              : "Stool pattern logged",
          tone: "watch",
        }
      : hasNormalStool
        ? { status: "Normal", detail: "Normal stool logged", tone: "positive" }
        : stoolEvidenceCount
          ? {
              status: "Logged",
              detail: evidenceCountLabel(stoolEvidenceCount, "stool log"),
              tone: "positive",
            }
          : { status: "No data", detail: "No stool logs", tone: "empty" },
    hydration: water.length
      ? {
          status: "Logged",
          detail: evidenceCountLabel(water.length, "water log"),
          tone: "positive",
        }
      : { status: "No data", detail: "No water logs", tone: "empty" },
    energy: latestEnergyIsLow
      ? { status: "Watch", detail: "Low energy logged", tone: "watch" }
      : latestEnergyIsPositive
        ? {
            status: latestEnergy === "high" || latestEnergy === "playful" ? "High" : "Steady",
            detail: latestEnergy === "high" || latestEnergy === "playful"
              ? "High energy logged"
              : "Steady energy logged",
            tone: "positive",
          }
        : energyLevels.length
          ? {
              status: "Logged",
              detail: evidenceCountLabel(energyLevels.length, "energy log"),
              tone: "positive",
            }
          : { status: "No data", detail: "No energy logs", tone: "empty" },
    vomiting: vomitSignal?.urgency === "alert"
      ? { status: "Review", detail: "Vomiting log needs review", tone: "review" }
      : input.healthCounts.vomit7 > 0
        ? {
            status: "Watch",
            detail: `${input.healthCounts.vomit7} in 7 days`,
            tone: "watch",
          }
        : vomitSignal
          ? { status: "Watch", detail: "Vomiting pattern logged", tone: "watch" }
          : vomit.length
            ? {
                status: "Watch",
                detail: evidenceCountLabel(vomit.length, "vomit log"),
                tone: "watch",
              }
            : { status: "No data", detail: "No vomit logs", tone: "empty" },
  };
}

export type HealthReviewPacketRoute =
  | `/log?type=${string}&detail=1&intent=${string}`
  | CanonicalMoreRoute
  | "/health?section=records";

export interface HealthReviewPacketAction {
  label: string;
  route: HealthReviewPacketRoute;
  params?: Record<string, string>;
}

export type HealthReviewPacketActionHref =
  | HealthReviewPacketRoute
  | Readonly<{
      pathname: "/more";
      params: Readonly<Record<string, string>>;
    }>;

export interface HealthReviewPacketInput {
  dogName: string;
  healthStatus: CareHealthStatus;
  healthSummary: string;
  healthCounts: {
    vomit30: number;
    appetiteWatch7: number;
    stoolWatch7: number;
    anxiety7: number;
  };
  redFlagCount: number;
  bileStatus: BileWatchStatus;
  lastYellowBileLabel: string;
  longestMealLogIntervalLabel: string;
  bedtimeSnackPlanLabel: string;
}

export interface HealthReviewPacket {
  title: string;
  statusLabel:
    | "More data needed"
    | "Worth watching"
    | "Consider sharing with your vet";
  languagePill: "Not veterinary advice" | "Pattern noticed" | "Review";
  summary: string;
  prompts: string[];
  vetShareChecklist: string[];
  boundary: string;
  primaryAction: HealthReviewPacketAction;
  secondaryAction: HealthReviewPacketAction;
}

export interface HealthReviewPacketShareOptions {
  dogName: string;
  generatedAtIso?: string;
}

function hasMeasuredMealLogInterval(value: string): boolean {
  const match = value.trim().match(/^(\d+(?:\.\d+)?) hours?$/i);
  return match != null && Number.isFinite(Number(match[1]));
}

function statusLabelFor(input: HealthReviewPacketInput): HealthReviewPacket["statusLabel"] {
  if (
    input.healthStatus === "alert" ||
    input.bileStatus === "Review" ||
    input.redFlagCount > 0
  ) {
    return "Consider sharing with your vet";
  }
  if (input.healthStatus === "watch" || input.bileStatus === "Watch") {
    return "Worth watching";
  }
  return "More data needed";
}

function languagePillFor(input: HealthReviewPacketInput): HealthReviewPacket["languagePill"] {
  if (input.healthStatus === "alert" || input.bileStatus === "Review" || input.redFlagCount > 0) {
    return "Review";
  }
  if (input.healthStatus === "watch" || input.bileStatus === "Watch") return "Pattern noticed";
  return "Not veterinary advice";
}

function buildSummary(input: HealthReviewPacketInput, languagePill: HealthReviewPacket["languagePill"]): string {
  if (input.healthStatus === "good" && input.bileStatus === "No data") {
    return `${input.dogName}'s Health Review Packet needs more owner observations logged before it can describe bile or vomiting patterns.`;
  }
  const mealLogInterval = hasMeasuredMealLogInterval(
    input.longestMealLogIntervalLabel,
  )
    ? ` Longest interval between meal logs: ${input.longestMealLogIntervalLabel}.`
    : "";
  return `${languagePill}: ${input.healthSummary}${mealLogInterval} Keep the packet factual so a caregiver or vet can review the same context.`;
}

function buildPrompts(input: HealthReviewPacketInput): string[] {
  const prompts =
    input.healthStatus === "good" && input.bileStatus === "No data"
      ? [
          "Log bile or vomiting observations to build the 30-day evidence window.",
          "Keep logging meals, stool, energy, hydration, and medication context.",
          "Add a note if appetite, energy, stool, or behavior changes.",
        ]
      : [
          "Capture timing, time since the last logged meal, appetite after, energy after, stool detail, and hydration.",
          "Add a photo only when it helps the household or vet understand the observation.",
          `Keep notes factual: what happened, when, what ${input.dogName} ate, and how ${input.dogName} acted after.`,
        ];

  if (input.healthStatus === "alert" || input.redFlagCount > 0) {
    return [...prompts, "If urgent red flags appear, contact a veterinarian or emergency clinic promptly."];
  }

  return prompts;
}

function buildChecklist(input: HealthReviewPacketInput): string[] {
  const checklist = [
    "Recent meals, portions, and appetite notes",
    `Last yellow bile event: ${input.lastYellowBileLabel}`,
    `Longest interval between meal logs: ${input.longestMealLogIntervalLabel}`,
    `Bedtime snack plan: ${input.bedtimeSnackPlanLabel}`,
    `Vomiting logs in 30 days: ${input.healthCounts.vomit30}`,
    `Appetite watch logs: ${input.healthCounts.appetiteWatch7}`,
    `Stool watch logs: ${input.healthCounts.stoolWatch7}`,
    `Anxiety or alone-time signals: ${input.healthCounts.anxiety7}`,
  ];

  if (input.redFlagCount > 0) {
    checklist.push(`Red-flag logs to review: ${input.redFlagCount}`);
  }

  return checklist;
}

export function deriveHealthReviewPacket(input: HealthReviewPacketInput): HealthReviewPacket {
  const resolvedInput = {
    ...input,
    dogName: resolveConsumerPetName(input.dogName),
  };
  const languagePill = languagePillFor(resolvedInput);
  const vetShareLanguage =
    resolvedInput.healthStatus === "alert" ||
    resolvedInput.bileStatus === "Review" ||
    resolvedInput.redFlagCount > 0
      ? "Consider sharing with your vet, and contact a veterinary professional promptly for urgent concerns."
      : resolvedInput.healthStatus === "watch" || resolvedInput.bileStatus === "Watch"
        ? "Consider sharing with your vet if the pattern repeats, worsens, or appears with other concerning signs."
        : "Keep this as owner-entered context while more observations are logged.";

  return {
    title: "Review packet",
    statusLabel: statusLabelFor(resolvedInput),
    languagePill,
    summary: buildSummary(resolvedInput, languagePill),
    prompts: buildPrompts(resolvedInput),
    vetShareChecklist: buildChecklist(resolvedInput),
    boundary: `${vetShareLanguage} Not veterinary advice.`,
    primaryAction: {
      label: "Log health detail",
      route: "/log?type=symptom&detail=1&intent=health-review",
    },
    secondaryAction: {
      label: "Draft vet questions",
      route: canonicalMoreRoute("woofguide"),
      params: { prompt: "health-review" },
    },
  };
}

export function resolveHealthReviewPacketActionHref(
  action: HealthReviewPacketAction,
): HealthReviewPacketActionHref {
  if (action.route !== canonicalMoreRoute("woofguide")) return action.route;

  const promptValue: unknown =
    action.params && Object.prototype.hasOwnProperty.call(action.params, "prompt")
      ? action.params.prompt
      : undefined;
  const destination = resolveCanonicalDestination({
    pathname: "/more",
    params: {
      section: "woofguide",
      ...(typeof promptValue === "string" ? { prompt: promptValue } : {}),
    },
  });
  return {
    pathname: "/more",
    params: destination.params ?? { section: "woofguide" },
  };
}

function formatShareList(items: readonly string[], fallback: string): string[] {
  if (!items.length) return [`- ${fallback}`];
  return items.map((item) => `- ${item}`);
}

export function buildHealthReviewPacketShareText(
  packet: HealthReviewPacket,
  options: HealthReviewPacketShareOptions,
): string {
  const generatedAtIso = options.generatedAtIso ?? new Date().toISOString();
  const dogName = resolveConsumerPetName(options.dogName);

  return [
    "WoofWatcher Health Review Packet",
    `Generated: ${generatedAtIso}`,
    `Dog: ${dogName}`,
    `Status: ${packet.statusLabel}`,
    `Language: ${packet.languagePill}`,
    "",
    "Summary",
    packet.summary,
    "",
    "Suggested prompts",
    ...formatShareList(packet.prompts, "Keep logging care observations before sharing."),
    "",
    "Vet-share checklist",
    ...formatShareList(packet.vetShareChecklist, "No checklist items available yet."),
    "",
    "Boundary",
    packet.boundary,
    "This packet organizes owner observations only. It is not veterinary advice. Contact a veterinarian for medical concerns.",
  ].join("\n");
}
