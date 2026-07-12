import { appendCareAuditEvent, normalizeCareEventType, type CareAuditEvent } from "../../../lib/care-domain/src/index.ts";

export type MealOutcomeUpdate = "complete" | "most" | "partial" | "skipped" | "grazing";

export interface MealOutcomeUpdateOption {
  id: MealOutcomeUpdate;
  label: string;
}

export interface MealOutcomeUpdateEntryLike {
  id?: string;
  type?: string;
  title?: string;
  caregiver?: string;
  occurredAt?: string;
  amount?: string;
  severity?: string;
  details?: Record<string, unknown> | null;
}

export interface MealOutcomeUpdateOptions {
  caregiver: string;
  now: string;
  outcome: MealOutcomeUpdate;
  eatenAmount?: number | null;
}

export interface MealOutcomeUpdatePatch {
  title: string;
  amount?: string;
  severity?: string;
  details: Record<string, unknown> & { auditTrail?: CareAuditEvent[] };
}

export const MEAL_OUTCOME_UPDATE_OPTIONS: MealOutcomeUpdateOption[] = [
  { id: "complete", label: "Ate all" },
  { id: "most", label: "Ate most" },
  { id: "partial", label: "Ate some" },
  { id: "skipped", label: "Refused" },
  { id: "grazing", label: "Still grazing" },
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function detailNumber(details: Record<string, unknown>, key: string): number | null {
  const value = details[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function roundCareAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function amountText(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function optionLabel(outcome: MealOutcomeUpdate): string {
  return MEAL_OUTCOME_UPDATE_OPTIONS.find((option) => option.id === outcome)?.label ?? outcome;
}

function baseTitle(title: string): string {
  return (title.split(" - ")[0] || title || "Meal").trim();
}

function isMealEntry(entry: MealOutcomeUpdateEntryLike, details: Record<string, unknown>): boolean {
  return normalizeCareEventType(entry.type, details) === "meal";
}

function eatenAmountFor(outcome: MealOutcomeUpdate, servedAmount: number | null, exactEatenAmount?: number | null): number | null {
  if (outcome === "skipped") return 0;
  if (outcome === "partial" && exactEatenAmount != null && Number.isFinite(exactEatenAmount) && exactEatenAmount >= 0) {
    return roundCareAmount(exactEatenAmount);
  }
  if (servedAmount == null) return null;
  if (outcome === "complete") return roundCareAmount(servedAmount);
  if (outcome === "most") return roundCareAmount(servedAmount * 0.8);
  if (outcome === "partial") return roundCareAmount(servedAmount * 0.5);
  return null;
}

function severityFor(outcome: MealOutcomeUpdate, entry: MealOutcomeUpdateEntryLike, details: Record<string, unknown>): string | undefined {
  if (!isMealEntry(entry, details)) return entry.severity;
  if (outcome === "partial" || outcome === "skipped" || outcome === "grazing") return "watch";
  return undefined;
}

export function buildMealOutcomeUpdatePatch(
  entry: MealOutcomeUpdateEntryLike,
  options: MealOutcomeUpdateOptions,
): MealOutcomeUpdatePatch {
  const existing = isRecord(entry.details) ? entry.details : {};
  const caregiver = clean(options.caregiver) || "Care team";
  const now = clean(options.now) || new Date().toISOString();
  const existingTitle = clean(entry.title) || "Meal";
  const servedAmount = detailNumber(existing, "servedAmount") ?? detailNumber(existing, "servingAmount");
  const servedUnit = clean(existing.servedUnit) || clean(existing.servingUnit) || "cup";
  const eatenAmount = eatenAmountFor(options.outcome, servedAmount, options.eatenAmount);
  const label = optionLabel(options.outcome);
  const closesOutcome = options.outcome !== "grazing";
  const changes = ["mealCompletion", "mealLifecycle", "outcomeAt"];
  if (eatenAmount != null) changes.push("eatenAmount");

  const nextDetails: Record<string, unknown> = {
    ...existing,
    mealCompletion: options.outcome,
    mealLifecycle: closesOutcome ? "outcome-recorded" : "outcome-pending",
    outcomeAt: now,
    outcomeBy: caregiver,
    trustState: "confirmed",
    confirmationRequired: false,
  };

  if (eatenAmount != null) {
    nextDetails.eatenAmount = eatenAmount;
    nextDetails.eatenUnit = servedUnit;
  } else {
    delete nextDetails.eatenAmount;
    delete nextDetails.eatenUnit;
    delete nextDetails.eatenAmountEstimated;
  }

  if (options.outcome === "partial" && options.eatenAmount == null && eatenAmount != null) {
    nextDetails.eatenAmountEstimated = true;
  } else {
    delete nextDetails.eatenAmountEstimated;
  }

  return {
    title: `${baseTitle(existingTitle)} - ${label}`,
    ...(eatenAmount != null ? { amount: amountText(eatenAmount) } : {}),
    severity: severityFor(options.outcome, entry, existing),
    details: appendCareAuditEvent(nextDetails, {
      id: `meal_outcome_${Date.parse(now) || Date.now()}`,
      action: "updated",
      caregiver,
      occurredAt: now,
      summary: `${caregiver} updated meal outcome on "${existingTitle}" to ${label}.`,
      changes,
    }),
  };
}
