import type { CareTwinQaReview, CareTwinQaReviewStatus } from "./careTwinQaReport.ts";
import type {
  MobileReleaseQaReview,
  MobileReleaseQaReviewStatus,
} from "./mobileReleaseQa.ts";
import type { QaScreenshotEvidence } from "./qaScreenshotEvidence.ts";
import { cleanQaScreenshotEvidence } from "./qaScreenshotEvidence.ts";

export const MOBILE_QA_SESSION_STORAGE_KEY = "woofwatcher.mobileReleaseQaSession.v1";

export interface MobileQaSessionInput {
  careTwinStatusById: Record<string, CareTwinQaReviewStatus>;
  careTwinNotes: Record<string, string>;
  careTwinEvidenceById: Record<string, QaScreenshotEvidence[]>;
  surfaceStatusById: Record<string, MobileReleaseQaReviewStatus>;
  surfaceNotes: Record<string, string>;
  surfaceEvidenceById: Record<string, QaScreenshotEvidence[]>;
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
    .concat(Object.keys(input.careTwinEvidenceById))
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .sort()
    .map<CareTwinQaReview | null>((scenarioId) => {
      const status = input.careTwinStatusById[scenarioId] ?? "unreviewed";
      const note = cleanNote(input.careTwinNotes[scenarioId]);
      const screenshotEvidence = cleanQaScreenshotEvidence(
        input.careTwinEvidenceById[scenarioId],
        `${scenarioId}-qa-screenshot.png`,
      );
      if (status === "unreviewed" && !note && screenshotEvidence.length === 0) return null;
      return {
        scenarioId,
        status,
        note,
        ...(screenshotEvidence.length ? { screenshotEvidence } : {}),
      };
    })
    .filter((review): review is CareTwinQaReview => !!review);

  const releaseReviews = uniqueKeys(input.surfaceStatusById, input.surfaceNotes)
    .concat(Object.keys(input.surfaceEvidenceById))
    .filter((key, index, keys) => keys.indexOf(key) === index)
    .sort()
    .map<MobileReleaseQaReview | null>((surfaceId) => {
      const status = input.surfaceStatusById[surfaceId] ?? "unreviewed";
      const note = cleanNote(input.surfaceNotes[surfaceId]);
      const screenshotEvidence = cleanQaScreenshotEvidence(
        input.surfaceEvidenceById[surfaceId],
        `${surfaceId}-qa-screenshot.png`,
      );
      if (status === "unreviewed" && !note && screenshotEvidence.length === 0) return null;
      return {
        surfaceId,
        status,
        note,
        ...(screenshotEvidence.length ? { screenshotEvidence } : {}),
      };
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
  const careTwinEvidenceById: Record<string, QaScreenshotEvidence[]> = {};
  const surfaceStatusById: Record<string, MobileReleaseQaReviewStatus> = {};
  const surfaceNotes: Record<string, string> = {};
  const surfaceEvidenceById: Record<string, QaScreenshotEvidence[]> = {};

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
      const screenshotEvidence = cleanQaScreenshotEvidence(
        candidate.screenshotEvidence,
        `${scenarioId}-qa-screenshot.png`,
      );
      if (screenshotEvidence.length) careTwinEvidenceById[scenarioId] = screenshotEvidence;
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
      const screenshotEvidence = cleanQaScreenshotEvidence(
        candidate.screenshotEvidence,
        `${surfaceId}-qa-screenshot.png`,
      );
      if (screenshotEvidence.length) surfaceEvidenceById[surfaceId] = screenshotEvidence;
    }
  }

  return {
    careTwinStatusById,
    careTwinNotes,
    careTwinEvidenceById,
    surfaceStatusById,
    surfaceNotes,
    surfaceEvidenceById,
    savedAtIso: typeof data.savedAtIso === "string" ? data.savedAtIso : undefined,
  };
}
