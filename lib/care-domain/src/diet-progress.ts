import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

export interface DietProgressProfile {
  primaryFood?: string | null;
  normalPortion?: string | null;
  mealSchedule?: string | null;
}

export interface DietProgressEntry {
  type?: string | null;
  occurredAt?: string | null;
  amount?: string | number | null;
  title?: string | null;
  details?: CareEventDetails;
}

export interface DietProgressInput {
  dietProfile?: DietProgressProfile | null;
  entries: readonly DietProgressEntry[];
  now?: number;
}

export interface DietProgress {
  primaryFood: string;
  targetAmount: number | null;
  perMealAmount: number | null;
  fedAmount: number;
  remainingAmount: number | null;
  percent: number;
  unit: string;
  mealCount: number;
  targetMeals: number;
  label: string;
  summary: string;
}

interface ParsedAmount {
  amount: number;
  unit: string | null;
}

const PORTION_FACTORS: Record<string, number> = {
  full: 1,
  half: 0.5,
  light: 0.75,
  snack: 0.25,
};

function asObject(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string") return null;
  return parseAmount(value)?.amount ?? null;
}

function normalizeUnit(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bcups?\b/.test(lower)) return "cup";
  if (/\bgrams?\b|\bg\b/.test(lower)) return "g";
  if (/\bounces?\b|\boz\b/.test(lower)) return "oz";
  if (/\btablespoons?\b|\btbsp\b/.test(lower)) return "tbsp";
  if (/\bservings?\b|\bportions?\b/.test(lower)) return "serving";
  return null;
}

function parseAmount(text: string | number | null | undefined): ParsedAmount | null {
  if (typeof text === "number") {
    return Number.isFinite(text) && text > 0 ? { amount: text, unit: null } : null;
  }
  if (!text) return null;
  const trimmed = text.trim();
  const mixed = trimmed.match(/(\d+(?:\.\d+)?)\s+(\d+)\s*\/\s*(\d+)/);
  const fraction = trimmed.match(/(\d+)\s*\/\s*(\d+)/);
  const decimal = trimmed.match(/(\d+(?:\.\d+)?)/);

  let amount: number | null = null;
  if (mixed) {
    const whole = Number.parseFloat(mixed[1]);
    const numerator = Number.parseFloat(mixed[2]);
    const denominator = Number.parseFloat(mixed[3]);
    if (denominator > 0) amount = whole + numerator / denominator;
  } else if (fraction) {
    const numerator = Number.parseFloat(fraction[1]);
    const denominator = Number.parseFloat(fraction[2]);
    if (denominator > 0) amount = numerator / denominator;
  } else if (decimal) {
    amount = Number.parseFloat(decimal[1]);
  }

  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit: normalizeUnit(trimmed) };
}

function mealTargetCount(profileText: string): number {
  const text = profileText.toLowerCase();
  if (/\b(three|3)\b|\b3x\b/.test(text)) return 3;
  if (/\b(twice|two|2)\b|\b2x\b/.test(text)) return 2;
  if (/\b(once|one|1)\b|\b1x\b/.test(text)) return 1;

  const scheduleMatches = ["breakfast", "lunch", "dinner"].filter((word) =>
    text.includes(word),
  ).length;
  return scheduleMatches > 0 ? scheduleMatches : 2;
}

function isDailyTotal(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(per day|daily total|a day|each day)\b|\/day/.test(lower);
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  const rounded = roundAmount(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function pluralizeUnit(unit: string, amount: number): string {
  if (unit === "g" || unit === "oz") return unit;
  if (amount === 1) return unit;
  if (unit.endsWith("s")) return unit;
  return `${unit}s`;
}

function sameDay(occurredAt: string | null | undefined, now: number): boolean {
  if (!occurredAt) return false;
  const entryTime = new Date(occurredAt).getTime();
  if (!Number.isFinite(entryTime)) return false;
  return new Date(entryTime).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10);
}

function mealAmount(entry: DietProgressEntry, perMealAmount: number | null): number | null {
  const details = asObject(entry.details);
  const servingAmount = numberFromUnknown(details.servingAmount);
  if (servingAmount != null) return servingAmount;

  const detailAmount = numberFromUnknown(details.amount);
  if (detailAmount != null) return detailAmount;

  const entryAmount = numberFromUnknown(entry.amount);
  if (entryAmount != null) return entryAmount;

  const portion = typeof details.portion === "string" ? details.portion.toLowerCase() : "";
  const factor = PORTION_FACTORS[portion];
  return factor != null && perMealAmount != null ? roundAmount(perMealAmount * factor) : null;
}

function entryUnit(entry: DietProgressEntry): string | null {
  const details = asObject(entry.details);
  if (typeof details.servingUnit === "string" && details.servingUnit.trim()) {
    return details.servingUnit.trim().toLowerCase();
  }
  if (typeof entry.amount === "string") return parseAmount(entry.amount)?.unit ?? null;
  return null;
}

export function deriveDietProgress(input: DietProgressInput): DietProgress {
  const now = input.now ?? Date.now();
  const profile = input.dietProfile ?? {};
  const normalPortion = profile.normalPortion?.trim() ?? "";
  const mealSchedule = profile.mealSchedule?.trim() ?? "";
  const parsedPortion = parseAmount(normalPortion);
  const targetMeals = mealTargetCount(`${normalPortion} ${mealSchedule}`);
  const unit = parsedPortion?.unit ?? "cup";

  let targetAmount: number | null = null;
  let perMealAmount: number | null = null;
  if (parsedPortion) {
    targetAmount = isDailyTotal(normalPortion)
      ? roundAmount(parsedPortion.amount)
      : roundAmount(parsedPortion.amount * targetMeals);
    perMealAmount = isDailyTotal(normalPortion)
      ? roundAmount(parsedPortion.amount / targetMeals)
      : roundAmount(parsedPortion.amount);
  }

  let fedAmount = 0;
  let mealCount = 0;
  let detectedUnit: string | null = null;

  for (const entry of input.entries) {
    if (!sameDay(entry.occurredAt, now)) continue;
    if (normalizeCareEventType(entry.type, entry.details) !== "meal") continue;
    mealCount += 1;
    detectedUnit ??= entryUnit(entry);
    const amount = mealAmount(entry, perMealAmount);
    if (amount != null) fedAmount += amount;
  }

  const finalUnit = parsedPortion?.unit ?? detectedUnit ?? unit;
  const roundedFed = roundAmount(fedAmount);
  const remainingAmount = targetAmount == null ? null : roundAmount(Math.max(targetAmount - roundedFed, 0));
  const percent = targetAmount != null && targetAmount > 0 ? Math.round((roundedFed / targetAmount) * 100) : 0;

  return {
    primaryFood: profile.primaryFood?.trim() ?? "",
    targetAmount,
    perMealAmount,
    fedAmount: roundedFed,
    remainingAmount,
    percent,
    unit: finalUnit,
    mealCount,
    targetMeals,
    label: "Daily food",
    summary:
      targetAmount == null
        ? `${mealCount} meal${mealCount === 1 ? "" : "s"} logged today`
        : `${formatAmount(roundedFed)} of ${formatAmount(targetAmount)} ${pluralizeUnit(finalUnit, targetAmount)} today`,
  };
}
