import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { resolvePetName } from "./pet-identity.ts";

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
  /**
   * Display name used in owner-facing copy (nextStep). Resolved through
   * resolvePetName so renamed dogs never see "Phoenix" in Care Pass or
   * app surfaces; omitted/placeholder names keep the neutral production name.
   */
  petName?: string | null;
}

export interface WalkRouteTemplateInput {
  entries: readonly WalkActivityEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
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

export type WalkRouteSuggestedUse =
  | "Reliable routine route"
  | "Social practice route"
  | "Long reset route"
  | "Saved route";

export interface WalkRouteTemplate {
  id: string;
  name: string;
  visits: number;
  totalMinutes: number;
  averageMinutes: number;
  distanceMiles: number;
  averageDistanceMiles: number;
  dogInteractions: number;
  latestAt: string;
  latestCaregiver: string;
  caregivers: string[];
  socialOutcomes: string[];
  notes: string[];
  suggestedUse: WalkRouteSuggestedUse;
  handoff: string;
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

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
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

function dogInteractionCountLabel(count: number): string {
  return `${count} dog ${count === 1 ? "interaction" : "interactions"}`;
}

function routeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `route_${slug}` : "route_saved";
}

function visitLabel(count: number): string {
  return `${count} ${count === 1 ? "visit" : "visits"}`;
}

function addUnique(list: string[], value: string): void {
  if (value && !list.includes(value)) list.push(value);
}

function routeSuggestedUse(template: Pick<WalkRouteTemplate, "visits" | "averageMinutes" | "dogInteractions" | "socialOutcomes">): WalkRouteSuggestedUse {
  if (template.dogInteractions >= 3 || (template.dogInteractions >= 2 && template.socialOutcomes.length > 0)) return "Social practice route";
  if (template.visits >= 2) return "Reliable routine route";
  if (template.averageMinutes >= 35) return "Long reset route";
  return "Saved route";
}

export function deriveWalkActivity(input: WalkActivityInput): WalkActivity {
  const now = input.now ?? Date.now();
  const targetMinutes = input.targetMinutes ?? 45;
  const petName = resolvePetName(input.petName);
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
        ? `Log the walk when ${petName} gets outside so the household can see activity and recovery context.`
        : dogInteractions > 0 || places.length > 0
          ? "Keep noting routes, duration, and social outcomes so sitters and trainers can spot patterns."
          : "Add route or dog-interaction notes when they matter for handoff context.",
    caregivers,
    places,
    last: items[0] ?? null,
  };
}

export function deriveWalkRouteTemplates(input: WalkRouteTemplateInput): WalkRouteTemplate[] {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 90;
  const limit = input.limit ?? 4;
  const candidates = input.entries
    .filter(isWalk)
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index) => {
      const details = asObject(entry.details);
      return {
        id: clean(entry.id) || `walk_${index}`,
        name: placeFor(entry),
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        occurredTime: new Date(clean(entry.occurredAt)).getTime(),
        durationMinutes: Math.max(0, Math.round(asNumber(entry.durationMinutes ?? details.durationMinutes))),
        distanceMiles: roundDistance(Math.max(0, asNumber(details.distanceMiles ?? details.distance ?? details.miles))),
        dogInteractions: Math.max(0, Math.round(asNumber(entry.dogInteractions ?? details.dogInteractions))),
        socialOutcome: socialOutcomeFor(entry),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .filter((item) => item.name)
    .sort((a, b) => b.occurredTime - a.occurredTime);

  const groups = new Map<
    string,
    {
      name: string;
      visits: number;
      totalMinutes: number;
      distanceMiles: number;
      dogInteractions: number;
      latestAt: string;
      latestCaregiver: string;
      latestTime: number;
      caregivers: string[];
      socialOutcomes: string[];
      notes: string[];
    }
  >();

  for (const item of candidates) {
    const key = item.name.toLowerCase();
    const group =
      groups.get(key) ??
      {
        name: item.name,
        visits: 0,
        totalMinutes: 0,
        distanceMiles: 0,
        dogInteractions: 0,
        latestAt: item.occurredAt,
        latestCaregiver: item.caregiver,
        latestTime: item.occurredTime,
        caregivers: [],
        socialOutcomes: [],
        notes: [],
      };

    group.visits += 1;
    group.totalMinutes += item.durationMinutes;
    group.distanceMiles = roundDistance(group.distanceMiles + item.distanceMiles);
    group.dogInteractions += item.dogInteractions;
    if (item.occurredTime >= group.latestTime) {
      group.latestAt = item.occurredAt;
      group.latestCaregiver = item.caregiver;
      group.latestTime = item.occurredTime;
      group.name = item.name;
    }
    addUnique(group.caregivers, item.caregiver);
    addUnique(group.socialOutcomes, item.socialOutcome);
    addUnique(group.notes, item.note);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .map((group): WalkRouteTemplate => {
      const averageMinutes = group.visits > 0 ? Math.round(group.totalMinutes / group.visits) : 0;
      const averageDistanceMiles = group.visits > 0 ? roundDistance(group.distanceMiles / group.visits) : 0;
      const base = {
        id: routeId(group.name),
        name: group.name,
        visits: group.visits,
        totalMinutes: group.totalMinutes,
        averageMinutes,
        distanceMiles: roundDistance(group.distanceMiles),
        averageDistanceMiles,
        dogInteractions: group.dogInteractions,
        latestAt: group.latestAt,
        latestCaregiver: group.latestCaregiver,
        caregivers: group.caregivers,
        socialOutcomes: group.socialOutcomes.slice(0, 3),
        notes: group.notes.slice(0, 3),
      };
      const suggestedUse = routeSuggestedUse(base);
      return {
        ...base,
        suggestedUse,
        handoff: `${group.name}: ${visitLabel(group.visits)}, ${averageMinutes}m avg, ${dogInteractionCountLabel(group.dogInteractions)}. ${suggestedUse}.`,
      };
    })
    .sort((a, b) => b.visits - a.visits || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime() || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit));
}
