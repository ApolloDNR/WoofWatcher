import type { CareTwinQaReview, CareTwinQaReviewStatus } from "./careTwinQaReport.ts";
import type {
  MobileReleaseQaReview,
  MobileReleaseQaReviewStatus,
} from "./mobileReleaseQa.ts";

export const MOBILE_QA_SESSION_STORAGE_KEY = "woofwatcher.mobileReleaseQaSession.v1";

export interface MobileQaSessionInput {
  careTwinStatusById: Record<string, CareTwinQaReviewStatus>;
  careTwinNotes: Record<string, string>;
  surfaceStatusById: Record<string, MobileReleaseQaReviewStatus>;
  surfaceNotes: Record<string, string>;
}

export interface MobileQaSessionSnapshot {
  version: 1;
  savedAtIso: string;
  careTwinReviews: CareTwinQaReview[];
  releaseReviews: MobileReleaseQaReview[];
}

export interface MobileQaSessionState extends MobileQaSessionInput {
  savedAtIso?: string;
}

function isCareTwinStatus(value: unknown): value is CareTwinQaReviewStatus {
  return value === "unreviewed" || value === "pass" || value === "needs-review";
}

function isReleaseStatus(value: unknown): value is MobileReleaseQaReviewStatus {
  return value === "unreviewed" || value === "pass" || value === "needs-review";
}

function uniqueKeys(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): string[] {
  return Array.from(new Set([...Object.keys(first), ...Object.keys(second)])).sort();
}

function cleanNote(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function buildMobileQaSessionSnapshot(
  input: MobileQaSessionInput,
  savedAtIso = new Date().toISOString(),
): MobileQaSessionSnapshot {
  const careTwinReviews = uniqueKeys(input.careTwinStatusById, input.careTwinNotes)
    .map<CareTwinQaReview | null>((scenarioId) => {
      const status = input.careTwinStatusById[scenarioId] ?? "unreviewed";
      const note = cleanNote(input.careTwinNotes[scenarioId]);
      if (status === "unreviewed" && !note) return null;
      return { scenarioId, status, note };
    })
    .filter((review): review is CareTwinQaReview => !!review);

  const releaseReviews = uniqueKeys(input.surfaceStatusById, input.surfaceNotes)
    .map<MobileReleaseQaReview | null>((surfaceId) => {
      const status = input.surfaceStatusById[surfaceId] ?? "unreviewed";
      const note = cleanNote(input.surfaceNotes[surfaceId]);
      if (status === "unreviewed" && !note) return null;
      return { surfaceId, status, note };
    })
    .filter((review): review is MobileReleaseQaReview => !!review);

  return {
    version: 1,
    savedAtIso,
    careTwinReviews,
    releaseReviews,
  };
}

export function parseMobileQaSessionSnapshot(raw: string | null): MobileQaSessionState | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as Partial<MobileQaSessionSnapshot>;
  const careTwinStatusById: Record<string, CareTwinQaReviewStatus> = {};
  const careTwinNotes: Record<string, string> = {};
  const surfaceStatusById: Record<string, MobileReleaseQaReviewStatus> = {};
  const surfaceNotes: Record<string, string> = {};

  if (Array.isArray(data.careTwinReviews)) {
    for (const review of data.careTwinReviews) {
      if (!review || typeof review !== "object") continue;
      const candidate = review as Partial<CareTwinQaReview>;
      if (typeof candidate.scenarioId !== "string" || !candidate.scenarioId.trim()) continue;
      if (!isCareTwinStatus(candidate.status)) continue;
      const scenarioId = candidate.scenarioId.trim();
      careTwinStatusById[scenarioId] = candidate.status;
      const note = cleanNote(candidate.note);
      if (note) careTwinNotes[scenarioId] = note;
    }
  }

  if (Array.isArray(data.releaseReviews)) {
    for (const review of data.releaseReviews) {
      if (!review || typeof review !== "object") continue;
      const candidate = review as Partial<MobileReleaseQaReview>;
      if (typeof candidate.surfaceId !== "string" || !candidate.surfaceId.trim()) continue;
      if (!isReleaseStatus(candidate.status)) continue;
      const surfaceId = candidate.surfaceId.trim();
      surfaceStatusById[surfaceId] = candidate.status;
      const note = cleanNote(candidate.note);
      if (note) surfaceNotes[surfaceId] = note;
    }
  }

  return {
    careTwinStatusById,
    careTwinNotes,
    surfaceStatusById,
    surfaceNotes,
    savedAtIso: typeof data.savedAtIso === "string" ? data.savedAtIso : undefined,
  };
}
