import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

export type WalkActivityStatus = "active" | "light" | "needs-walk";

export interface WalkActivityEntry {
  id?: string;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  durationMinutes?: number | null;
  dogInteractions?: number | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface WalkActivityInput {
  entries: readonly WalkActivityEntry[];
  now?: number;
  targetMinutes?: number;
}

export interface WalkActivityItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  durationMinutes: number;
  distanceMiles: number;
  dogInteractions: number;
  place: string;
  socialOutcome: string;
  note: string;
}

export interface WalkActivity {
  items: WalkActivityItem[];
  total: number;
  totalMinutes: number;
  distanceMiles: number;
  dogInteractions: number;
  targetMinutes: number;
  percent: number;
  status: WalkActivityStatus;
  summary: string;
  nextStep: string;
  caregivers: string[];
  places: string[];
  last: WalkActivityItem | null;
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

function isVisible(entry: WalkActivityEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isWalk(entry: WalkActivityEntry): boolean {
  const raw = clean(entry.type).toLowerCase().replace(/\s+/g, "-");
  return normalizeCareEventType(entry.type, entry.details) === "walk" || raw === "park" || raw === "dog-park";
}

function placeFor(entry: WalkActivityEntry): string {
  const details = asObject(entry.details);
  return (
    clean(details.routeName) ||
    clean(details.location) ||
    clean(details.place) ||
    clean(details.parkName)
  );
}

function socialOutcomeFor(entry: WalkActivityEntry): string {
  const details = asObject(entry.details);
  return clean(details.socialOutcome) || clean(details.interactionOutcome) || clean(details.dogInteractionOutcome);
}

function roundDistance(value: number): number {
  return Math.round(value * 10) / 10;
}

function minutesLabel(minutes: number): string {
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

function interactionsLabel(count: number): string {
  return `${count} dog ${count === 1 ? "interaction" : "interactions"} noted`;
}

export function deriveWalkActivity(input: WalkActivityInput): WalkActivity {
  const now = input.now ?? Date.now();
  const targetMinutes = input.targetMinutes ?? 45;
  const items = input.entries
    .filter(isWalk)
    .filter((entry) => sameLocalDay(entry.occurredAt, now))
    .filter(isVisible)
    .map((entry, index): WalkActivityItem => {
      const details = asObject(entry.details);
      return {
        id: clean(entry.id) || `walk_${index}`,
        label: clean(entry.title) || "Walk",
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        durationMinutes: Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes))),
        distanceMiles: roundDistance(Math.max(0, asNumber(details.distanceMiles ?? details.distance ?? details.miles))),
        dogInteractions: Math.max(0, Math.round(asNumber(entry.dogInteractions ?? details.dogInteractions))),
        place: placeFor(entry),
        socialOutcome: socialOutcomeFor(entry),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const total = items.length;
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0);
  const distanceMiles = roundDistance(items.reduce((sum, item) => sum + item.distanceMiles, 0));
  const dogInteractions = items.reduce((sum, item) => sum + item.dogInteractions, 0);
  const percent = targetMinutes > 0 ? Math.min(100, Math.round((totalMinutes / targetMinutes) * 100)) : 0;
  const status: WalkActivityStatus = total === 0 ? "needs-walk" : percent >= 100 ? "active" : "light";
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));
  const places = Array.from(new Set(items.map((item) => item.place).filter(Boolean)));

  return {
    items,
    total,
    totalMinutes,
    distanceMiles,
    dogInteractions,
    targetMinutes,
    percent,
    status,
    summary:
      total === 0
        ? "No walks logged today"
        : `${total} ${total === 1 ? "walk" : "walks"} today - ${minutesLabel(totalMinutes)}, ${interactionsLabel(dogInteractions)}`,
    nextStep:
      total === 0
        ? "Log the walk when Phoenix gets outside so the household can see activity and recovery context."
        : dogInteractions > 0 || places.length > 0
          ? "Keep noting routes, duration, and social outcomes so sitters and trainers can spot patterns."
          : "Add route or dog-interaction notes when they matter for handoff context.",
    caregivers,
    places,
    last: items[0] ?? null,
  };
}
