import type { AppFileSystem } from "./appFileSystem.ts";
import type { PersistPickedMediaResult } from "./durablePickedMedia.ts";

export interface PickedMediaAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface PickedMediaResult {
  canceled: boolean;
  assets?: readonly PickedMediaAsset[] | null;
}

export type PickedMediaLocalDataActionResult =
  | { status: "applied"; cleanupFailed: boolean }
  | { status: "rejected"; cleanupFailed: boolean }
  | { status: "canceled" }
  | { status: "revoked" }
  | {
      status: "not-saved";
      reason: Exclude<
        Extract<PersistPickedMediaResult, { ok: false }>["reason"],
        "reset-in-progress"
      >;
      cleanupFailed: boolean;
    };

export class PickedMediaLocalDataActionError extends Error {
  readonly cleanupFailed: boolean;

  constructor(error: unknown, cleanupFailed: boolean) {
    super(
      error instanceof Error
        ? error.message
        : "The selected local file could not be applied.",
    );
    this.name = "PickedMediaLocalDataActionError";
    this.cleanupFailed = cleanupFailed;
    if (error instanceof Error && error.stack) this.stack = error.stack;
  }
}

interface RunPickedMediaActionOptions {
  appFileSystem: AppFileSystem;
  pick(): Promise<PickedMediaResult>;
  filePrefix: string;
  fallbackFileName: string;
  preserveUris?: readonly (string | null | undefined)[];
  failureProtectedUris?: readonly (string | null | undefined)[];
  cleanupAfterApplyUris?: readonly (string | null | undefined)[];
  cleanupProtectedUris?: readonly (string | null | undefined)[];
  apply(input: {
    asset: PickedMediaAsset;
    fileName: string;
    uri: string;
  }): boolean | void | Promise<boolean | void>;
}

export interface PickedMediaDraft {
  readonly originalUri: string | null;
  readonly selectedUri: string | null;
  readonly stagedUris: readonly string[];
}

export function isPickedMediaDraftSettlementCurrent(input: {
  mounted: boolean;
  formOpen: boolean;
  currentSession: number;
  operationSession: number;
  currentDraft: PickedMediaDraft;
  operationDraft: PickedMediaDraft;
}): boolean {
  return (
    input.mounted &&
    input.formOpen &&
    input.currentSession === input.operationSession &&
    input.currentDraft === input.operationDraft
  );
}

export type PickedMediaReferenceReleaseResult =
  | {
      status: "complete";
      releasedUris: string[];
      skippedUris: string[];
      failedUris: [];
    }
  | {
      status: "partial-failure";
      releasedUris: string[];
      skippedUris: string[];
      failedUris: string[];
    }
  | { status: "revoked" };

interface PickedMediaEvidence {
  readonly uri: string;
}

function cleanUri(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const uri = value.trim();
  return uri.length > 0 ? uri : null;
}

function uniqueUris(
  values: readonly (string | null | undefined)[],
): string[] {
  const uris: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const uri = cleanUri(value);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    uris.push(uri);
  }
  return uris;
}

export function createPickedMediaDraft(
  originalUri?: string | null,
): PickedMediaDraft {
  const original = cleanUri(originalUri);
  return Object.freeze({
    originalUri: original,
    selectedUri: original,
    stagedUris: Object.freeze([]) as readonly string[],
  });
}

export function stagePickedMediaDraft(
  draft: PickedMediaDraft,
  selectedUri: string,
): { draft: PickedMediaDraft; supersededUris: string[] } {
  const selected = cleanUri(selectedUri);
  if (!selected) return { draft, supersededUris: [] };
  const supersededUris =
    draft.selectedUri &&
    draft.selectedUri !== draft.originalUri &&
    draft.selectedUri !== selected
      ? [draft.selectedUri]
      : [];
  const stagedUris =
    selected === draft.originalUri
      ? [...draft.stagedUris]
      : uniqueUris([...draft.stagedUris, selected]);
  return {
    draft: Object.freeze({
      originalUri: draft.originalUri,
      selectedUri: selected,
      stagedUris: Object.freeze(stagedUris),
    }),
    supersededUris,
  };
}

export function settlePickedMediaDraftRelease(
  draft: PickedMediaDraft,
  releasedUris: readonly string[],
): PickedMediaDraft {
  const released = new Set(uniqueUris(releasedUris));
  return Object.freeze({
    ...draft,
    stagedUris: Object.freeze(
      draft.stagedUris.filter((uri) => !released.has(uri)),
    ),
  });
}

export function cancelPickedMediaDraft(
  draft: PickedMediaDraft,
): { releaseUris: string[] } {
  return { releaseUris: uniqueUris(draft.stagedUris) };
}

export function commitPickedMediaDraft(
  draft: PickedMediaDraft,
): { retainedUri: string | null; releaseUris: string[] } {
  const releaseUris = uniqueUris([
    draft.selectedUri !== draft.originalUri ? draft.originalUri : null,
    ...draft.stagedUris.filter((uri) => uri !== draft.selectedUri),
  ]);
  return { retainedUri: draft.selectedUri, releaseUris };
}

export async function releasePickedMediaReferences({
  appFileSystem,
  uris,
  protectedUris = [],
}: {
  appFileSystem: AppFileSystem;
  uris: readonly (string | null | undefined)[];
  protectedUris?: readonly (string | null | undefined)[];
}): Promise<PickedMediaReferenceReleaseResult> {
  const intent = appFileSystem.captureIntent();
  if (!intent) return { status: "revoked" };

  const canonicalUri = (uri: string): string => {
    try {
      return cleanUri(appFileSystem.resolveOwnedDocumentUri(uri)) ?? uri;
    } catch {
      return uri;
    }
  };
  const protectedUriList = uniqueUris(protectedUris);
  const protectedSet = new Set(protectedUriList.map(canonicalUri));
  const targetAliases = new Map<string, string[]>();
  for (const uri of uniqueUris(uris)) {
    const target = canonicalUri(uri);
    const aliases = targetAliases.get(target);
    if (aliases) aliases.push(uri);
    else targetAliases.set(target, [uri]);
  }
  const releasedUris: string[] = [];
  const skippedUris: string[] = [];
  const failedUris: string[] = [];
  for (const [target, aliases] of targetAliases) {
    const uri = aliases[0]!;
    if (protectedSet.has(target)) {
      skippedUris.push(...aliases);
      continue;
    }
    let result: Awaited<ReturnType<AppFileSystem["discardPickedMedia"]>>;
    try {
      result = await appFileSystem.discardPickedMedia(
        intent,
        uri,
        protectedUriList,
      );
    } catch {
      if (!appFileSystem.isIntentCurrent(intent)) {
        return { status: "revoked" };
      }
      failedUris.push(...aliases);
      continue;
    }
    if (result.ok) {
      releasedUris.push(...aliases);
      continue;
    }
    if (result.reason === "reset-in-progress") {
      return { status: "revoked" };
    }
    if (result.reason === "invalid-target") {
      skippedUris.push(...aliases);
      continue;
    }
    failedUris.push(...aliases);
  }

  return failedUris.length > 0
    ? {
        status: "partial-failure",
        releasedUris,
        skippedUris,
        failedUris,
      }
    : {
        status: "complete",
        releasedUris,
        skippedUris,
        failedUris: [],
      };
}

export async function clearPickedMediaEvidence<T extends PickedMediaEvidence>({
  appFileSystem,
  evidence,
  protectedUris = [],
}: {
  appFileSystem: AppFileSystem;
  evidence: readonly T[];
  protectedUris?: readonly (string | null | undefined)[];
}): Promise<
  | {
      status: "complete" | "partial-failure";
      remainingEvidence: T[];
      clearedCount: number;
      failedCount: number;
    }
  | { status: "revoked" }
> {
  const release = await releasePickedMediaReferences({
    appFileSystem,
    uris: evidence.map((item) => item.uri),
    protectedUris,
  });
  if (release.status === "revoked") return release;

  const failed = new Set(release.failedUris);
  const remainingEvidence = evidence.filter((item) =>
    failed.has(cleanUri(item.uri) ?? ""),
  );
  return {
    status: release.status,
    remainingEvidence,
    clearedCount: evidence.length - remainingEvidence.length,
    failedCount: remainingEvidence.length,
  };
}

export async function runPickedMediaEvidenceClear<T extends PickedMediaEvidence>({
  appFileSystem,
  evidence,
  protectedUris = [],
  removeMetadata,
}: {
  appFileSystem: AppFileSystem;
  evidence: readonly T[];
  protectedUris?: readonly (string | null | undefined)[];
  removeMetadata(): Promise<"committed" | "not-committed">;
}): Promise<
  | {
      status: "complete" | "partial-failure";
      clearedCount: number;
      failedCount: number;
    }
  | { status: "not-cleared" | "revoked" }
> {
  if ((await removeMetadata()) !== "committed") {
    return { status: "not-cleared" };
  }
  const cleanup = await clearPickedMediaEvidence({
    appFileSystem,
    evidence,
    protectedUris,
  });
  if (cleanup.status === "revoked") return cleanup;
  return {
    status: cleanup.status,
    clearedCount: cleanup.clearedCount,
    failedCount: cleanup.failedCount,
  };
}

async function runPickedMediaAction({
  appFileSystem,
  pick,
  filePrefix,
  fallbackFileName,
  preserveUris = [],
  failureProtectedUris = [],
  cleanupAfterApplyUris = [],
  cleanupProtectedUris = [],
  apply,
}: RunPickedMediaActionOptions): Promise<PickedMediaLocalDataActionResult> {
  const intent = appFileSystem.captureIntent();
  if (!intent) return { status: "revoked" };

  let result: PickedMediaResult;
  try {
    const protectedPick = await appFileSystem.runProtectedPicker(intent, pick);
    if (protectedPick.status === "revoked") return protectedPick;
    result = protectedPick.value;
  } catch (error) {
    if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };
    throw error;
  }
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) return { status: "canceled" };
  if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };

  const fileName = asset.fileName?.trim() || fallbackFileName;
  const terminalCleanupProtectedUris = [
    ...preserveUris,
    ...failureProtectedUris,
    ...cleanupProtectedUris,
  ];
  let persisted: PersistPickedMediaResult;
  try {
    persisted = await appFileSystem.persistPickedMedia(intent, {
      sourceUri: asset.uri,
      fileName,
      mimeType: asset.mimeType,
      filePrefix,
      forceCopy: true,
    });
  } catch (error) {
    if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };
    const cleanup = await releasePickedMediaReferences({
      appFileSystem,
      uris: [asset.uri],
      protectedUris: terminalCleanupProtectedUris,
    });
    if (cleanup.status === "revoked") return cleanup;
    throw new PickedMediaLocalDataActionError(
      error,
      cleanup.status === "partial-failure",
    );
  }
  if (!persisted.ok) {
    if (persisted.reason === "reset-in-progress") return { status: "revoked" };
    const cleanup = await releasePickedMediaReferences({
      appFileSystem,
      uris: [asset.uri],
      protectedUris: terminalCleanupProtectedUris,
    });
    if (cleanup.status === "revoked") return cleanup;
    return {
      status: "not-saved",
      reason: persisted.reason,
      cleanupFailed: cleanup.status === "partial-failure",
    };
  }
  if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };

  let accepted: boolean | void;
  try {
    accepted = await apply({ asset, fileName, uri: persisted.uri });
  } catch (error) {
    const cleanup = await releasePickedMediaReferences({
      appFileSystem,
      uris: [persisted.uri, asset.uri],
      protectedUris: terminalCleanupProtectedUris,
    });
    if (cleanup.status === "revoked") return cleanup;
    throw new PickedMediaLocalDataActionError(
      error,
      cleanup.status === "partial-failure",
    );
  }
  if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };

  if (accepted === false) {
    const cleanup = await releasePickedMediaReferences({
      appFileSystem,
      uris: [persisted.uri, asset.uri],
      protectedUris: terminalCleanupProtectedUris,
    });
    if (cleanup.status === "revoked") return cleanup;
    return {
      status: "rejected",
      cleanupFailed: cleanup.status === "partial-failure",
    };
  }

  const cleanup = await releasePickedMediaReferences({
    appFileSystem,
    uris: [...cleanupAfterApplyUris, asset.uri],
    protectedUris: [
      persisted.uri,
      ...preserveUris,
      ...cleanupProtectedUris,
    ],
  });
  if (cleanup.status === "revoked") return cleanup;
  return {
    status: "applied",
    cleanupFailed: cleanup.status === "partial-failure",
  };
}

export function runRecordAttachmentPicker(
  options: Omit<RunPickedMediaActionOptions, "filePrefix" | "fallbackFileName">,
): Promise<PickedMediaLocalDataActionResult> {
  return runPickedMediaAction({
    ...options,
    filePrefix: "record-attachment",
    fallbackFileName: "Record attachment",
  });
}

export function runMedicationProofPhotoPicker(
  options: Omit<RunPickedMediaActionOptions, "filePrefix" | "fallbackFileName">,
): Promise<PickedMediaLocalDataActionResult> {
  return runPickedMediaAction({
    ...options,
    filePrefix: "medication-proof",
    fallbackFileName: "Medication proof photo",
  });
}

export function runQaScreenshotPicker(
  options: Omit<RunPickedMediaActionOptions, "filePrefix" | "fallbackFileName"> & {
    fallbackFileName: string;
  },
): Promise<PickedMediaLocalDataActionResult> {
  return runPickedMediaAction({
    ...options,
    filePrefix: "qa-screenshot",
  });
}
