import { appendCareAuditEvent, normalizeCareEventType, type CareAuditEvent } from "../../../lib/care-domain/src/index.ts";

export type PottyDetailOutcome = "pee" | "poop" | "both" | "tried-nothing" | "accident";
export type PottyLocation = "outside" | "inside";
export type PottyPeeDetail = "normal" | "frequent" | "dark" | "straining" | "accident" | "not-sure";
export type PottyStoolCondition = "normal" | "soft" | "diarrhea" | "hard" | "mucus" | "blood" | "unusual-color" | "not-sure";
export type PottyContext = "routine" | "accident" | "urgent" | "straining";

export interface PottyOption<TId extends string> {
  id: TId;
  label: string;
}

export interface PottyLogDetailEntryLike {
  id?: string;
  type?: string;
  title?: string;
  caregiver?: string;
  occurredAt?: string;
  severity?: string;
  details?: Record<string, unknown> | null;
}

export interface PottyLogDetailPatch {
  title: string;
  severity: string | undefined;
  details: Record<string, unknown> & { auditTrail?: CareAuditEvent[] };
}

export interface PottyLogDetailOptions {
  caregiver: string;
  now: string;
  outcome: PottyDetailOutcome;
  location?: PottyLocation | null;
  peeDetail?: PottyPeeDetail | null;
  stoolCondition?: PottyStoolCondition | null;
  stoolColor?: string | null;
  context?: PottyContext | null;
}

export const POTTY_DETAIL_OUTCOMES: PottyOption<PottyDetailOutcome>[] = [
  { id: "pee", label: "Pee" },
  { id: "poop", label: "Poop" },
  { id: "both", label: "Pee & poop" },
  { id: "tried-nothing", label: "Tried, nothing" },
  { id: "accident", label: "Accident" },
];

export const POTTY_LOCATION_OPTIONS: PottyOption<PottyLocation>[] = [
  { id: "outside", label: "Outside" },
  { id: "inside", label: "Inside" },
];

export const POTTY_PEE_DETAIL_OPTIONS: PottyOption<PottyPeeDetail>[] = [
  { id: "normal", label: "Normal" },
  { id: "frequent", label: "Frequent" },
  { id: "dark", label: "Dark" },
  { id: "straining", label: "Straining" },
  { id: "accident", label: "Accident" },
  { id: "not-sure", label: "Not sure" },
];

export const POTTY_STOOL_CONDITION_OPTIONS: PottyOption<PottyStoolCondition>[] = [
  { id: "normal", label: "Normal" },
  { id: "soft", label: "Soft" },
  { id: "diarrhea", label: "Diarrhea" },
  { id: "hard", label: "Hard" },
  { id: "mucus", label: "Mucus" },
  { id: "blood", label: "Blood" },
  { id: "unusual-color", label: "Unusual color" },
  { id: "not-sure", label: "Not sure" },
];

export const POTTY_CONTEXT_OPTIONS: PottyOption<PottyContext>[] = [
  { id: "routine", label: "Routine" },
  { id: "accident", label: "Accident" },
  { id: "urgent", label: "Urgent" },
  { id: "straining", label: "Straining" },
];

const STALE_POTTY_DETAIL_KEYS = [
  "pottyOutcome",
  "pottyWhere",
  "peeDetail",
  "condition",
  "stoolColor",
  "pottyContext",
  "outcomeBy",
  "outcomeAt",
];

const REVIEW_STOOL_CONDITIONS = new Set<PottyStoolCondition>(["soft", "diarrhea", "hard", "mucus", "blood", "unusual-color"]);
const REVIEW_PEE_DETAILS = new Set<PottyPeeDetail>(["frequent", "dark", "straining", "accident"]);
const REVIEW_CONTEXTS = new Set<PottyContext>(["accident", "urgent", "straining"]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionLabel<TId extends string>(options: PottyOption<TId>[], id: TId): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

function hasPee(outcome: PottyDetailOutcome): boolean {
  return outcome === "pee" || outcome === "both";
}

function hasStool(outcome: PottyDetailOutcome): boolean {
  return outcome === "poop" || outcome === "both";
}

function isPottyEntry(entry: PottyLogDetailEntryLike): boolean {
  return normalizeCareEventType(entry.type, entry.details) === "potty";
}

function baseTitle(title: string): string {
  return (title.split(" - ")[0] || title || "Potty").trim();
}

function severityFor(options: PottyLogDetailOptions): string | undefined {
  if (options.outcome === "accident") return "watch";
  if (options.context && REVIEW_CONTEXTS.has(options.context)) return options.context === "straining" ? "alert" : "watch";
  if (options.peeDetail && REVIEW_PEE_DETAILS.has(options.peeDetail)) return options.peeDetail === "straining" ? "alert" : "watch";
  if (options.stoolCondition && REVIEW_STOOL_CONDITIONS.has(options.stoolCondition)) {
    return options.stoolCondition === "blood" || options.stoolCondition === "diarrhea" ? "alert" : "watch";
  }
  return undefined;
}

function withCleanPottyDetails(details: Record<string, unknown>): Record<string, unknown> {
  const next = { ...details };
  STALE_POTTY_DETAIL_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
}

export function buildPottyLogDetailPatch(
  entry: PottyLogDetailEntryLike,
  options: PottyLogDetailOptions,
): PottyLogDetailPatch {
  const existing = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details : {};
  const outcomeLabel = optionLabel(POTTY_DETAIL_OUTCOMES, options.outcome);
  const existingTitle = clean(entry.title) || "Potty";
  const nextDetails: Record<string, unknown> = {
    ...withCleanPottyDetails(existing),
    pottyOutcome: options.outcome,
    outcomeBy: clean(options.caregiver) || "Care team",
    outcomeAt: options.now,
  };

  if (options.location) nextDetails.pottyWhere = options.location;
  if (hasPee(options.outcome) && options.peeDetail) nextDetails.peeDetail = options.peeDetail;
  if (hasStool(options.outcome)) {
    if (options.stoolCondition) nextDetails.condition = options.stoolCondition;
    if (clean(options.stoolColor)) nextDetails.stoolColor = clean(options.stoolColor).toLowerCase();
  }
  if ((options.outcome === "accident" && !options.context) || options.context) {
    nextDetails.pottyContext = options.context ?? "accident";
  }

  const changes = ["pottyOutcome", "pottyWhere"];
  if (hasStool(options.outcome) && options.stoolCondition) changes.push("condition");
  if (hasPee(options.outcome) && options.peeDetail) changes.push("peeDetail");
  changes.push("outcomeAt");

  return {
    title: `${baseTitle(existingTitle)} - ${outcomeLabel}`,
    severity: isPottyEntry(entry) ? severityFor(options) : entry.severity,
    details: appendCareAuditEvent(nextDetails, {
      id: `potty_detail_${Date.parse(options.now) || Date.now()}`,
      action: "updated",
      caregiver: clean(options.caregiver) || "Care team",
      occurredAt: options.now,
      summary: `${clean(options.caregiver) || "Care team"} updated potty detail on "${existingTitle}" to ${outcomeLabel}.`,
      changes,
    }),
  };
}
