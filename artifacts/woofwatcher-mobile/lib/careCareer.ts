import { normalizeCareEventType, type CareEventDetails } from "@workspace/care-domain";

/**
 * Care Career derives a Tamagotchi-style level, title, and XP progress from
 * real logged care evidence only. There is no purchasable currency and no
 * way to advance without actual care logs, which keeps the game layer inside
 * the evidence-based achievements boundary.
 */

export interface CareCareerEntryLike {
  type?: string;
  occurredAt?: string;
  details?: CareEventDetails | { [key: string]: unknown };
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

export function careXpForEntry(entry: CareCareerEntryLike): number {
  const normalized = normalizeCareEventType(
    entry.type ?? "",
    entry.details as CareEventDetails,
  );
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
