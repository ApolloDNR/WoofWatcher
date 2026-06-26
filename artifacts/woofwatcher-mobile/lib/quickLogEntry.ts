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
  caregiverRole?: CareLogActorRole;
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

export type CareLogActorRole =
  | "Adult Admin"
  | "Adult"
  | "Teen"
  | "Kid"
  | "Sitter"
  | "Trainer"
  | "Vet Viewer"
  | string;

export type CareLogTrustState =
  | "confirmed"
  | "pending-confirmation"
  | "estimated"
  | "corrected"
  | "rejected";

export type QuickLogTapBehavior = "quick-log" | "detail-required";
export type QuickLogLongPressBehavior = "detail-sheet";
export type QuickLogDetailContract =
  | "simple"
  | "served-outcome"
  | "parent-outcome"
  | "safety-critical"
  | "health-context";

export interface QuickLogPolicy {
  type: CareEventType;
  tapBehavior: QuickLogTapBehavior;
  longPressBehavior: QuickLogLongPressBehavior;
  detailContract: QuickLogDetailContract;
  quickLabel: string;
  requiresConfirmation: boolean;
}

export interface QuickLogLauncherPresentation {
  modeLabel: "Tap log" | "Details";
  accessibilityLabel: string;
  feedbackHint: string;
  detailRequired: boolean;
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

function normalizeRole(role: CareLogActorRole | null | undefined): string {
  return clean(role).toLowerCase();
}

function roleRequiresConfirmation(role: CareLogActorRole | null | undefined): "kid-log" | "helper-log" | null {
  const normalized = normalizeRole(role);
  if (normalized === "kid") return "kid-log";
  if (normalized === "sitter" || normalized === "trainer") return "helper-log";
  return null;
}

export function getQuickLogPolicy(type: string | null | undefined): QuickLogPolicy {
  const normalizedType = normalizeCareEventType(type);
  if (normalizedType === "meal") {
    return {
      type: normalizedType,
      tapBehavior: "quick-log",
      longPressBehavior: "detail-sheet",
      detailContract: "served-outcome",
      quickLabel: "usual meal served",
      requiresConfirmation: false,
    };
  }
  if (normalizedType === "potty") {
    return {
      type: normalizedType,
      tapBehavior: "quick-log",
      longPressBehavior: "detail-sheet",
      detailContract: "parent-outcome",
      quickLabel: "potty attempt",
      requiresConfirmation: false,
    };
  }
  if (normalizedType === "medication") {
    return {
      type: normalizedType,
      tapBehavior: "detail-required",
      longPressBehavior: "detail-sheet",
      detailContract: "safety-critical",
      quickLabel: "medication detail",
      requiresConfirmation: true,
    };
  }
  if (normalizedType === "vomit" || normalizedType === "symptom" || normalizedType === "incident") {
    return {
      type: normalizedType,
      tapBehavior: "detail-required",
      longPressBehavior: "detail-sheet",
      detailContract: "health-context",
      quickLabel: normalizedType === "incident" ? "incident detail" : "health detail",
      requiresConfirmation: true,
    };
  }
  return {
    type: normalizedType,
    tapBehavior: "quick-log",
    longPressBehavior: "detail-sheet",
    detailContract: "simple",
    quickLabel: "quick log",
    requiresConfirmation: false,
  };
}

export function describeQuickLogLauncherAction(
  type: string | null | undefined,
  label: string,
): QuickLogLauncherPresentation {
  const policy = getQuickLogPolicy(type);
  const safeLabel = clean(label) || policy.type;
  if (policy.tapBehavior === "detail-required") {
    return {
      modeLabel: "Details",
      detailRequired: true,
      accessibilityLabel: `Open ${safeLabel} details. This log needs context before saving.`,
      feedbackHint: "Details first for health, medication, and incident logs.",
    };
  }

  return {
    modeLabel: "Tap log",
    detailRequired: false,
    accessibilityLabel: `Quick log ${safeLabel}. Long press for details.`,
    feedbackHint: "Tap saves the usual log. Long press opens more fields.",
  };
}

function trustDetails(policy: QuickLogPolicy, role: CareLogActorRole | null | undefined): Record<string, unknown> {
  const roleReason = roleRequiresConfirmation(role);
  const confirmationRequired = Boolean(roleReason) || policy.requiresConfirmation;
  return {
    logInteraction: policy.tapBehavior === "detail-required" ? "detail-sheet" : "quick-tap",
    trustState: roleReason ? "pending-confirmation" : "confirmed",
    confirmationRequired,
    ...(roleReason
      ? { confirmationReason: roleReason }
      : policy.requiresConfirmation
        ? { confirmationReason: "safety-critical" }
        : {}),
  };
}

export function buildQuickLogEntry(
  item: QuickLogConfig,
  state: QuickLogState,
  options: QuickLogBuildOptions,
): QuickLogBuiltEntry {
  const now = options.now ?? Date.now();
  const normalizedType = normalizeCareEventType(item.type);
  const routine = nextOpenRoutineOfType(state, normalizedType, now);
  const policy = getQuickLogPolicy(normalizedType);
  const details: Record<string, unknown> = {
    ...routineDetails(routine),
    ...trustDetails(policy, options.caregiverRole),
  };
  let amount: string | undefined;

  if (normalizedType === "meal") {
    const expectedPortion = state.dietProfile.normalPortion?.trim() ?? "";
    details.mealCompletion = "served";
    details.mealLifecycle = "outcome-pending";
    details.householdVisible = true;
    if (expectedPortion) details.expectedPortion = expectedPortion;

    const parsed = parsePortion(expectedPortion);
    if (parsed) {
      details.servedAmount = parsed.amount;
      details.servedUnit = parsed.unit;
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
    details.pottyOutcome = "attempt";
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
