import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { resolvePetName } from "./pet-identity.ts";

export type WeightTrendStatus = "needs-baseline" | "needs-log" | "tracking" | "steady";
export type WeightTrendDirection = "baseline" | "gain" | "reduce" | "hold";

export interface WeightTrendProfile {
  weight?: {
    current?: number | string | null;
    goal?: string | number | null;
    unit?: string | null;
  } | null;
}

export interface WeightTrendGoal {
  category?: string | null;
  target?: string | null;
  status?: string | null;
}

export interface WeightTrendEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  amount?: string | number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface WeightTrendInput {
  entries: readonly WeightTrendEntry[];
  profile?: WeightTrendProfile | null;
  goals?: readonly WeightTrendGoal[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
  /** Display name for owner-facing copy; resolved to the current name or neutral fresh-install fallback. */
  petName?: string | null;
}

export interface WeightTrendItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  weight: number;
  unit: string;
  note: string;
}

export interface WeightTrend {
  items: WeightTrendItem[];
  totalWeighIns: number;
  currentWeight: number;
  goalWeight: number;
  unit: string;
  changeFromPrevious: number;
  remainingToGoal: number;
  direction: WeightTrendDirection;
  status: WeightTrendStatus;
  summary: string;
  nextStep: string;
  latest: WeightTrendItem | null;
  previous: WeightTrendItem | null;
  caregivers: string[];
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: CareEventDetails): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return 0;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function isVisible(entry: WeightTrendEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function isWeight(entry: WeightTrendEntry): boolean {
  return normalizeCareEventType(entry.type, entry.details) === "weight";
}

function deriveGoalWeight(input: Pick<WeightTrendInput, "goals" | "profile">): number {
  const goal = (input.goals ?? []).find(
    (item) => clean(item.category).toLowerCase() === "weight" && clean(item.status).toLowerCase() !== "done",
  );
  return roundTenth(parseNumber(goal?.target) || parseNumber(input.profile?.weight?.goal));
}

function directionFor(currentWeight: number, goal: number): WeightTrendDirection {
  if (currentWeight <= 0) return "baseline";
  if (goal <= 0) return "hold";
  const delta = roundTenth(goal - currentWeight);
  if (Math.abs(delta) <= 0.2) return "hold";
  return delta > 0 ? "gain" : "reduce";
}

function statusFor(currentWeight: number, totalWeighIns: number, direction: WeightTrendDirection): WeightTrendStatus {
  if (currentWeight <= 0) return "needs-baseline";
  if (totalWeighIns === 0) return "needs-log";
  if (direction === "hold") return "steady";
  return "tracking";
}

function countLabel(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function signedWeight(value: number, unit: string): string {
  if (value === 0) return `0 ${unit}`;
  return `${value > 0 ? "+" : ""}${roundTenth(value)} ${unit}`;
}

function summaryFor(
  status: WeightTrendStatus,
  totalWeighIns: number,
  currentWeight: number,
  unit: string,
  goal: number,
  remaining: number,
  change: number,
  lookbackDays: number,
): string {
  if (status === "needs-baseline") {
    return `No shared weight baseline is available in the last ${lookbackDays} days.`;
  }
  if (status === "needs-log") {
    return `Current profile weight is ${currentWeight} ${unit}, but no shared weigh-ins are logged in the last ${lookbackDays} days.`;
  }
  const parts = [
    `${countLabel(totalWeighIns, "weigh-in")} in the last ${lookbackDays} days - current ${currentWeight} ${unit}`,
    change ? `${signedWeight(change, unit)} from previous` : "",
    goal ? `${remaining} ${unit} from goal` : "",
  ].filter(Boolean);
  return `${parts.join(", ")}.`;
}

function nextStepFor(status: WeightTrendStatus, direction: WeightTrendDirection, petName: string): string {
  if (status === "needs-baseline") {
    return `Add ${petName}'s current weight and goal range so Records and Care Pass reports have a baseline.`;
  }
  if (status === "needs-log") {
    return "Log the next weigh-in from the Log tab so the household and vet have dated weight context.";
  }
  if (direction === "gain") {
    return "Keep logging weight on a steady cadence and review appetite, diet, and vet guidance before changing portions.";
  }
  if (direction === "reduce") {
    return "Keep logging weight on a steady cadence and confirm any weight-loss plan with the vet.";
  }
  return "Keep logging weight periodically so the household can confirm the trend stays steady.";
}

export function deriveWeightTrend(input: WeightTrendInput): WeightTrend {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 90;
  const limit = input.limit ?? 8;
  const petName = resolvePetName(input.petName);
  const unit = clean(input.profile?.weight?.unit) || "lb";
  const items = input.entries
    .filter(isWeight)
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): WeightTrendItem | null => {
      const details = asObject(entry.details);
      const weight = roundTenth(parseNumber(entry.amount ?? details.weight ?? details.value ?? details.amount));
      if (weight <= 0) return null;
      return {
        id: clean(entry.id) || `weight_${index}`,
        label: clean(entry.title) || "Weight",
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        weight,
        unit,
        note: clean(details.note) || clean(entry.note),
      };
    })
    .filter((item): item is WeightTrendItem => item !== null)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  const totalWeighIns = items.length;
  const latest = items[items.length - 1] ?? null;
  const previous = items[items.length - 2] ?? null;
  const profileWeight = roundTenth(parseNumber(input.profile?.weight?.current));
  const currentWeight = latest?.weight ?? profileWeight;
  const goal = deriveGoalWeight(input);
  const changeFromPrevious = latest && previous ? roundTenth(latest.weight - previous.weight) : 0;
  const direction = directionFor(currentWeight, goal);
  const remainingToGoal = goal > 0 ? roundTenth(Math.abs(goal - currentWeight)) : 0;
  const status = statusFor(currentWeight, totalWeighIns, direction);
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));

  return {
    items: items.slice(Math.max(0, items.length - Math.max(0, limit))),
    totalWeighIns,
    currentWeight,
    goalWeight: goal,
    unit,
    changeFromPrevious,
    remainingToGoal,
    direction,
    status,
    summary: summaryFor(status, totalWeighIns, currentWeight, unit, goal, remainingToGoal, changeFromPrevious, lookbackDays),
    nextStep: nextStepFor(status, direction, petName),
    latest,
    previous,
    caregivers,
  };
}
