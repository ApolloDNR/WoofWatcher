import {
  APP_OWNED_DIRECTORY_NAMES,
  APP_FILE_DESTINATION_DIRECTORY_NAMES,
  IMAGE_PICKER_CACHE_DIRECTORY_NAME,
  isInsideImagePickerCacheDirectory,
  isInsideOwnedAttachmentDirectory,
  isLegacyRootAvatarFileName,
  isSafeAppDocumentDirectory,
  isSafeAppFileSystemPathComponent,
  relocateAppOwnedDocumentUri,
  type AppArtifactDestination,
} from "./appOwnedFileInventory.ts";
import {
  persistPickedMedia,
  type PersistPickedMediaOptions,
  type PersistPickedMediaResult,
} from "./durablePickedMedia.ts";
import type { FileAvailability } from "./appOwnedFileReferences.ts";
import type {
  LocalDataIntent,
  LocalDataIntentAuthority,
} from "./localDataIntent.ts";
import type { LocalDataResetParticipant } from "./localDataResetCoordinator.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import type { TrackedLocalDataWork } from "./trackedLocalDataWork.ts";

export interface AppFileSystemAdapter {
  readonly platform: string;
  readonly documentDirectory: string | null;
  readonly cacheDirectory: string | null;
  getInfoAsync(
    uri: string,
  ): Promise<{ exists?: boolean; isDirectory?: boolean }>;
  makeDirectoryAsync(
    uri: string,
    options?: { intermediates?: boolean },
  ): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
  writeAsStringAsync(
    uri: string,
    content: string,
    options: { encoding: "utf8" | "base64" },
  ): Promise<void>;
  getContentUriAsync(uri: string): Promise<string>;
  readDirectoryAsync(uri: string): Promise<string[]>;
  deleteAsync(uri: string, options: { idempotent: true }): Promise<void>;
  clearImageMemoryCache(): Promise<boolean>;
  clearImageDiskCache(): Promise<boolean>;
}

export interface AppFileArtifactInput {
  destination: AppArtifactDestination;
  fileName: string;
  content: string;
  encoding: "utf8" | "base64";
}

export type AppFileArtifactResult =
  | { ok: true; fileUri: string; shareUri: string }
  | {
      ok: false;
      reason:
        | "unsupported-platform"
        | "storage-unavailable"
        | "invalid-target"
        | "write-failed"
        | "reset-in-progress";
    };

export type ProtectedAppFileResult<T> =
  | { status: "complete"; value: T }
  | { status: "revoked" };

export type AppOwnedFileInventoryResult =
  | { status: "complete"; fileCount: number }
  | { status: "unsupported-platform" }
  | { status: "revoked" };

export type DiscardPickedMediaResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid-target" | "delete-failed" | "reset-in-progress";
    };

export interface AppFileSystem {
  readonly platform: string;
  captureIntent(): LocalDataIntent | null;
  isIntentCurrent(intent: LocalDataIntent): boolean;
  getDocumentDirectoryForArtifactPlanning(): string | null;
  inspect(uri: string): Promise<FileAvailability>;
  listOwnedFiles(intent: LocalDataIntent): Promise<AppOwnedFileInventoryResult>;
  resolveOwnedDocumentUri(uri: string): string;
  runProtectedPicker<T>(
    intent: LocalDataIntent,
    pick: () => Promise<T>,
  ): Promise<ProtectedAppFileResult<T>>;
  persistPickedMedia(
    intent: LocalDataIntent,
    input: Omit<PersistPickedMediaOptions, "fileSystem" | "platform">,
  ): Promise<PersistPickedMediaResult>;
  discardPickedMedia(
    intent: LocalDataIntent,
    uri: string,
    protectedUris?: readonly string[],
  ): Promise<DiscardPickedMediaResult>;
  runProtectedShare<T>(
    intent: LocalDataIntent,
    artifact: AppFileArtifactInput,
    perform: (artifact: AppFileArtifactResult) => Promise<T>,
  ): Promise<ProtectedAppFileResult<T>>;
  readonly localDataResetParticipant: Omit<LocalDataResetParticipant, "id">;
}

export interface CreateAppFileSystemOptions {
  adapter: AppFileSystemAdapter;
  intentAuthority: LocalDataIntentAuthority;
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
  drainTrackedLocalDataWork: TrackedLocalDataWork["drain"];
}

const REVOKED = Symbol("app-file-operation-revoked");
type Revoked = typeof REVOKED;
const MAX_OWNED_FILE_INVENTORY_DEPTH = 32;

function withTrailingSlash(value: string): string {
  return `${value.replace(/\/+$/, "")}/`;
}

function hasCanonicalFileUriPath(
  uri: string,
  baseDirectory: string | null,
): boolean {
  if (!isSafeAppDocumentDirectory(baseDirectory)) return false;
  const base = withTrailingSlash(baseDirectory);
  if (!uri.startsWith(base)) return false;
  const suffix = uri.slice(base.length);
  try {
    return suffix
      .split("/")
      .every(
        (segment) =>
          encodeURIComponent(decodeURIComponent(segment)) === segment,
      );
  } catch {
    return false;
  }
}

function isValidArtifactFileName(fileName: unknown): fileName is string {
  return (
    typeof fileName === "string" &&
    fileName.length > 0 &&
    fileName.trim() === fileName &&
    fileName !== "." &&
    fileName !== ".." &&
    !/[\\/%:?#\u0000-\u001f\u007f]/.test(fileName)
  );
}

function hasValidArtifactPayload(
  artifact: AppFileArtifactInput,
): boolean {
  return (
    typeof artifact.content === "string" &&
    (artifact.encoding === "utf8" || artifact.encoding === "base64")
  );
}

function isSupportedArtifactDestination(
  destination: unknown,
): destination is AppArtifactDestination {
  return destination === "reports" || destination === "credentials";
}

interface TargetLane {
  wait: Promise<void>;
  release(): void;
}

type FileAccessKind = "inventory" | "mutation";

interface FileAccessLease {
  wait: Promise<void>;
  release(): void;
}

/**
 * Mutations may run concurrently, but an inventory gets a stable filesystem
 * snapshot: it waits for accepted mutations, then blocks later mutations until
 * its traversal has finished. Queue order also prevents either side starving.
 */
function createFileAccessGate() {
  interface PendingAccess {
    kind: FileAccessKind;
    admit(): void;
  }

  const queue: PendingAccess[] = [];
  let activeMutations = 0;
  let inventoryActive = false;

  const dispatch = () => {
    if (inventoryActive) return;
    const next = queue[0];
    if (!next) return;

    if (next.kind === "inventory") {
      if (activeMutations > 0) return;
      queue.shift();
      inventoryActive = true;
      next.admit();
      return;
    }

    while (queue[0]?.kind === "mutation") {
      const mutation = queue.shift();
      if (!mutation) break;
      activeMutations += 1;
      mutation.admit();
    }
  };

  return (kind: FileAccessKind): FileAccessLease => {
    let admit!: () => void;
    const wait = new Promise<void>((resolve) => {
      admit = resolve;
    });
    let released = false;
    queue.push({ kind, admit });
    dispatch();

    return {
      wait,
      release() {
        if (released) return;
        released = true;
        if (kind === "inventory") {
          inventoryActive = false;
        } else {
          activeMutations -= 1;
        }
        dispatch();
      },
    };
  };
}

function createTargetLaneManager() {
  const lanes = new Map<string, Promise<void>>();

  return (key: string): TargetLane => {
    const previous = lanes.get(key) ?? Promise.resolve();
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => {}).then(() => turn);
    lanes.set(key, tail);
    void tail.then(() => {
      if (lanes.get(key) === tail) lanes.delete(key);
    });
    return {
      wait: previous.catch(() => {}),
      release,
    };
  };
}

function isResetBlocked(error: unknown): boolean {
  return error instanceof LocalDataResetInProgressError;
}

export function createAppFileSystem({
  adapter,
  intentAuthority,
  runTrackedLocalDataWork,
  drainTrackedLocalDataWork,
}: CreateAppFileSystemOptions): AppFileSystem {
  const acquireTargetLane = createTargetLaneManager();
  const acquireFileAccess = createFileAccessGate();

  const awaitWhileCurrent = async <T>(
    operation: Promise<T>,
    isCurrent: () => boolean,
  ): Promise<T | Revoked> => {
    try {
      const value = await operation;
      return isCurrent() ? value : REVOKED;
    } catch (error) {
      if (!isCurrent()) return REVOKED;
      throw error;
    }
  };

  const runWithFileAccess = async <T>(
    kind: FileAccessKind,
    isCurrent: () => boolean,
    work: () => Promise<T | Revoked>,
  ): Promise<T | Revoked> => {
    const lease = acquireFileAccess(kind);
    try {
      await lease.wait;
      if (!isCurrent()) return REVOKED;
      const value = await work();
      return isCurrent() ? value : REVOKED;
    } catch (error) {
      if (!isCurrent()) return REVOKED;
      throw error;
    } finally {
      lease.release();
    }
  };

  const inventoryOwnedFiles = async (
    isCurrent: () => boolean,
  ): Promise<number | Revoked> => {
    if (
      !isSafeAppDocumentDirectory(adapter.documentDirectory) ||
      !isSafeAppDocumentDirectory(adapter.cacheDirectory)
    ) {
      throw new Error(
        "App-owned files cannot be inventoried without safe document and cache directories.",
      );
    }

    const documentRoot = withTrailingSlash(adapter.documentDirectory);
    const cacheRoot = withTrailingSlash(adapter.cacheDirectory);
    const visitedDirectories = new Set<string>();

    const inspectPath = async (
      uri: string,
    ): Promise<
      | { exists: false }
      | { exists: true; isDirectory: boolean }
      | Revoked
    > => {
      const info = await awaitWhileCurrent(adapter.getInfoAsync(uri), isCurrent);
      if (info === REVOKED || !isCurrent()) return REVOKED;
      if (info.exists === false) return { exists: false };
      if (info.exists !== true || typeof info.isDirectory !== "boolean") {
        throw new Error(`The path type could not be proven for ${uri}.`);
      }
      return { exists: true, isDirectory: info.isDirectory };
    };

    const countDirectoryLeaves = async (
      directoryUri: string,
      depth: number,
    ): Promise<number | Revoked> => {
      if (visitedDirectories.has(directoryUri)) {
        throw new Error("An app-owned directory cycle was detected.");
      }
      visitedDirectories.add(directoryUri);

      const entries = await awaitWhileCurrent(
        adapter.readDirectoryAsync(directoryUri),
        isCurrent,
      );
      if (entries === REVOKED || !isCurrent()) return REVOKED;

      let fileCount = 0;
      for (const entry of entries) {
        if (!isCurrent()) return REVOKED;
        if (!isSafeAppFileSystemPathComponent(entry)) {
          throw new Error("An unsafe app-owned path component was rejected.");
        }
        const childUri = `${directoryUri}${encodeURIComponent(entry)}`;
        const child = await inspectPath(childUri);
        if (child === REVOKED) return REVOKED;
        if (!child.exists) continue;
        if (!child.isDirectory) {
          fileCount += 1;
          continue;
        }
        if (depth >= MAX_OWNED_FILE_INVENTORY_DEPTH) {
          throw new Error("The app-owned file inventory exceeded its maximum depth.");
        }
        const nestedCount = await countDirectoryLeaves(`${childUri}/`, depth + 1);
        if (nestedCount === REVOKED || !isCurrent()) return REVOKED;
        fileCount += nestedCount;
      }
      return isCurrent() ? fileCount : REVOKED;
    };

    const countRoot = async (uri: string): Promise<number | Revoked> => {
      const root = await inspectPath(uri);
      if (root === REVOKED) return REVOKED;
      if (!root.exists) return 0;
      if (!root.isDirectory) {
        throw new Error(`The owned directory path type could not be proven for ${uri}.`);
      }
      return countDirectoryLeaves(uri, 0);
    };

    const documentRootInfo = await inspectPath(documentRoot);
    if (documentRootInfo === REVOKED) return REVOKED;
    if (!documentRootInfo.exists || !documentRootInfo.isDirectory) {
      throw new Error("The app document directory path type could not be proven.");
    }
    const rootEntries = await awaitWhileCurrent(
      adapter.readDirectoryAsync(documentRoot),
      isCurrent,
    );
    if (rootEntries === REVOKED || !isCurrent()) return REVOKED;

    let fileCount = 0;
    for (const entry of rootEntries) {
      if (!isCurrent()) return REVOKED;
      if (!isLegacyRootAvatarFileName(entry)) continue;
      if (!isSafeAppFileSystemPathComponent(entry)) {
        throw new Error("An unsafe legacy-avatar path component was rejected.");
      }
      const legacyUri = `${documentRoot}${encodeURIComponent(entry)}`;
      const legacy = await inspectPath(legacyUri);
      if (legacy === REVOKED) return REVOKED;
      if (!legacy.exists) continue;
      if (legacy.isDirectory) {
        throw new Error("A legacy avatar path was not a physical leaf file.");
      }
      fileCount += 1;
    }

    const ownedRoots = [
      ...APP_OWNED_DIRECTORY_NAMES.map(
        (name) => `${documentRoot}${encodeURIComponent(name)}/`,
      ),
      `${cacheRoot}${encodeURIComponent(IMAGE_PICKER_CACHE_DIRECTORY_NAME)}/`,
    ];
    for (const root of ownedRoots) {
      if (!isCurrent()) return REVOKED;
      const count = await countRoot(root);
      if (count === REVOKED || !isCurrent()) return REVOKED;
      fileCount += count;
    }
    return isCurrent() ? fileCount : REVOKED;
  };

  const deleteAllOwnedFiles = async (): Promise<void> => {
    if (adapter.platform === "web") return;
    const failures: unknown[] = [];
    let legacyRootAvatarNames: string[] = [];
    let documentRoot: string | null = null;
    if (isSafeAppDocumentDirectory(adapter.documentDirectory)) {
      documentRoot = withTrailingSlash(adapter.documentDirectory);
      let entries: string[] = [];
      try {
        entries = await adapter.readDirectoryAsync(documentRoot);
      } catch (error) {
        failures.push(error);
      }
      for (const entry of entries) {
        try {
          if (!isLegacyRootAvatarFileName(entry)) continue;
          if (!isSafeAppFileSystemPathComponent(entry)) {
            throw new Error("An unsafe legacy-avatar path component was rejected.");
          }
          const uri = `${documentRoot}${encodeURIComponent(entry)}`;
          const info = await adapter.getInfoAsync(uri);
          if (info.exists === false) continue;
          if (info.exists !== true || typeof info.isDirectory !== "boolean") {
            throw new Error(`The path type could not be proven for ${uri}.`);
          }
          if (info.isDirectory) {
            throw new Error(
              "A legacy avatar path was not a physical leaf file.",
            );
          }
          legacyRootAvatarNames.push(entry);
        } catch (error) {
          failures.push(error);
        }
      }
    } else {
      failures.push(
        new Error(
          "App-owned files cannot be deleted without a safe document directory.",
        ),
      );
    }

    let imagePickerCacheUri: string | null = null;
    if (isSafeAppDocumentDirectory(adapter.cacheDirectory)) {
      imagePickerCacheUri =
        `${withTrailingSlash(adapter.cacheDirectory)}` +
        `${IMAGE_PICKER_CACHE_DIRECTORY_NAME}/`;
    } else {
      failures.push(
        new Error(
          "The ImagePicker cache cannot be deleted without a safe cache directory.",
        ),
      );
    }

    const ownedUris = [
      ...(documentRoot
        ? APP_OWNED_DIRECTORY_NAMES.map((name) => `${documentRoot}${name}/`)
        : []),
      ...(imagePickerCacheUri ? [imagePickerCacheUri] : []),
      ...(documentRoot
        ? legacyRootAvatarNames.map(
            (name) => `${documentRoot}${encodeURIComponent(name)}`,
          )
        : []),
    ];
    for (const uri of ownedUris) {
      try {
        await adapter.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        failures.push(error);
      }
    }
    for (const clearCache of [
      () => adapter.clearImageMemoryCache(),
      () => adapter.clearImageDiskCache(),
    ]) {
      try {
        const cleared = await clearCache();
        if (cleared !== true) {
          failures.push(new Error("An Expo Image cache could not be cleared."));
        }
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "One or more app-owned files could not be deleted.",
      );
    }
  };

  const localDataResetParticipant = Object.freeze({
    prepare: drainTrackedLocalDataWork,
    commit: deleteAllOwnedFiles,
  });

  const runTracked = async <T>(
    intent: LocalDataIntent,
    work: (
      isCurrent: () => boolean,
    ) => Promise<T | Revoked>,
  ): Promise<ProtectedAppFileResult<T>> => {
    if (!intentAuthority.isCurrent(intent)) return { status: "revoked" };
    try {
      const result = await runTrackedLocalDataWork(async (scope) => {
        const isCurrent = () =>
          scope.isCurrent() && intentAuthority.isCurrent(intent);
        if (!isCurrent()) return REVOKED;
        return work(isCurrent);
      });
      if (result.status === "revoked" || result.value === REVOKED) {
        return { status: "revoked" };
      }
      if (!intentAuthority.isCurrent(intent)) return { status: "revoked" };
      return { status: "complete", value: result.value };
    } catch (error) {
      if (isResetBlocked(error)) return { status: "revoked" };
      throw error;
    }
  };

  const facade: AppFileSystem = {
    platform: adapter.platform,
    captureIntent: intentAuthority.capture,
    isIntentCurrent: intentAuthority.isCurrent,
    getDocumentDirectoryForArtifactPlanning() {
      return isSafeAppDocumentDirectory(adapter.documentDirectory)
        ? adapter.documentDirectory
        : null;
    },
    async inspect(uri) {
      try {
        const info = await adapter.getInfoAsync(uri);
        if (info.exists === true) return "exists";
        if (info.exists === false) return "missing";
        return "unknown";
      } catch {
        return "unknown";
      }
    },
    async listOwnedFiles(intent) {
      if (!intentAuthority.isCurrent(intent)) return { status: "revoked" };
      if (adapter.platform === "web") {
        return { status: "unsupported-platform" };
      }
      const result = await runTracked(intent, (isCurrent) =>
        runWithFileAccess("inventory", isCurrent, () =>
          inventoryOwnedFiles(isCurrent),
        ),
      );
      return result.status === "complete"
        ? { status: "complete", fileCount: result.value }
        : { status: "revoked" };
    },
    resolveOwnedDocumentUri(uri) {
      return relocateAppOwnedDocumentUri(uri, adapter.documentDirectory);
    },
    runProtectedPicker<T>(intent: LocalDataIntent, pick: () => Promise<T>) {
      return runTracked(intent, (isCurrent) =>
        runWithFileAccess("mutation", isCurrent, () =>
          awaitWhileCurrent(pick(), isCurrent),
        ),
      );
    },
    async persistPickedMedia(intent, input) {
      if (!intentAuthority.isCurrent(intent)) {
        return { ok: false, reason: "reset-in-progress" };
      }

      if (adapter.platform === "web") {
        const result = await persistPickedMedia({
          ...input,
          fileSystem: adapter,
          platform: adapter.platform,
          isCurrent: () => intentAuthority.isCurrent(intent),
        });
        return intentAuthority.isCurrent(intent)
          ? result
          : { ok: false, reason: "reset-in-progress" };
      }

      const result = await runTracked(intent, (isCurrent) =>
        runWithFileAccess("mutation", isCurrent, async () => {
          const persisted = await persistPickedMedia({
            ...input,
            fileSystem: adapter,
            platform: adapter.platform,
            isCurrent,
          });
          return isCurrent() ? persisted : REVOKED;
        }),
      );
      return result.status === "complete"
        ? result.value
        : { ok: false, reason: "reset-in-progress" };
    },
    async discardPickedMedia(intent, uri, protectedUris = []) {
      if (!intentAuthority.isCurrent(intent)) {
        return { ok: false, reason: "reset-in-progress" };
      }
      if (adapter.platform === "web" || typeof uri !== "string") {
        return { ok: false, reason: "invalid-target" };
      }

      const relocatedUri = relocateAppOwnedDocumentUri(
        uri,
        adapter.documentDirectory,
      );
      // Old-container relocation is a read-only recovery aid for persisted
      // references. A destructive caller must present the exact current URI;
      // otherwise an untrusted stale alias could be rebound onto a different
      // current attachment with the same suffix.
      if (relocatedUri !== uri) {
        return { ok: false, reason: "invalid-target" };
      }
      const protectedTargets = new Set(
        protectedUris.map((protectedUri) =>
          relocateAppOwnedDocumentUri(
            protectedUri,
            adapter.documentDirectory,
          ),
        ),
      );
      const isOwnedAttachment = isInsideOwnedAttachmentDirectory(
        relocatedUri,
        adapter.documentDirectory,
      );
      const isImagePickerCacheFile = isInsideImagePickerCacheDirectory(
        relocatedUri,
        adapter.cacheDirectory,
      );
      if (
        protectedTargets.has(relocatedUri) ||
        (!isOwnedAttachment && !isImagePickerCacheFile) ||
        !hasCanonicalFileUriPath(
          relocatedUri,
          isOwnedAttachment
            ? adapter.documentDirectory
            : adapter.cacheDirectory,
        )
      ) {
        return { ok: false, reason: "invalid-target" };
      }

      const result = await runTracked(intent, (isCurrent) =>
        runWithFileAccess("mutation", isCurrent, async () => {
          const info = await awaitWhileCurrent(
            adapter.getInfoAsync(relocatedUri),
            isCurrent,
          );
          if (info === REVOKED || !isCurrent()) return REVOKED;
          if (info.exists === false) return { ok: true } as const;
          if (info.exists !== true || info.isDirectory !== false) {
            return { ok: false, reason: "invalid-target" } as const;
          }
          try {
            const deletion = await awaitWhileCurrent(
              adapter.deleteAsync(relocatedUri, { idempotent: true }),
              isCurrent,
            );
            return deletion === REVOKED || !isCurrent()
              ? REVOKED
              : ({ ok: true } as const);
          } catch {
            return isCurrent()
              ? ({ ok: false, reason: "delete-failed" } as const)
              : REVOKED;
          }
        }),
      );
      return result.status === "complete"
        ? result.value
        : { ok: false, reason: "reset-in-progress" };
    },
    async runProtectedShare<T>(
      intent: LocalDataIntent,
      artifact: AppFileArtifactInput,
      perform: (artifact: AppFileArtifactResult) => Promise<T>,
    ) {
      return runTracked(intent, async (isCurrent) => {
        const invoke = async (
          receipt: AppFileArtifactResult,
        ): Promise<T | Revoked> => {
          if (!isCurrent()) return REVOKED;
          const value = await perform(receipt);
          return isCurrent() ? value : REVOKED;
        };

        if (adapter.platform !== "ios" && adapter.platform !== "android") {
          return invoke({ ok: false, reason: "unsupported-platform" });
        }
        if (
          !isSupportedArtifactDestination(artifact.destination) ||
          !isValidArtifactFileName(artifact.fileName) ||
          !hasValidArtifactPayload(artifact)
        ) {
          return invoke({ ok: false, reason: "invalid-target" });
        }
        if (!isSafeAppDocumentDirectory(adapter.documentDirectory)) {
          return invoke({ ok: false, reason: "storage-unavailable" });
        }

        const directoryName =
          APP_FILE_DESTINATION_DIRECTORY_NAMES[artifact.destination];
        const directoryUri =
          `${withTrailingSlash(adapter.documentDirectory)}${directoryName}/`;
        const fileUri = `${directoryUri}${artifact.fileName}`;
        const lane = acquireTargetLane(fileUri);
        try {
          await lane.wait;
          if (!isCurrent()) return REVOKED;

          const receipt = await runWithFileAccess(
            "mutation",
            isCurrent,
            async (): Promise<AppFileArtifactResult | Revoked> => {
              try {
                await adapter.makeDirectoryAsync(directoryUri, {
                  intermediates: true,
                });
              } catch {
                if (!isCurrent()) return REVOKED;
                return { ok: false, reason: "write-failed" };
              }
              if (!isCurrent()) return REVOKED;

              try {
                await adapter.writeAsStringAsync(
                  fileUri,
                  artifact.content,
                  { encoding: artifact.encoding },
                );
              } catch {
                if (!isCurrent()) return REVOKED;
                return { ok: false, reason: "write-failed" };
              }
              if (!isCurrent()) return REVOKED;

              let shareUri = fileUri;
              if (adapter.platform !== "android") {
                return { ok: true, fileUri, shareUri };
              }

              try {
                shareUri = await adapter.getContentUriAsync(fileUri);
              } catch {
                if (!isCurrent()) return REVOKED;
                shareUri = fileUri;
              }
              return isCurrent()
                ? { ok: true, fileUri, shareUri }
                : REVOKED;
            },
          );
          if (receipt === REVOKED || !isCurrent()) return REVOKED;

          return await invoke(receipt);
        } finally {
          lane.release();
        }
      });
    },
    localDataResetParticipant,
  };

  return Object.freeze(facade);
}
