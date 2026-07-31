export const DURABLE_ATTACHMENT_DIRECTORY_NAME = "woofwatcher-attachments";

export interface DurablePickedMediaFileSystem {
  documentDirectory: string | null;
  makeDirectoryAsync(
    fileUri: string,
    options?: { intermediates?: boolean },
  ): Promise<void>;
  copyAsync(options: { from: string; to: string }): Promise<void>;
}

export interface PersistPickedMediaOptions {
  fileSystem: DurablePickedMediaFileSystem;
  platform: string;
  sourceUri: string;
  fileName?: string | null;
  mimeType?: string | null;
  filePrefix?: string;
  now?: () => number;
  randomToken?: () => string;
}

export type PersistPickedMediaFailureReason =
  | "missing-source-uri"
  | "durable-storage-unavailable"
  | "durable-copy-failed";

export type PersistPickedMediaResult =
  | {
      ok: true;
      uri: string;
      storage: "web-reference" | "app-document";
    }
  | {
      ok: false;
      reason: PersistPickedMediaFailureReason;
    };

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function cleanToken(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || fallback;
}

function extensionFromName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/, 1)[0] ?? "";
  const match = path.match(/\.([a-zA-Z0-9]{1,10})$/);
  return match?.[1]?.toLowerCase() ?? null;
}

function extensionFromMimeType(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const knownExtensions: Record<string, string> = {
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return knownExtensions[normalized] ?? null;
}

function resolvePickedMediaExtension(options: PersistPickedMediaOptions): string {
  return (
    extensionFromName(options.fileName) ??
    extensionFromMimeType(options.mimeType) ??
    extensionFromName(options.sourceUri) ??
    "jpg"
  );
}

function defaultRandomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Turns an ImagePicker result into a URI that is safe to persist.
 *
 * Web keeps its existing reference behavior because Expo web does not expose
 * an app document directory. Native never returns the picked cache URI after a
 * storage failure: callers must surface `reason` and leave persisted state
 * unchanged.
 */
export async function persistPickedMedia(
  options: PersistPickedMediaOptions,
): Promise<PersistPickedMediaResult> {
  const sourceUri = options.sourceUri.trim();
  if (!sourceUri) {
    return { ok: false, reason: "missing-source-uri" };
  }

  if (options.platform === "web") {
    return { ok: true, uri: sourceUri, storage: "web-reference" };
  }

  const documentDirectory = options.fileSystem.documentDirectory?.trim();
  if (!documentDirectory) {
    return { ok: false, reason: "durable-storage-unavailable" };
  }

  const durableRoot = withoutTrailingSlash(documentDirectory);
  if (sourceUri.startsWith(`${durableRoot}/`)) {
    return { ok: true, uri: sourceUri, storage: "app-document" };
  }

  const directoryUri = `${durableRoot}/${DURABLE_ATTACHMENT_DIRECTORY_NAME}/`;
  const filePrefix = cleanToken(options.filePrefix ?? "attachment", "attachment");
  const timestamp = Math.max(0, Math.trunc((options.now ?? Date.now)()));
  const randomToken = cleanToken(
    (options.randomToken ?? defaultRandomToken)(),
    "picked",
  ).slice(0, 12);
  const extension = resolvePickedMediaExtension(options);
  const durableUri = `${directoryUri}${filePrefix}_${timestamp}_${randomToken}.${extension}`;

  try {
    await options.fileSystem.makeDirectoryAsync(directoryUri, {
      intermediates: true,
    });
    await options.fileSystem.copyAsync({
      from: sourceUri,
      to: durableUri,
    });
  } catch {
    return { ok: false, reason: "durable-copy-failed" };
  }

  return { ok: true, uri: durableUri, storage: "app-document" };
}
