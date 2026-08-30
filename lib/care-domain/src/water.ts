import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { isHouseholdVisibleCareEvidence } from "./shared-evidence.ts";

export type WaterHydrationStatus = "logged" | "watch";

export interface WaterHydrationEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  amount?: string | number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface WaterHydrationInput {
  entries: readonly WaterHydrationEntry[];
  now?: number;
  targetRefills?: number;
}

export interface WaterHydrationItem {
  id: string;
  label: string;
  amountKind: string;
  amountLabel: string;
  refillEquivalent: number;
  caregiver: string;
  occurredAt: string;
  note: string;
}

export interface WaterHydration {
  items: WaterHydrationItem[];
  total: number;
  refillEquivalent: number;
  targetRefills: number;
  percent: number;
  status: WaterHydrationStatus;
  summary: string;
  nextStep: string;
  caregivers: string[];
  last: WaterHydrationItem | null;
}

const AMOUNT_FACTORS: Record<string, number> = {
  sip: 0.25,
  sips: 0.25,
  drink: 0.5,
  drank: 0.5,
  half: 0.5,
  topup: 0.5,
  "top-up": 0.5,
  bowl: 1,
  full: 1,
  refill: 1,
  fresh: 1,
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: CareEventDetails): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sameLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const entry = new Date(iso);
  if (!Number.isFinite(entry.getTime())) return false;
  const current = new Date(now);
  return (
    entry.getFullYear() === current.getFullYear() &&
    entry.getMonth() === current.getMonth() &&
    entry.getDate() === current.getDate()
  );
}

function visible(entry: WaterHydrationEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function slug(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function amountKind(entry: WaterHydrationEntry): string {
  const details = asObject(entry.details);
  const explicit = clean(details.waterAmount ?? details.amount ?? entry.amount).toLowerCase();
  if (explicit) return slug(explicit);

  const title = clean(entry.title).toLowerCase();
  if (title.includes("sip")) return "sip";
  if (title.includes("refill") || title.includes("fresh")) return "refill";
  if (title.includes("bowl")) return "bowl";
  return "logged";
}

function amountLabel(kind: string): string {
  if (kind === "sip" || kind === "sips") return "Sip";
  if (kind === "half") return "Half bowl";
  if (kind === "topup" || kind === "top-up") return "Top-up";
  if (kind === "bowl" || kind === "full") return "Full bowl";
  if (kind === "fresh" || kind === "refill") return "Refill";
  if (kind === "drink" || kind === "drank") return "Drink";
  return "Water logged";
}

function refillEquivalent(kind: string): number {
  return AMOUNT_FACTORS[kind] ?? 0.5;
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  const rounded = roundAmount(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
}

export function deriveWaterHydration(input: WaterHydrationInput): WaterHydration {
  const now = input.now ?? Date.now();
  const targetRefills = input.targetRefills ?? 3;
  const items = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "water")
    .filter((entry) => sameLocalDay(entry.occurredAt, now))
    .filter(visible)
    .map((entry, index): WaterHydrationItem => {
      const kind = amountKind(entry);
      return {
        id: clean(entry.id) || `water_${index}`,
        label: clean(entry.title) || "Water",
        amountKind: kind,
        amountLabel: amountLabel(kind),
        refillEquivalent: refillEquivalent(kind),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        note: clean(asObject(entry.details).note) || clean(entry.note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const total = items.length;
  const equivalent = roundAmount(items.reduce((sum, item) => sum + item.refillEquivalent, 0));
  const percent = targetRefills > 0 ? Math.min(100, Math.round((equivalent / targetRefills) * 100)) : 0;
  const status: WaterHydrationStatus = total > 0 && percent >= 100 ? "logged" : "watch";
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));

  return {
    items,
    total,
    refillEquivalent: equivalent,
    targetRefills,
    percent,
    status,
    summary:
      total === 0
        ? "No water logs yet today"
        : `${total} water ${total === 1 ? "log" : "logs"} today - ${formatAmount(equivalent)} bowl ${equivalent === 1 ? "refill" : "refills"} tracked`,
    nextStep:
      total === 0
        ? "Log a refill or drinking note when fresh water is offered."
        : status === "logged"
          ? "Fresh water has been logged today. Keep the bowl available and note any unusual drinking changes."
          : "Keep logging fresh water refills and drinking checks so the household can see the pattern.",
    caregivers,
    last: items[0] ?? null,
  };
}
