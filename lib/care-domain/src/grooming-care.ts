import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { isHouseholdVisibleCareEvidence } from "./shared-evidence.ts";

export type GroomingCareStatus = "needs-log" | "steady" | "due-soon" | "watch";
export type GroomingKind = "brush" | "bath" | "nails" | "teeth" | "other";

export interface GroomingCareEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface GroomingCareInput {
  entries: readonly GroomingCareEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
}

export interface GroomingCareItem {
  id: string;
  label: string;
  kind: GroomingKind;
  kindLabel: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes: number;
  condition: string;
  products: string;
  nextDue: string;
  note: string;
}

export interface GroomingCareSummary {
  items: GroomingCareItem[];
  totalSessions: number;
  totalMinutes: number;
  brushCount: number;
  bathCount: number;
  nailCount: number;
  teethCount: number;
  watchCount: number;
  caregivers: string[];
  products: string[];
  nextDue: string;
  status: GroomingCareStatus;
  summary: string;
  nextStep: string;
  latest: GroomingCareItem | null;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: CareEventDetails): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function countLabel(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function isVisible(entry: GroomingCareEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function normalizeKind(value: unknown): GroomingKind {
  const normalized = clean(value).toLowerCase();
  if (["brush", "brushing", "comb", "deshed", "deshedding"].includes(normalized)) return "brush";
  if (["bath", "bathe", "shampoo", "wash"].includes(normalized)) return "bath";
  if (["nails", "nail", "nail trim", "trim"].includes(normalized)) return "nails";
  if (["teeth", "tooth", "dental", "brush teeth"].includes(normalized)) return "teeth";
  return "other";
}

function kindFrom(entry: GroomingCareEntry): GroomingKind {
  const details = asObject(entry.details);
  const explicit = normalizeKind(details.kind ?? details.groomingType ?? details.type);
  if (explicit !== "other") return explicit;
  const title = clean(entry.title).toLowerCase();
  if (title.includes("brush")) return "brush";
  if (title.includes("bath")) return "bath";
  if (title.includes("nail")) return "nails";
  if (title.includes("teeth") || title.includes("dental")) return "teeth";
  return "other";
}

function kindLabel(kind: GroomingKind): string {
  if (kind === "brush") return "brush";
  if (kind === "bath") return "bath";
  if (kind === "nails") return "nails";
  if (kind === "teeth") return "teeth";
  return "grooming";
}

function isWatchCondition(value: string): boolean {
  const lower = value.toLowerCase();
  return [
    "itch",
    "red",
    "sore",
    "hot spot",
    "mat",
    "odor",
    "ear",
    "rash",
    "flake",
    "pain",
    "blood",
  ].some((term) => lower.includes(term));
}

function parseDueDate(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function nextDueFrom(items: readonly GroomingCareItem[], now: number): string {
  const dated = items
    .map((item) => ({ value: item.nextDue, time: parseDueDate(item.nextDue) }))
    .filter((item): item is { value: string; time: number } => item.time != null)
    .sort((a, b) => {
      const aPast = a.time < now;
      const bPast = b.time < now;
      if (aPast !== bPast) return aPast ? 1 : -1;
      return Math.abs(a.time - now) - Math.abs(b.time - now);
    });
  return dated[0]?.value ?? "";
}

function statusFor(items: readonly GroomingCareItem[], watchCount: number, nextDue: string, now: number): GroomingCareStatus {
  if (items.length === 0) return "needs-log";
  if (watchCount > 0) return "watch";
  const dueTime = parseDueDate(nextDue);
  if (dueTime != null && dueTime - now <= 7 * 86400000) return "due-soon";
  return "steady";
}

function nextStepFor(status: GroomingCareStatus, nextDue: string): string {
  if (status === "needs-log") {
    return "Log the next brush, bath, nail trim, or teeth care with coat condition, products, and next due date so the household has a grooming baseline.";
  }
  if (status === "watch") {
    return "Review owner-reported coat and skin context, keep grooming notes consistent, and contact a vet or groomer for repeat redness, sores, odor, pain, or itching.";
  }
  if (status === "due-soon" && nextDue) {
    return `The next grooming due date is ${nextDue}; assign the owner or sitter who should handle it and log the result.`;
  }
  return "Keep logging grooming type, coat condition, products, and next due date so sitter and vet handoffs stay current.";
}

export function deriveGroomingCare(input: GroomingCareInput): GroomingCareSummary {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 45;
  const limit = input.limit ?? 6;
  const items = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "grooming")
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): GroomingCareItem => {
      const details = asObject(entry.details);
      const kind = kindFrom(entry);
      return {
        id: clean(entry.id) || `grooming_${index}`,
        label: clean(entry.title) || "Grooming",
        kind,
        kindLabel: kindLabel(kind),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        durationMinutes: Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes))),
        condition: clean(details.groomingCondition ?? details.condition ?? details.coatCondition),
        products: clean(details.groomingProducts ?? details.products ?? details.groomer),
        nextDue: clean(details.groomingNextDue ?? details.nextDue),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const totalSessions = items.length;
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const brushCount = items.filter((item) => item.kind === "brush").length;
  const bathCount = items.filter((item) => item.kind === "bath").length;
  const nailCount = items.filter((item) => item.kind === "nails").length;
  const teethCount = items.filter((item) => item.kind === "teeth").length;
  const watchCount = items.filter((item) => isWatchCondition(item.condition) || isWatchCondition(item.note)).length;
  const caregivers = unique(items.map((item) => item.caregiver));
  const products = unique(items.map((item) => item.products));
  const nextDue = nextDueFrom(items, now);
  const status = statusFor(items, watchCount, nextDue, now);
  const latest = items[0] ?? null;

  return {
    items: items.slice(0, Math.max(0, limit)),
    totalSessions,
    totalMinutes,
    brushCount,
    bathCount,
    nailCount,
    teethCount,
    watchCount,
    caregivers,
    products,
    nextDue,
    status,
    summary:
      totalSessions === 0
        ? `No shared grooming logs in the last ${lookbackDays} days`
        : `${countLabel(totalSessions, "grooming log")} in the last ${lookbackDays} days - ${countLabel(totalMinutes, "minute")}, ${countLabel(brushCount, "brush")}, ${countLabel(bathCount, "bath")}.`,
    nextStep: nextStepFor(status, nextDue),
    latest,
  };
}
