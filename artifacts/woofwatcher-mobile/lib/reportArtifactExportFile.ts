export const REPORT_EXPORT_DIRECTORY_NAME = "WoofWatcherReports";
export type ReportArtifactExportMimeType = "text/html" | "image/svg+xml";

export interface ReportArtifactPrintableSource {
  fileName: string;
  html: string;
  mimeType?: ReportArtifactExportMimeType;
  formatLabel?: string;
  boundary?: string;
}

export interface ReportArtifactExportFileOptions {
  directoryName?: string;
  documentDirectory?: string | null;
  printableLabel?: string;
  title: string;
}

export interface ReportArtifactExportFilePlan {
  directoryUri: string | null;
  fileName: string;
  fileUri: string | null;
  html: string;
  mimeType: ReportArtifactExportMimeType;
  shareTitle: string;
  message: string;
  canWriteLocalFile: boolean;
  fallbackReason: string | null;
}

export interface ReportArtifactShareContent {
  title: string;
  message: string;
  url?: string;
}

function extensionForMimeType(mimeType: ReportArtifactExportMimeType): ".html" | ".svg" {
  return mimeType === "image/svg+xml" ? ".svg" : ".html";
}

export function normalizeReportExportFileName(
  fileName: string,
  extension: ".html" | ".svg" = ".html",
): string {
  const normalized = String(fileName ?? "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const safeName = normalized.length ? normalized : "woofwatcher-report";
  return safeName.toLowerCase().endsWith(extension) ? safeName : `${safeName}${extension}`;
}

function withTrailingSlash(uri: string): string {
  return uri.endsWith("/") ? uri : `${uri}/`;
}

function normalizeExportDirectoryName(directoryName: string | undefined): string {
  const normalized = String(directoryName ?? REPORT_EXPORT_DIRECTORY_NAME)
    .trim()
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return normalized.length ? normalized : REPORT_EXPORT_DIRECTORY_NAME;
}

export function buildReportArtifactExportFilePlan(
  printable: ReportArtifactPrintableSource,
  options: ReportArtifactExportFileOptions,
): ReportArtifactExportFilePlan {
  const mimeType = printable.mimeType ?? "text/html";
  const fileName = normalizeReportExportFileName(printable.fileName, extensionForMimeType(mimeType));
  const directoryName = normalizeExportDirectoryName(options.directoryName);
  const printableLabel = options.printableLabel?.trim() || "report source";
  const formatLabel = printable.formatLabel?.trim() || "HTML file";
  const boundary = [
    printable.boundary?.trim() ||
      "PDF generation is still pending native or provider-backed setup.",
    "cloud storage is not enabled by this export.",
  ].join(" ");
  const documentDirectory = typeof options.documentDirectory === "string" && options.documentDirectory.trim().length
    ? withTrailingSlash(options.documentDirectory.trim())
    : null;
  const directoryUri = documentDirectory ? `${documentDirectory}${directoryName}/` : null;
  const fileUri = directoryUri ? `${directoryUri}${fileName}` : null;
  const canWriteLocalFile = Boolean(directoryUri && fileUri);
  const fallbackReason = canWriteLocalFile
    ? null
    : "Local file export is unavailable because this runtime does not expose a document directory.";

  return {
    directoryUri,
    fileName,
    fileUri,
    html: printable.html,
    mimeType,
    shareTitle: `${options.title} printable source`,
    canWriteLocalFile,
    fallbackReason,
    message: canWriteLocalFile
      ? `WoofWatcher printable ${printableLabel} is attached as a local ${formatLabel}. ${boundary}`
      : `WoofWatcher printable ${printableLabel} is included below because local file export is unavailable in this runtime. ${boundary}`,
  };
}

export function buildReportArtifactShareContent(
  plan: ReportArtifactExportFilePlan,
  options: { shareUri?: string | null } = {},
): ReportArtifactShareContent {
  const shareUri = options.shareUri ?? plan.fileUri;
  if (plan.canWriteLocalFile && shareUri) {
    return {
      title: plan.shareTitle,
      message: plan.message,
      url: shareUri,
    };
  }

  return {
    title: plan.shareTitle,
    message: `${plan.message}\n\n${plan.html}`,
  };
}
