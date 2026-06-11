import {
  deriveRoutineBoard,
  normalizeCareEventType,
  type CareEventType,
  type RoutineBoardItem,
} from "../../../lib/care-domain/src/index.ts";

export interface QuickLogConfig {
  type: CareEventType;
  title: string;
  mood?: string;
  severity?: string;
}

export interface QuickLogRoutine {
  id: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
}

export interface QuickLogState {
  routines: readonly QuickLogRoutine[];
  entries: readonly {
    id?: string;
    type: string;
    title?: string | null;
    caregiver?: string | null;
    occurredAt: string;
    details?: Record<string, unknown>;
  }[];
  caregivers: readonly { name: string; role?: string }[];
  dietProfile: {
    normalPortion?: string;
  };
}

export interface QuickLogBuildOptions {
  caregiver: string;
  now?: number;
}

export interface QuickLogBuiltEntry {
  type: CareEventType;
  title: string;
  caregiver: string;
  occurredAt: string;
  amount?: string;
  mood?: string;
  severity?: string;
  details?: Record<string, unknown>;
}

function statusRank(routine: RoutineBoardItem): number {
  if (routine.status === "overdue") return 0;
  if (routine.status === "due") return 1;
  return 2;
}

function nextOpenRoutineOfType(
  state: QuickLogState,
  type: CareEventType,
  now: number,
): RoutineBoardItem | null {
  const board = deriveRoutineBoard({
    routines: state.routines,
    entries: state.entries,
    caregivers: state.caregivers,
    now,
  });
  return (
    board.items
      .filter((routine) => routine.normalizedType === type && (routine.status === "overdue" || routine.status === "due"))
      .sort((a, b) => statusRank(a) - statusRank(b) || a.minutesFromNow - b.minutesFromNow)[0] ?? null
  );
}

function portionAmountText(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

function parsePortion(portion: string): { amount: number; unit: string } | null {
  const trimmed = portion.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s*([a-zA-Z]+)?/);
  if (!match) return null;

  const rawAmount = match[1].replace(/\s+/g, "");
  let amount: number;
  if (rawAmount.includes("/")) {
    const [top, bottom] = rawAmount.split("/").map((part) => Number.parseFloat(part));
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) return null;
    amount = top / bottom;
  } else {
    amount = Number.parseFloat(rawAmount);
  }

  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? "serving").toLowerCase().replace(/[.,]$/, "").replace(/s$/, "");
  return { amount, unit };
}

function routineDetails(routine: RoutineBoardItem | null): Record<string, unknown> {
  if (!routine) return {};
  return {
    routineId: routine.id,
    routineLabel: routine.label,
    routineTime: routine.time,
  };
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function buildQuickLogEntry(
  item: QuickLogConfig,
  state: QuickLogState,
  options: QuickLogBuildOptions,
): QuickLogBuiltEntry {
  const now = options.now ?? Date.now();
  const normalizedType = normalizeCareEventType(item.type);
  const routine = nextOpenRoutineOfType(state, normalizedType, now);
  const details: Record<string, unknown> = routineDetails(routine);
  let amount: string | undefined;

  if (normalizedType === "meal") {
    const expectedPortion = state.dietProfile.normalPortion?.trim() ?? "";
    details.mealCompletion = "complete";
    details.householdVisible = true;
    if (expectedPortion) details.expectedPortion = expectedPortion;

    const parsed = parsePortion(expectedPortion);
    if (parsed) {
      details.servedAmount = parsed.amount;
      details.servedUnit = parsed.unit;
      details.eatenAmount = parsed.amount;
      details.eatenUnit = parsed.unit;
      amount = portionAmountText(parsed.amount);
    }
  }

  if (normalizedType === "medication") {
    details.medicationOutcome = "taken";
    details.householdVisible = true;
    const dose = clean(routine?.note);
    if (dose) details.dose = dose;
  }

  if (normalizedType === "water") {
    details.waterAmount = "refill";
    details.householdVisible = true;
  }

  if (normalizedType === "walk") {
    details.householdVisible = true;
  }

  if (normalizedType === "potty") {
    details.householdVisible = true;
  }

  return {
    type: normalizedType,
    title: routine?.label ?? item.title,
    caregiver: options.caregiver,
    occurredAt: new Date(now).toISOString(),
    ...(amount ? { amount } : {}),
    ...(item.mood ? { mood: item.mood } : {}),
    ...(item.severity ? { severity: item.severity } : {}),
    ...(Object.keys(details).length ? { details } : {}),
  };
}
