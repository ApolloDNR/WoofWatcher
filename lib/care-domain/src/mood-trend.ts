import { normalizeCareEventType, type CareEventDetails } from "./events.ts";
import { resolvePetName } from "./pet-identity.ts";

export type MoodTrendStatus = "needs-log" | "steady" | "watch";
export type MoodEnergyLevel = "low" | "steady" | "high";

export interface MoodTrendEntry {
  id?: string | null;
  type?: string | null;
  title?: string | null;
  caregiver?: string | null;
  occurredAt?: string | null;
  mood?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface MoodTrendInput {
  entries: readonly MoodTrendEntry[];
  now?: number;
  lookbackDays?: number;
  limit?: number;
  /** Display name for owner-facing copy; resolved via resolvePetName so renamed dogs never read "Phoenix". */
  petName?: string | null;
}

export interface MoodTrendBar {
  key: string;
  label: string;
  score: number;
  tone: "good" | "watch" | "alert";
  count: number;
}

export interface MoodTrendItem {
  id: string;
  label: string;
  caregiver: string;
  occurredAt: string;
  mood: string;
  moodLabel: string;
  score: number;
  tone: "good" | "watch" | "alert";
  energyLevel: MoodEnergyLevel | null;
  context: string;
  note: string;
}

export interface MoodTrend {
  items: MoodTrendItem[];
  total: number;
  averageScore: number;
  bars: MoodTrendBar[];
  energy: Record<MoodEnergyLevel, number>;
  watchCount: number;
  caregivers: string[];
  status: MoodTrendStatus;
  summary: string;
  nextStep: string;
  latest: MoodTrendItem | null;
}

const MOOD_META: Record<string, { label: string; score: number; tone: "good" | "watch" | "alert" }> = {
  happy: { label: "Happy", score: 5, tone: "good" },
  excited: { label: "Excited", score: 4, tone: "good" },
  calm: { label: "Calm", score: 4, tone: "good" },
  anxious: { label: "Anxious", score: 2, tone: "watch" },
  unwell: { label: "Unwell", score: 1, tone: "alert" },
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function asObject(value: CareEventDetails | undefined): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isVisible(entry: MoodTrendEntry): boolean {
  return asObject(entry.details).householdVisible !== false;
}

function isInLookback(iso: string | null | undefined, now: number, lookbackDays: number): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time) || time > now) return false;
  return now - time <= lookbackDays * 86400000;
}

function normalizeEnergy(value: unknown): MoodEnergyLevel | null {
  const energy = clean(value).toLowerCase();
  if (["low", "tired", "sleepy", "sluggish"].includes(energy)) return "low";
  if (["high", "busy", "playful", "zoomy", "zoomies"].includes(energy)) return "high";
  if (["steady", "normal", "medium", "calm"].includes(energy)) return "steady";
  return null;
}

function statusFor(total: number, watchCount: number, latest: MoodTrendItem | null): MoodTrendStatus {
  if (total === 0) return "needs-log";
  if (watchCount > 0 || latest?.tone === "watch" || latest?.tone === "alert" || latest?.energyLevel === "low") {
    return "watch";
  }
  return "steady";
}

function summaryFor(total: number, averageScore: number, status: MoodTrendStatus): string {
  if (total === 0) return "No shared mood check-ins yet.";
  const tone = status === "watch" ? "with something worth watching" : "with a steady pattern";
  return `${total} shared mood check-ins, ${averageScore.toFixed(1)}/5 average ${tone}.`;
}

function nextStepFor(status: MoodTrendStatus, latest: MoodTrendItem | null, petName: string): string {
  if (status === "needs-log") {
    return "Log the next mood with energy and care context so the household can connect feelings to food, visitors, walks, rest, and routines.";
  }
  if (latest?.context) {
    return `Latest context: ${latest.context}. Keep logging energy and routine changes so patterns stay reviewable without guessing.`;
  }
  if (status === "watch") {
    return "Add context to the next mood check-in and consider sharing the pattern with a vet or trainer if low energy or anxious behavior continues.";
  }
  return `Keep quick mood check-ins going so ${petName}'s care twin and household reports reflect real daily patterns.`;
}

export function deriveMoodTrend(input: MoodTrendInput): MoodTrend {
  const now = input.now ?? Date.now();
  const petName = resolvePetName(input.petName);
  const lookbackDays = input.lookbackDays ?? 30;
  const limit = input.limit ?? 5;
  const items = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "mood")
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): MoodTrendItem | null => {
      const details = asObject(entry.details);
      const mood = clean(entry.mood ?? details.mood).toLowerCase();
      const meta = MOOD_META[mood];
      if (!meta) return null;
      return {
        id: clean(entry.id) || `mood_${index}`,
        label: clean(entry.title) || meta.label,
        caregiver: clean(entry.caregiver) || "Household",
        occurredAt: clean(entry.occurredAt),
        mood,
        moodLabel: meta.label,
        score: meta.score,
        tone: meta.tone,
        energyLevel: normalizeEnergy(details.energyLevel ?? details.energy),
        context: clean(details.moodContext ?? details.context ?? details.trigger),
        note: clean(details.note) || clean(entry.note),
      };
    })
    .filter((item): item is MoodTrendItem => Boolean(item))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const total = items.length;
  const averageScore = total ? items.reduce((sum, item) => sum + item.score, 0) / total : 0;
  const counts: Record<string, number> = {};
  const energy: Record<MoodEnergyLevel, number> = { low: 0, steady: 0, high: 0 };

  for (const item of items) {
    counts[item.mood] = (counts[item.mood] ?? 0) + 1;
    if (item.energyLevel) energy[item.energyLevel] += 1;
  }

  const bars = Object.keys(MOOD_META)
    .map((key) => ({ key, ...MOOD_META[key], count: counts[key] ?? 0 }))
    .filter((bar) => bar.count > 0)
    .sort((a, b) => b.count - a.count);
  const watchCount = items.filter((item) => item.tone !== "good" || item.energyLevel === "low").length;
  const caregivers = Array.from(new Set(items.map((item) => item.caregiver).filter(Boolean)));
  const latest = items[0] ?? null;
  const status = statusFor(total, watchCount, latest);

  return {
    items: items.slice(0, Math.max(0, limit)),
    total,
    averageScore,
    bars,
    energy,
    watchCount,
    caregivers,
    status,
    summary: summaryFor(total, averageScore, status),
    nextStep: nextStepFor(status, latest, petName),
    latest,
  };
}
