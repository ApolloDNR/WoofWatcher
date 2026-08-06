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

export function parseStrictNonNegativeDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
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
