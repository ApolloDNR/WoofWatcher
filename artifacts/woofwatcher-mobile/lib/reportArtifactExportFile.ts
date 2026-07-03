export const REPORT_EXPORT_DIRECTORY_NAME = "WoofWatcherReports";

export interface ReportArtifactPrintableSource {
  fileName: string;
  html: string;
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
  mimeType: "text/html";
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

export function normalizeReportExportFileName(fileName: string): string {
  const normalized = String(fileName ?? "")
    .trim()
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const safeName = normalized.length ? normalized : "woofwatcher-report";
  return /\.html$/i.test(safeName) ? safeName : `${safeName}.html`;
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
  const fileName = normalizeReportExportFileName(printable.fileName);
  const directoryName = normalizeExportDirectoryName(options.directoryName);
  const printableLabel = options.printableLabel?.trim() || "report source";
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
    mimeType: "text/html",
    shareTitle: `${options.title} printable source`,
    canWriteLocalFile,
    fallbackReason,
    message: canWriteLocalFile
      ? `WoofWatcher printable ${printableLabel} is attached as a local HTML file. PDF generation is still pending native or provider-backed setup, and cloud storage is not enabled by this export.`
      : `WoofWatcher printable ${printableLabel} is included below because local file export is unavailable in this runtime. PDF generation is still pending native or provider-backed setup, and cloud storage is not enabled by this export.`,
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
