export { parseClockTime } from "@workspace/care-domain";
export type { ParsedClockTime } from "@workspace/care-domain";

export interface MealAmountInput {
  completed: boolean;
  served: string;
  servedUnit: string;
  eaten: string;
  eatenUnit: string;
}

export type MealAmountValidation =
  | { ok: true; served: number | null; eaten: number | null }
  | { ok: false; field: "served" | "eaten"; message: string };

export interface ParsedPositiveAmountWithUnit {
  amount: number;
  unit:
    | "cup"
    | "tbsp"
    | "tsp"
    | "oz"
    | "g"
    | "kg"
    | "lb"
    | "serving"
    | "scoop"
    | "can"
    | "pouch"
    | "piece";
}

const AMOUNT_UNIT_ALIASES: Record<string, ParsedPositiveAmountWithUnit["unit"]> = {
  cup: "cup",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tsps: "tsp",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  serving: "serving",
  servings: "serving",
  scoop: "scoop",
  scoops: "scoop",
  can: "can",
  cans: "can",
  pouch: "pouch",
  pouches: "pouch",
  piece: "piece",
  pieces: "piece",
};

export function parseStrictNonNegativeDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStrictNonNegativeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseStrictPositiveAmountWithUnit(
  value: string,
): ParsedPositiveAmountWithUnit | null {
  const match = /^(?:(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|(\d+(?:\.\d*)?|\.\d+))\s+([A-Za-z]+)$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const safeIntegerComponent = (raw: string): number | null => {
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : null;
  };

  let amount: number;
  if (match[1] !== undefined) {
    const whole = safeIntegerComponent(match[1]);
    const numerator = safeIntegerComponent(match[2]);
    const denominator = safeIntegerComponent(match[3]);
    if (whole === null || numerator === null || denominator === null) return null;
    if (denominator <= 0 || numerator <= 0 || numerator >= denominator) return null;
    amount = whole + numerator / denominator;
  } else if (match[4] !== undefined) {
    const numerator = safeIntegerComponent(match[4]);
    const denominator = safeIntegerComponent(match[5]);
    if (numerator === null || denominator === null) return null;
    if (denominator <= 0) return null;
    amount = numerator / denominator;
  } else {
    const integerPart = match[6].split(".", 1)[0] || "0";
    if (safeIntegerComponent(integerPart) === null) return null;
    amount = Number(match[6]);
  }

  const unit = AMOUNT_UNIT_ALIASES[match[7].toLowerCase()];
  if (!unit || !Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) return null;
  return { amount, unit };
}

function parseOptionalAmount(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  return parseStrictNonNegativeDecimal(value) ?? undefined;
}

function normalizedUnit(value: string): string {
  return value.trim().toLowerCase();
}

export function validateMealAmounts(input: MealAmountInput): MealAmountValidation {
  const served = parseOptionalAmount(input.served);
  if (served === undefined || (input.completed && (served === null || served <= 0))) {
    return { ok: false, field: "served", message: "Enter a positive served amount." };
  }

  const eaten = parseOptionalAmount(input.eaten);
  if (eaten === undefined) {
    return { ok: false, field: "eaten", message: "Enter a valid eaten amount." };
  }

  if (
    served !== null &&
    eaten !== null &&
    normalizedUnit(input.servedUnit) === normalizedUnit(input.eatenUnit) &&
    eaten > served
  ) {
    return {
      ok: false,
      field: "eaten",
      message: "Eaten amount cannot exceed served amount in the same unit.",
    };
  }

  return { ok: true, served, eaten };
}
