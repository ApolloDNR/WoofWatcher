import { normalizeCareEventType, type CareEventDetails } from "./events.ts";

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
  caregiver?: string | null;
  context?: string | null;
}

export interface MoodTrendPeriodInput {
  entries: readonly MoodTrendEntry[];
  periods: readonly {
    label: string;
    lookbackDays: number;
  }[];
  now?: number;
  selectedLookbackDays?: number;
  limit?: number;
  caregiver?: string | null;
  context?: string | null;
}

export interface MoodTrendPeriodSummary {
  label: string;
  lookbackDays: number;
  isSelected: boolean;
  trend: MoodTrend;
}

export interface MoodTrendSparklineInput extends MoodTrendInput {
  bucketCount?: number;
}

export interface MoodTrendSparklineBucket {
  index: number;
  label: string;
  count: number;
  averageScore: number;
  watchCount: number;
  tone: "empty" | "good" | "steady" | "watch";
}

export interface MoodEnergyReportSnapshotInput extends MoodTrendInput {
  dogName?: string | null;
}

export interface MoodEnergyReportSnapshot {
  available: boolean;
  total: number;
  averageLabel: string;
  status: MoodTrendStatus;
  statusLabel: string;
  summaryLine: string;
  energyLine: string;
  latestLine: string;
  boundaryLine: string;
  shareLines: string[];
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
  contexts: string[];
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

function asObject(value: CareEventDetails): Record<string, unknown> {
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
  if (watchCount > 0 || latest?.tone === "watch" || latest?.tone === "alert" || latest?.energyLevel === "low") return "watch";
  return "steady";
}

function summaryFor(total: number, averageScore: number, status: MoodTrendStatus): string {
  if (total === 0) {
    return "No shared mood check-ins yet.";
  }
  const tone = status === "watch" ? "with something worth watching" : "with a steady pattern";
  return `${total} shared mood check-ins, ${averageScore.toFixed(1)}/5 average ${tone}.`;
}

function nextStepFor(status: MoodTrendStatus, latest: MoodTrendItem | null): string {
  if (status === "needs-log") {
    return "Log the next mood with energy and care context so the household can connect feelings to food, visitors, walks, rest, and routines.";
  }
  if (latest?.context) {
    return `Latest context: ${latest.context}. Keep logging energy and routine changes so patterns stay reviewable without guessing.`;
  }
  if (status === "watch") {
    return "Add context to the next mood check-in and consider sharing the pattern with a vet or trainer if low energy or anxious behavior continues.";
  }
  return "Keep quick mood check-ins going so Phoenix's care twin and household reports reflect real daily patterns.";
}

function statusLabelFor(status: MoodTrendStatus): string {
  if (status === "watch") return "Worth watching";
  if (status === "steady") return "Steady";
  return "Needs check-in";
}

export function deriveMoodTrend(input: MoodTrendInput): MoodTrend {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 30;
  const limit = input.limit ?? 5;
  const caregiverFilter = clean(input.caregiver).toLowerCase();
  const contextFilter = clean(input.context).toLowerCase();
  const items = input.entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "mood")
    .filter(isVisible)
    .filter((entry) => isInLookback(entry.occurredAt, now, lookbackDays))
    .map((entry, index): MoodTrendItem | null => {
      const mood = clean(entry.mood ?? asObject(entry.details).mood).toLowerCase();
      const meta = MOOD_META[mood];
      if (!meta) return null;
      const details = asObject(entry.details);
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
    .filter((item) => !caregiverFilter || item.caregiver.toLowerCase() === caregiverFilter)
    .filter((item) => !contextFilter || item.context.toLowerCase() === contextFilter)
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
  const contexts = Array.from(new Set(items.map((item) => item.context).filter(Boolean)));
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
    contexts,
    status,
    summary: summaryFor(total, averageScore, status),
    nextStep: nextStepFor(status, latest),
    latest,
  };
}

export function deriveMoodEnergyReportSnapshot(input: MoodEnergyReportSnapshotInput): MoodEnergyReportSnapshot {
  const trend = deriveMoodTrend({
    ...input,
    limit: input.limit ?? 4,
  });
  const boundaryLine = "Owner-reported mood and energy context only; not a diagnosis or emergency triage.";
  const averageLabel = trend.total ? `${trend.averageScore.toFixed(1)}/5` : "No shared check-ins";
  const statusLabel = statusLabelFor(trend.status);
  const energyLine = `Energy: ${trend.energy.low} low, ${trend.energy.steady} steady, ${trend.energy.high} high.`;
  const latestLine = trend.latest
    ? `Latest: ${trend.latest.moodLabel}${trend.latest.energyLevel ? ` with ${trend.latest.energyLevel} energy` : ""} by ${trend.latest.caregiver}${trend.latest.context ? ` after ${trend.latest.context}` : ""}.`
    : "Latest: No shared mood check-in yet.";
  const summaryLine = trend.total
    ? `Mood & Energy snapshot: ${trend.summary}`
    : `Mood & Energy snapshot: No shared mood check-ins in the last ${input.lookbackDays ?? 30} days.`;
  const shareLines = trend.total > 0 ? [summaryLine, energyLine, latestLine, boundaryLine] : [];

  return {
    available: trend.total > 0,
    total: trend.total,
    averageLabel,
    status: trend.status,
    statusLabel,
    summaryLine,
    energyLine,
    latestLine,
    boundaryLine,
    shareLines,
  };
}

export function deriveMoodTrendPeriods(input: MoodTrendPeriodInput): MoodTrendPeriodSummary[] {
  const selectedLookbackDays = input.selectedLookbackDays ?? input.periods[0]?.lookbackDays ?? 30;

  return input.periods.map((period) => ({
    label: period.label,
    lookbackDays: period.lookbackDays,
    isSelected: period.lookbackDays === selectedLookbackDays,
    trend: deriveMoodTrend({
      entries: input.entries,
      now: input.now,
      lookbackDays: period.lookbackDays,
      limit: input.limit,
      caregiver: input.caregiver,
      context: input.context,
    }),
  }));
}

function sparklineBucketLabel(index: number, bucketCount: number, bucketDays: number): string {
  if (index === bucketCount - 1) return "Now";
  const weeksAgo = Math.max(1, Math.round(((bucketCount - index) * bucketDays) / 7));
  return `${weeksAgo}w ago`;
}

export function deriveMoodTrendSparkline(input: MoodTrendSparklineInput): MoodTrendSparklineBucket[] {
  const now = input.now ?? Date.now();
  const lookbackDays = input.lookbackDays ?? 30;
  const bucketCount = Math.max(1, Math.floor(input.bucketCount ?? 6));
  const bucketDays = lookbackDays / bucketCount;
  const trend = deriveMoodTrend({
    ...input,
    now,
    lookbackDays,
    limit: Math.max(input.entries.length, input.limit ?? 0, 1),
  });
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    index,
    label: sparklineBucketLabel(index, bucketCount, bucketDays),
    items: [] as MoodTrendItem[],
  }));

  for (const item of trend.items) {
    const occurredAt = new Date(item.occurredAt).getTime();
    const ageDays = (now - occurredAt) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > lookbackDays) continue;
    const rawIndex = Math.floor((lookbackDays - ageDays) / bucketDays);
    const index = Math.min(bucketCount - 1, Math.max(0, rawIndex));
    buckets[index]?.items.push(item);
  }

  return buckets.map((bucket): MoodTrendSparklineBucket => {
    const count = bucket.items.length;
    const averageScore = count ? bucket.items.reduce((sum, item) => sum + item.score, 0) / count : 0;
    const watchCount = bucket.items.filter((item) => item.tone !== "good" || item.energyLevel === "low").length;
    const tone: MoodTrendSparklineBucket["tone"] =
      count === 0 ? "empty" : watchCount > 0 || averageScore < 3.5 ? "watch" : averageScore >= 4.5 ? "good" : "steady";

    return {
      index: bucket.index,
      label: bucket.label,
      count,
      averageScore,
      watchCount,
      tone,
    };
  });
}
