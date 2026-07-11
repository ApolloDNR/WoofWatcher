import { normalizeCareEventType, type CareEventDetails } from "@workspace/care-domain";

/**
 * Care Career derives a Tamagotchi-style level, title, and XP progress from
 * real logged care evidence only. There is no purchasable currency and no
 * way to advance without actual care logs, which keeps the game layer inside
 * the evidence-based achievements boundary.
 *
 * This care level is the ONE canonical user-facing "Lv" (Pack, More, Story
 * badges, Home's Today's Story). Adventure Mode's numbers are a separate
 * daily quest track and must always render as "Quest XP" / "Quest level" so
 * the two systems never share one vocabulary with different values.
 */

export interface CareCareerEntryLike {
  type?: string;
  occurredAt?: string;
  details?: CareEventDetails | { [key: string]: unknown } | null;
}

export interface CareCareerModel {
  /** Lifetime care XP earned from real logs. */
  totalXp: number;
  /** Current care level, starting at 1. */
  level: number;
  /** Care journey title for the current level. */
  title: string;
  /** XP earned inside the current level. */
  levelXp: number;
  /** XP needed to finish the current level. */
  levelSpanXp: number;
  /** 0..1 progress through the current level. */
  levelProgress: number;
  /** XP still needed to reach the next level. */
  xpToNextLevel: number;
  /** XP earned from logs dated today. */
  todayXp: number;
  /** Copy for the level strip, e.g. "Lv 4 Trail Scout". */
  levelLabel: string;
}

const CARE_XP_BY_TYPE: Record<string, number> = {
  meal: 15,
  walk: 20,
  potty: 8,
  water: 6,
  training: 18,
  play: 12,
  treat: 5,
  medication: 20,
  grooming: 15,
  weight: 10,
  vomit: 6,
  symptom: 6,
  incident: 10,
  alone: 8,
  mood: 6,
  note: 4,
};

const DEFAULT_EVENT_XP = 4;

/** Level titles, highest threshold first match wins. */
const CARE_TITLES: ReadonlyArray<{ level: number; title: string }> = [
  { level: 20, title: "Legendary Companion" },
  { level: 16, title: "Care Champion" },
  { level: 12, title: "Adventure Ace" },
  { level: 8, title: "Explorer Pup" },
  { level: 5, title: "Trail Scout" },
  { level: 3, title: "Steady Sidekick" },
  { level: 2, title: "Rookie Companion" },
  { level: 1, title: "New Paw" },
];

/** Walk-session entries carry `details.walkLifecycle` (see lib/walkSession). */
function isInProgressWalk(details: CareCareerEntryLike["details"]): boolean {
  if (details == null || typeof details !== "object" || Array.isArray(details)) {
    return false;
  }
  return (details as { walkLifecycle?: unknown }).walkLifecycle === "in-progress";
}

export function careXpForEntry(entry: CareCareerEntryLike): number {
  const normalized = normalizeCareEventType(
    entry.type ?? "",
    entry.details as CareEventDetails,
  );
  // Walk XP lands only when the walk finishes, matching the shared
  // adventure lib's completion semantics. An in-progress session is not
  // yet care evidence, so it earns nothing until it completes.
  if (normalized === "walk" && isInProgressWalk(entry.details)) return 0;
  return CARE_XP_BY_TYPE[normalized] ?? DEFAULT_EVENT_XP;
}

/** XP required to move from `level` to `level + 1`. Grows linearly. */
export function careLevelSpanXp(level: number): number {
  return 100 + Math.max(0, level - 1) * 50;
}

export function careTitleForLevel(level: number): string {
  for (const step of CARE_TITLES) {
    if (level >= step.level) return step.title;
  }
  return CARE_TITLES[CARE_TITLES.length - 1].title;
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Consecutive days with at least one real care log, counting back from
 * today. A day with no logs yet does not break the streak until it ends,
 * so a streak held through yesterday still shows this morning.
 */
export function deriveCareStreak(
  entries: readonly CareCareerEntryLike[],
  now: number,
): number {
  const loggedDays = new Set<string>();
  for (const entry of entries) {
    const occurred = Date.parse(entry.occurredAt ?? "");
    if (!Number.isFinite(occurred) || occurred > now) continue;
    loggedDays.add(localDayKey(new Date(occurred)));
  }
  if (loggedDays.size === 0) return 0;

  const cursor = new Date(now);
  if (!loggedDays.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!loggedDays.has(localDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (loggedDays.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface CareerWeekModel {
  /** Real care logs in the trailing 7 days. */
  logsThisWeek: number;
  /** Distinct local days with at least one log in that window. */
  activeDays: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function deriveCareerWeek(
  entries: readonly CareCareerEntryLike[],
  now: number,
): CareerWeekModel {
  const dayKeys = new Set<string>();
  let logsThisWeek = 0;
  for (const entry of entries) {
    const occurred = Date.parse(entry.occurredAt ?? "");
    if (!Number.isFinite(occurred) || occurred > now) continue;
    if (occurred < now - WEEK_MS) continue;
    logsThisWeek += 1;
    dayKeys.add(localDayKey(new Date(occurred)));
  }
  return { logsThisWeek, activeDays: Math.min(7, dayKeys.size) };
}

export function deriveCareCareer(
  entries: readonly CareCareerEntryLike[],
  now: number,
): CareCareerModel {
  let totalXp = 0;
  let todayXp = 0;
  for (const entry of entries) {
    const occurredAt = entry.occurredAt ?? "";
    const occurred = Date.parse(occurredAt);
    if (!Number.isFinite(occurred) || occurred > now) continue;
    const xp = careXpForEntry(entry);
    totalXp += xp;
    if (isSameLocalDay(occurredAt, now)) todayXp += xp;
  }

  let level = 1;
  let remaining = totalXp;
  while (remaining >= careLevelSpanXp(level)) {
    remaining -= careLevelSpanXp(level);
    level += 1;
  }

  const levelSpanXp = careLevelSpanXp(level);
  const levelXp = remaining;
  const title = careTitleForLevel(level);

  return {
    totalXp,
    level,
    title,
    levelXp,
    levelSpanXp,
    levelProgress: Math.max(0, Math.min(1, levelXp / levelSpanXp)),
    xpToNextLevel: levelSpanXp - levelXp,
    todayXp,
    levelLabel: `Lv ${level} ${title}`,
  };
}
