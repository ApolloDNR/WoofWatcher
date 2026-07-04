export const REPORT_EXPORT_DIRECTORY_NAME = "WoofWatcherReports";
export type ReportArtifactExportMimeType = "text/html" | "image/svg+xml";
export type RecordsLocalFileHandoffProofStatus = "blocked" | "ready-for-review";

export interface RecordsLocalFileHandoffProofEvidence {
  carePassReportHistoryLocalHtml?: string | null;
  dogIdLocalHtmlCredential?: string | null;
  dogIdSvgImageSource?: string | null;
  nativeShareSheetBehavior?: string | null;
  androidContentUriOrSavedFile?: string | null;
  fallbackCopy?: string | null;
  generatedBinaryBoundary?: string | null;
}

export interface RecordsLocalFileHandoffProofItem {
  label: string;
  requiredEvidence: string;
}

export interface RecordsLocalFileHandoffProofManifestItem extends RecordsLocalFileHandoffProofItem {
  status: "blocked" | "ready";
  evidenceAttached: readonly string[];
}

export interface RecordsLocalFileHandoffProofManifest {
  title: "Records local file handoff proof manifest";
  status: RecordsLocalFileHandoffProofStatus;
  statusLabel: string;
  summary: string;
  readyCount: number;
  openCount: number;
  totalCount: number;
  nativeFileProofAllowed: boolean;
  items: RecordsLocalFileHandoffProofManifestItem[];
  blockers: string[];
}

export const RECORDS_LOCAL_FILE_HANDOFF_PROOF_ITEMS: readonly RecordsLocalFileHandoffProofItem[] = [
  {
    label: "Care Pass Report History local HTML",
    requiredEvidence:
      "WoofWatcherReports saved Printable HTML local file name, file size, storage status, and PDF/native-proof boundary from Records.",
  },
  {
    label: "Dog ID local HTML credential",
    requiredEvidence:
      "WoofWatcherCredentials saved Dog ID local HTML credential file before the native share sheet opens.",
  },
  {
    label: "Dog ID SVG image source",
    requiredEvidence:
      "WoofWatcherCredentials saved Dog ID SVG image source with image/svg+xml behavior, not an HTML fallback filename.",
  },
  {
    label: "Native share sheet behavior",
    requiredEvidence:
      "iOS and Android native share sheet behavior for Records local files, including no blank screen, dead end, or hidden share action.",
  },
  {
    label: "Android content URI or saved-file proof",
    requiredEvidence:
      "Android content URI or saved-file proof for at least one Records local file handoff.",
  },
  {
    label: "Fallback copy",
    requiredEvidence:
      "fallback copy shown when local file sharing is unavailable, including the local-only boundary and no provider-storage claim.",
  },
  {
    label: "Generated PDF/PNG and provider boundary",
    requiredEvidence:
      "Mission note confirming generated PDF/PNG proof remains separate in Report Binary Export Proof; provider-backed storage and cloud sync stay blocked until native share/reopen/provider evidence exists.",
  },
];

export const RECORDS_LOCAL_FILE_HANDOFF_PROOF_SUMMARY =
  "Records local file handoff proof packet: Care Pass Report History local HTML, Dog ID local HTML credential, Dog ID SVG image source, native share sheet behavior, Android content URI or saved-file proof, fallback copy, and the generated PDF/PNG/provider boundary before native Records file proof can be claimed.";

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

const RECORDS_LOCAL_FILE_HANDOFF_PROOF_EVIDENCE_KEYS: readonly (keyof RecordsLocalFileHandoffProofEvidence)[] = [
  "carePassReportHistoryLocalHtml",
  "dogIdLocalHtmlCredential",
  "dogIdSvgImageSource",
  "nativeShareSheetBehavior",
  "androidContentUriOrSavedFile",
  "fallbackCopy",
  "generatedBinaryBoundary",
];

function extensionForMimeType(mimeType: ReportArtifactExportMimeType): ".html" | ".svg" {
  return mimeType === "image/svg+xml" ? ".svg" : ".html";
}

function cleanRecordsProofEvidence(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
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

export function buildRecordsLocalFileHandoffProofManifest(
  input: RecordsLocalFileHandoffProofEvidence | null | undefined = {},
): RecordsLocalFileHandoffProofManifest {
  const evidence = input ?? {};
  const items = RECORDS_LOCAL_FILE_HANDOFF_PROOF_ITEMS.map<RecordsLocalFileHandoffProofManifestItem>((item, index) => {
    const attached = cleanRecordsProofEvidence(evidence[RECORDS_LOCAL_FILE_HANDOFF_PROOF_EVIDENCE_KEYS[index]]);
    return {
      ...item,
      status: attached ? "ready" : "blocked",
      evidenceAttached: attached ? [attached] : [],
    };
  });
  const readyCount = items.filter((item) => item.status === "ready").length;
  const totalCount = items.length;
  const openCount = totalCount - readyCount;
  const nativeFileProofAllowed = openCount === 0;

  return {
    title: "Records local file handoff proof manifest",
    status: nativeFileProofAllowed ? "ready-for-review" : "blocked",
    statusLabel: nativeFileProofAllowed ? "Native file proof ready for review" : "Native file proof blocked",
    summary: nativeFileProofAllowed
      ? "Records local files are ready for owner review because local HTML/SVG, native share sheet, Android content URI or saved-file proof, fallback copy, and PDF/PNG/provider boundaries are attached."
      : "Records local files must stay device-verified before native file proof is claimed: attach Care Pass Report History local HTML, Dog ID local HTML/SVG, native share sheet behavior, Android content URI or saved-file proof, fallback copy, and generated PDF/PNG/provider boundary evidence.",
    readyCount,
    openCount,
    totalCount,
    nativeFileProofAllowed,
    items,
    blockers: items.filter((item) => item.status === "blocked").map((item) => `${item.label}: ${item.requiredEvidence}`),
  };
}
