import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

export type PottyHealthStatus = "steady" | "watch" | "missing";
export type PottyKind = "pee" | "poop" | "both" | "unknown";

export interface PottyHealthEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface PottyHealthInput {
  entries: readonly PottyHealthEntry[];
  now?: number;
}

export interface PottyHealthItem {
  id: string;
  label: string;
  kind: PottyKind;
  kindLabel: string;
  condition: string;
  stoolColor: string;
  caregiver: string;
  occurredAt: string;
  note: string;
  severity: string;
  needsReview: boolean;
}

export interface PottyHealth {
  items: PottyHealthItem[];
  total: number;
  peeCount: number;
  poopCount: number;
  watchCount: number;
  status: PottyHealthStatus;
  summary: string;
  nextStep: string;
  conditions: string[];
  caregivers: string[];
  last: PottyHealthItem | null;
}

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

function visible(entry: PottyHealthEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isPotty(entry: PottyHealthEntry): boolean {
  const raw = clean(entry.type).toLowerCase();
  return normalizeCareEventType(entry.type, entry.details) === "potty" || raw === "pee" || raw === "poop";
}

function kindFor(entry: PottyHealthEntry): PottyKind {
  const details = asObject(entry.details);
  const explicit = clean(details.kind).toLowerCase();
  if (explicit === "both" || explicit === "pee-poop" || explicit === "pee & poop") return "both";
  if (explicit === "pee" || explicit === "urine") return "pee";
  if (explicit === "poop" || explicit === "stool") return "poop";

  const raw = clean(entry.type).toLowerCase();
  if (raw === "pee") return "pee";
  if (raw === "poop") return "poop";

  const title = clean(entry.title).toLowerCase();
  const hasPee = title.includes("pee");
  const hasPoop = title.includes("poop") || title.includes("stool");
  if (hasPee && hasPoop) return "both";
  if (hasPee) return "pee";
  if (hasPoop) return "poop";
  return "unknown";
}

function kindLabel(kind: PottyKind): string {
  if (kind === "both") return "pee & poop";
  if (kind === "pee") return "pee";
  if (kind === "poop") return "poop";
  return "potty";
}

function conditionFor(entry: PottyHealthEntry): string {
  const details = asObject(entry.details);
  const condition = clean(details.condition ?? details.stoolCondition).toLowerCase();
  if (condition) return condition;

  const title = clean(entry.title).toLowerCase();
  if (title.includes("diarrhea")) return "diarrhea";
  if (title.includes("soft")) return "soft";
  if (title.includes("loose")) return "loose";
  if (title.includes("off")) return "off";
  if (title.includes("normal")) return "normal";
  return "not logged";
}

function stoolColorFor(entry: PottyHealthEntry): string {
  const details = asObject(entry.details);
  return clean(details.stoolColor ?? details.color).toLowerCase();
}

function needsReview(condition: string, severity: string): boolean {
  if (["alert", "urgent", "watch"].includes(severity)) return true;
  return Boolean(condition && !["normal", "not logged"].includes(condition));
}

function hasPee(kind: PottyKind): boolean {
  return kind === "pee" || kind === "both";
}

function hasPoop(kind: PottyKind): boolean {
  return kind === "poop" || kind === "both";
}

function pluralLog(total: number): string {
  return `${total} potty ${total === 1 ? "log" : "logs"} today`;
}

export function derivePottyHealth(input: PottyHealthInput): PottyHealth {
  const now = input.now ?? Date.now();
  const items = input.entries
    .filter(isPotty)
    .filter((entry) => sameLocalDay(entry.occurredAt, now))
    .filter(visible)
    .map((entry, index): PottyHealthItem => {
      const details = asObject(entry.details);
      const kind = kindFor(entry);
      const condition = conditionFor(entry);
      const severity = clean(entry.severity).toLowerCase();
      return {
        id: clean(entry.id) || `potty_${index}`,
        label: clean(entry.title) || "Potty",
        kind,
        kindLabel: kindLabel(kind),
        condition,
        stoolColor: stoolColorFor(entry),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        note: clean(details.note) || clean(entry.note),
        severity,
        needsReview: needsReview(condition, severity),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const total = items.length;
  const peeCount = items.filter((item) => hasPee(item.kind)).length;
  const poopCount = items.filter((item) => hasPoop(item.kind)).length;
  const watchItems = items.filter((item) => item.needsReview);
  const watchCount = watchItems.length;
  const status: PottyHealthStatus = total === 0 ? "missing" : watchCount > 0 ? "watch" : "steady";
  const conditions = Array.from(new Set(watchItems.map((item) => item.condition).filter(Boolean)));
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));

  const summary =
    total === 0
      ? "No potty logs today"
      : watchCount > 0
        ? `${pluralLog(total)} - ${peeCount} pee, ${poopCount} poop, ${watchCount} ${watchCount === 1 ? "needs" : "need"} stool review`
        : `${pluralLog(total)} - ${peeCount} pee, ${poopCount} poop, stool normal`;

  const nextStep =
    total === 0
      ? "Log the next potty break with pee, poop, and stool detail so the household has context."
      : watchCount > 0
        ? "Add stool detail, color, hydration, food changes, and energy notes; contact a vet if diarrhea repeats, blood appears, or Phoenix seems painful, weak, or dehydrated."
        : "Keep logging pee, poop, stool detail, appetite, and energy so changes are easier to review.";

  return {
    items,
    total,
    peeCount,
    poopCount,
    watchCount,
    status,
    summary,
    nextStep,
    conditions,
    caregivers,
    last: items[0] ?? null,
  };
}
