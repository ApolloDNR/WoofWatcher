import type { CareTwinQaReview, CareTwinQaReviewStatus } from "./careTwinQaReport.ts";
import type {
  MobileReleaseQaReview,
  MobileReleaseQaReviewStatus,
} from "./mobileReleaseQa.ts";
import type { QaScreenshotEvidence } from "./qaScreenshotEvidence.ts";
import { cleanQaScreenshotEvidence } from "./qaScreenshotEvidence.ts";

export { MOBILE_QA_SESSION_STORAGE_KEY } from "./devicePreferences.ts";

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

export interface MobileQaSessionHydrationTicket {
  readonly generation: number;
  readonly editRevision: number;
}

export type MobileQaSessionHydrationApplyResult = "applied" | "stale";
export type MobileQaSessionAutosaveDecision = "suppress-hydration" | "save";

export interface MobileQaSessionPersistenceGate {
  beginHydration(): Readonly<MobileQaSessionHydrationTicket>;
  isHydrationCurrent(
    ticket: Readonly<MobileQaSessionHydrationTicket>,
  ): boolean;
  markRealEdit(): void;
  applyHydrationIfCurrent(
    ticket: Readonly<MobileQaSessionHydrationTicket>,
    state: MobileQaSessionState,
    apply: (state: MobileQaSessionState) => void,
  ): MobileQaSessionHydrationApplyResult;
  consumeAutosaveDecision(
    input: MobileQaSessionInput,
  ): MobileQaSessionAutosaveDecision;
}

export interface MobileQaSessionSaveQueue {
  save(value: string, write: (value: string) => Promise<void>): Promise<void>;
  isPending(): boolean;
}

export interface MobileQaSessionProofSummary {
  totalReviews: number;
  passed: number;
  needsTune: number;
  unreviewed: number;
  notes: number;
  evidenceFiles: number;
  iosEvidence: number;
  androidEvidence: number;
  webEvidence: number;
  unknownEvidence: number;
}

export interface MobileQaSessionProofManifest {
  version: 1;
  proofId: string;
  generatedAtIso: string;
  savedAtIso: string;
  careTwin: MobileQaSessionProofSummary;
  release: MobileQaSessionProofSummary;
  totalEvidenceFiles: number;
  platformEvidenceLabel: string;
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function copyEvidenceById(
  source: Readonly<Record<string, readonly QaScreenshotEvidence[]>>,
): Record<string, QaScreenshotEvidence[]> {
  return Object.fromEntries(
    Object.entries(source).map(([id, evidence]) => [
      id,
      evidence.map((item) => ({ ...item })),
    ]),
  );
}

function copyMobileQaSessionState(
  state: MobileQaSessionState,
): MobileQaSessionState {
  return {
    careTwinStatusById: { ...state.careTwinStatusById },
    careTwinNotes: { ...state.careTwinNotes },
    careTwinEvidenceById: copyEvidenceById(state.careTwinEvidenceById),
    surfaceStatusById: { ...state.surfaceStatusById },
    surfaceNotes: { ...state.surfaceNotes },
    surfaceEvidenceById: copyEvidenceById(state.surfaceEvidenceById),
    savedAtIso: state.savedAtIso,
  };
}

function mobileQaSessionContentSignature(input: MobileQaSessionInput): string {
  return stableStringify({
    careTwinStatusById: input.careTwinStatusById,
    careTwinNotes: input.careTwinNotes,
    careTwinEvidenceById: input.careTwinEvidenceById,
    surfaceStatusById: input.surfaceStatusById,
    surfaceNotes: input.surfaceNotes,
    surfaceEvidenceById: input.surfaceEvidenceById,
  });
}

export function createEmptyMobileQaSessionState(): MobileQaSessionState {
  return {
    careTwinStatusById: {},
    careTwinNotes: {},
    careTwinEvidenceById: {},
    surfaceStatusById: {},
    surfaceNotes: {},
    surfaceEvidenceById: {},
  };
}

export function createMobileQaSessionPersistenceGate(): MobileQaSessionPersistenceGate {
  let generation = 0;
  let editRevision = 0;
  let hydratedContentSignature: string | null = null;

  const isHydrationCurrent = (
    ticket: Readonly<MobileQaSessionHydrationTicket>,
  ) =>
    ticket.generation === generation &&
    ticket.editRevision === editRevision;

  return {
    beginHydration() {
      generation += 1;
      return Object.freeze({ generation, editRevision });
    },
    isHydrationCurrent,
    markRealEdit() {
      editRevision += 1;
      hydratedContentSignature = null;
    },
    applyHydrationIfCurrent(ticket, state, apply) {
      if (!isHydrationCurrent(ticket)) return "stale";
      const copiedState = copyMobileQaSessionState(state);
      hydratedContentSignature = mobileQaSessionContentSignature(copiedState);
      apply(copiedState);
      return "applied";
    },
    consumeAutosaveDecision(input) {
      const expectedSignature = hydratedContentSignature;
      hydratedContentSignature = null;
      return expectedSignature !== null &&
        expectedSignature === mobileQaSessionContentSignature(input)
        ? "suppress-hydration"
        : "save";
    },
  };
}

export function createMobileQaSessionSaveQueue(): MobileQaSessionSaveQueue {
  let tail: Promise<void> = Promise.resolve();
  let pending = 0;

  return Object.freeze({
    save(value: string, write: (value: string) => Promise<void>) {
      pending += 1;
      const operation = tail.then(() => write(value));
      const settled = operation.finally(() => {
        pending = Math.max(0, pending - 1);
      });
      tail = settled.catch(() => undefined);
      return settled;
    },
    isPending() {
      return pending > 0;
    },
  });
}

function proofFingerprint(snapshot: MobileQaSessionSnapshot): string {
  const source = stableStringify({
    version: snapshot.version,
    savedAtIso: snapshot.savedAtIso,
    careTwinReviews: snapshot.careTwinReviews,
    releaseReviews: snapshot.releaseReviews,
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `wwqa-${hash.toString(36)}`;
}

function summarizeProofReviews(
  reviews: readonly (CareTwinQaReview | MobileReleaseQaReview)[],
): MobileQaSessionProofSummary {
  const evidence = reviews.flatMap((review) => review.screenshotEvidence ?? []);
  return {
    totalReviews: reviews.length,
    passed: reviews.filter((review) => review.status === "pass").length,
    needsTune: reviews.filter((review) => review.status === "needs-review").length,
    unreviewed: reviews.filter((review) => review.status === "unreviewed").length,
    notes: reviews.filter((review) => Boolean(review.note?.trim())).length,
    evidenceFiles: evidence.length,
    iosEvidence: evidence.filter((item) => item.targetPlatform === "ios").length,
    androidEvidence: evidence.filter((item) => item.targetPlatform === "android").length,
    webEvidence: evidence.filter((item) => item.targetPlatform === "web").length,
    unknownEvidence: evidence.filter((item) => item.targetPlatform === "unknown").length,
  };
}

function evidenceWord(value: number): string {
  return `${value} evidence file${value === 1 ? "" : "s"}`;
}

function proofLine(label: string, summary: MobileQaSessionProofSummary): string {
  return `${label}: ${summary.passed} pass, ${summary.needsTune} needs tune, ${evidenceWord(summary.evidenceFiles)}, ${summary.notes} notes.`;
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

export function buildPersistedMobileQaSessionSnapshot(
  input: MobileQaSessionInput,
  savedAtIso: string | undefined,
): MobileQaSessionSnapshot | null {
  if (!savedAtIso) return null;
  const savedAt = new Date(savedAtIso);
  if (
    Number.isNaN(savedAt.getTime()) ||
    savedAt.toISOString() !== savedAtIso
  ) {
    return null;
  }
  return buildMobileQaSessionSnapshot(input, savedAtIso);
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

export function buildMobileQaSessionProofManifest(
  snapshot: MobileQaSessionSnapshot,
  generatedAtIso = new Date().toISOString(),
): MobileQaSessionProofManifest {
  const careTwin = summarizeProofReviews(snapshot.careTwinReviews);
  const release = summarizeProofReviews(snapshot.releaseReviews);
  const iosEvidence = careTwin.iosEvidence + release.iosEvidence;
  const androidEvidence = careTwin.androidEvidence + release.androidEvidence;
  const webEvidence = careTwin.webEvidence + release.webEvidence;
  const unknownEvidence = careTwin.unknownEvidence + release.unknownEvidence;

  return {
    version: 1,
    proofId: proofFingerprint(snapshot),
    generatedAtIso,
    savedAtIso: snapshot.savedAtIso,
    careTwin,
    release,
    totalEvidenceFiles: careTwin.evidenceFiles + release.evidenceFiles,
    platformEvidenceLabel: `manual self-attested tags: iOS ${iosEvidence}, Android ${androidEvidence}, Web ${webEvidence}, Unknown ${unknownEvidence}`,
  };
}

export function buildMobileQaSessionProofManifestShareText(
  manifest: MobileQaSessionProofManifest,
): string {
  return [
    "WoofWatcher QA Evidence Manifest",
    `Manifest ID: ${manifest.proofId}`,
    `Generated: ${manifest.generatedAtIso}`,
    `Saved session: ${manifest.savedAtIso}`,
    proofLine("Care twin", manifest.careTwin),
    proofLine("Release", manifest.release),
    `Attachment metadata: ${manifest.platformEvidenceLabel}.`,
    `Total attached evidence: ${evidenceWord(manifest.totalEvidenceFiles)}.`,
    "Boundary: Photos-library attachments are manual self-attested metadata. This manifest is not bound to an exact binary or device, cannot close iOS/Android release gates, and does not prove store approval, provider-backed storage, live AI, payments, push notifications, generated PDF output, or public launch readiness.",
  ].join("\n");
}
