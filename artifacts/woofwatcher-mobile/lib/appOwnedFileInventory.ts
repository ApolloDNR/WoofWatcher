export const APP_OWNED_DIRECTORY_NAMES = Object.freeze([
  "WoofWatcherReports",
  "WoofWatcherCredentials",
  "woofwatcher-attachments",
] as const);

export const APP_FILE_DESTINATION_DIRECTORY_NAMES = Object.freeze({
  reports: "WoofWatcherReports",
  credentials: "WoofWatcherCredentials",
  attachments: "woofwatcher-attachments",
} as const);

export const IMAGE_PICKER_CACHE_DIRECTORY_NAME = "ImagePicker" as const;

export type AppOwnedDirectoryName =
  (typeof APP_OWNED_DIRECTORY_NAMES)[number];
export type AppFileDestination =
  keyof typeof APP_FILE_DESTINATION_DIRECTORY_NAMES;
export type AppArtifactDestination = Exclude<
  AppFileDestination,
  "attachments"
>;

const LEGACY_ROOT_AVATAR_PATTERNS = [
  /^phoenix-portrait-\d+\.png$/,
  /^avatar-(happy|excited|calm|anxious|unwell)-\d+\.png$/,
] as const;

const ENCODED_SEPARATOR_OR_TRAVERSAL = /%(?:2e|2f|5c)/i;
const IOS_APPLICATION_DOCUMENT_URI =
  /^file:\/\/\/var\/mobile\/Containers\/Data\/Application\/([^/]+)\/Documents\/(.+)$/;

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function isSafeAppDocumentDirectory(
  value: string | null,
): value is string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !value.startsWith("file:///") ||
    /[\\?#\u0000-\u001f\u007f]/.test(value) ||
    ENCODED_SEPARATOR_OR_TRAVERSAL.test(value)
  ) {
    return false;
  }
  const relativePath = value.slice("file:///".length);
  const normalizedPath = relativePath.endsWith("/")
    ? relativePath.slice(0, -1)
    : relativePath;
  if (!normalizedPath || normalizedPath.includes("//")) return false;
  return normalizedPath
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function isSafeRelativeSuffix(value: string): boolean {
  if (
    !value ||
    value.includes("\\") ||
    /[?#\u0000-\u001f\u007f]/.test(value) ||
    ENCODED_SEPARATOR_OR_TRAVERSAL.test(value)
  ) {
    return false;
  }
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

export function isSafeAppFileSystemPathComponent(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value === "." ||
    value === ".." ||
    /[\\/\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }
  try {
    encodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

export function isLegacyRootAvatarFileName(fileName: string): boolean {
  return LEGACY_ROOT_AVATAR_PATTERNS.some((pattern) => pattern.test(fileName));
}

function ownedSuffixFromOldIosDocumentUri(uri: string): string | null {
  const match = uri.match(IOS_APPLICATION_DOCUMENT_URI);
  if (!match) return null;
  const containerId = match[1] ?? "";
  const suffix = match[2] ?? "";
  if (!isSafeRelativeSuffix(containerId) || !isSafeRelativeSuffix(suffix)) {
    return null;
  }

  const [firstSegment, ...remainingSegments] = suffix.split("/");
  if (
    APP_OWNED_DIRECTORY_NAMES.includes(
      firstSegment as AppOwnedDirectoryName,
    ) &&
    remainingSegments.length > 0
  ) {
    return suffix;
  }
  if (remainingSegments.length === 0 && isLegacyRootAvatarFileName(firstSegment)) {
    return suffix;
  }
  return null;
}

export function relocateAppOwnedDocumentUri(
  uri: string,
  currentDocumentDirectory: string | null,
): string {
  if (!isSafeAppDocumentDirectory(currentDocumentDirectory)) {
    return uri;
  }
  const currentRoot = `${withoutTrailingSlash(currentDocumentDirectory)}/`;
  if (uri.startsWith(currentRoot)) return uri;
  const suffix = ownedSuffixFromOldIosDocumentUri(uri);
  return suffix ? `${currentRoot}${suffix}` : uri;
}

export function isInsideOwnedAttachmentDirectory(
  uri: string,
  currentDocumentDirectory: string | null,
): boolean {
  if (
    !isSafeAppDocumentDirectory(currentDocumentDirectory) ||
    !isSafeRelativeSuffix(
      uri.slice(`${withoutTrailingSlash(currentDocumentDirectory)}/`.length),
    )
  ) {
    return false;
  }
  const attachmentRoot =
    `${withoutTrailingSlash(currentDocumentDirectory)}/` +
    `${APP_FILE_DESTINATION_DIRECTORY_NAMES.attachments}/`;
  return uri.startsWith(attachmentRoot) && uri.length > attachmentRoot.length;
}


export function isInsideImagePickerCacheDirectory(
  uri: string,
  currentCacheDirectory: string | null,
): boolean {
  if (!isSafeAppDocumentDirectory(currentCacheDirectory)) return false;
  const cacheRoot = `${withoutTrailingSlash(currentCacheDirectory)}/`;
  const imagePickerRoot = `${cacheRoot}${IMAGE_PICKER_CACHE_DIRECTORY_NAME}/`;
  if (!uri.startsWith(imagePickerRoot) || uri.length <= imagePickerRoot.length) {
    return false;
  }
  return isSafeRelativeSuffix(uri.slice(imagePickerRoot.length));
}
