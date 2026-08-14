import {
  APP_FILE_DESTINATION_DIRECTORY_NAMES,
  isSafeAppDocumentDirectory,
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
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import type { TrackedLocalDataWork } from "./trackedLocalDataWork.ts";

export interface AppFileSystemAdapter {
  readonly platform: string;
  readonly documentDirectory: string | null;
  getInfoAsync(uri: string): Promise<{ exists?: boolean }>;
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

export interface AppFileSystem {
  readonly platform: string;
  captureIntent(): LocalDataIntent | null;
  isIntentCurrent(intent: LocalDataIntent): boolean;
  getDocumentDirectoryForArtifactPlanning(): string | null;
  inspect(uri: string): Promise<FileAvailability>;
  resolveOwnedDocumentUri(uri: string): string;
  persistPickedMedia(
    intent: LocalDataIntent,
    input: Omit<PersistPickedMediaOptions, "fileSystem" | "platform">,
  ): Promise<PersistPickedMediaResult>;
  runProtectedShare<T>(
    intent: LocalDataIntent,
    artifact: AppFileArtifactInput,
    perform: (artifact: AppFileArtifactResult) => Promise<T>,
  ): Promise<ProtectedAppFileResult<T>>;
}

export interface CreateAppFileSystemOptions {
  adapter: AppFileSystemAdapter;
  intentAuthority: LocalDataIntentAuthority;
  runTrackedLocalDataWork: TrackedLocalDataWork["run"];
}

const REVOKED = Symbol("app-file-operation-revoked");
type Revoked = typeof REVOKED;

function withTrailingSlash(value: string): string {
  return `${value.replace(/\/+$/, "")}/`;
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
}: CreateAppFileSystemOptions): AppFileSystem {
  const acquireTargetLane = createTargetLaneManager();

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
    resolveOwnedDocumentUri(uri) {
      return relocateAppOwnedDocumentUri(uri, adapter.documentDirectory);
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

      const result = await runTracked(intent, async (isCurrent) => {
        const persisted = await persistPickedMedia({
          ...input,
          fileSystem: adapter,
          platform: adapter.platform,
          isCurrent,
        });
        return isCurrent() ? persisted : REVOKED;
      });
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

          try {
            await adapter.makeDirectoryAsync(directoryUri, {
              intermediates: true,
            });
          } catch {
            if (!isCurrent()) return REVOKED;
            return await invoke({ ok: false, reason: "write-failed" });
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
            return await invoke({ ok: false, reason: "write-failed" });
          }
          if (!isCurrent()) return REVOKED;

          let shareUri = fileUri;
          if (adapter.platform === "android") {
            try {
              shareUri = await adapter.getContentUriAsync(fileUri);
            } catch {
              if (!isCurrent()) return REVOKED;
              shareUri = fileUri;
            }
            if (!isCurrent()) return REVOKED;
          }

          return await invoke({ ok: true, fileUri, shareUri });
        } finally {
          lane.release();
        }
      });
    },
  };

  return Object.freeze(facade);
}
