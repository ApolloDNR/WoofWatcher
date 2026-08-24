export const REPORT_EXPORT_DIRECTORY_NAME = "WoofWatcherReports";
export type ReportArtifactExportMimeType = "text/html" | "image/svg+xml";
export type RecordsLocalFileHandoffProofStatus = "blocked" | "ready-for-review";

export interface RecordsLocalFileHandoffProofEvidence {
  carePassReportHistoryLocalHtml?: string | null;
  dogIdLocalHtmlCredential?: string | null;
  dogIdSvgImageSource?: string | null;
  nativeFileEvidence?: readonly RecordsNativeFileHandoffEvidence[];
  nativeShareSheetBehavior?: string | null;
  androidContentUriOrSavedFile?: string | null;
  fallbackCopy?: string | null;
  generatedBinaryBoundary?: string | null;
}

export type RecordsNativeFilePlatform = "ios" | "android";
export type RecordsNativeFileArtifact = "care-pass-html" | "dog-id-html" | "dog-id-svg";

export interface RecordsNativeFileHandoffEvidence {
  platform: RecordsNativeFilePlatform;
  artifact: RecordsNativeFileArtifact;
  fileName?: string;
  uri?: string;
  mimeType: ReportArtifactExportMimeType;
  byteSize: number;
  shared: boolean;
  opened: boolean;
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
  fallbackText: string;
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
  fallbackText: string;
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

type RecordsLocalFileHandoffStringEvidenceKey = Exclude<keyof RecordsLocalFileHandoffProofEvidence, "nativeFileEvidence">;

const RECORDS_LOCAL_FILE_HANDOFF_PROOF_EVIDENCE_KEYS: readonly RecordsLocalFileHandoffStringEvidenceKey[] = [
  "carePassReportHistoryLocalHtml",
  "dogIdLocalHtmlCredential",
  "dogIdSvgImageSource",
  "nativeShareSheetBehavior",
  "androidContentUriOrSavedFile",
  "fallbackCopy",
  "generatedBinaryBoundary",
];

interface RequiredRecordsNativeFileEvidence {
  platform: RecordsNativeFilePlatform;
  artifact: RecordsNativeFileArtifact;
  label: string;
  mimeType: ReportArtifactExportMimeType;
  extension: ".html" | ".svg";
  tokens: readonly string[];
}

const REQUIRED_RECORDS_NATIVE_FILE_EVIDENCE: readonly RequiredRecordsNativeFileEvidence[] = [
  {
    platform: "ios",
    artifact: "care-pass-html",
    label: "iOS Care Pass local HTML",
    mimeType: "text/html",
    extension: ".html",
    tokens: ["care", "pass"],
  },
  {
    platform: "android",
    artifact: "care-pass-html",
    label: "Android Care Pass local HTML",
    mimeType: "text/html",
    extension: ".html",
    tokens: ["care", "pass"],
  },
  {
    platform: "ios",
    artifact: "dog-id-html",
    label: "iOS Dog ID local HTML",
    mimeType: "text/html",
    extension: ".html",
    tokens: ["dog", "id"],
  },
  {
    platform: "android",
    artifact: "dog-id-html",
    label: "Android Dog ID local HTML",
    mimeType: "text/html",
    extension: ".html",
    tokens: ["dog", "id"],
  },
  {
    platform: "ios",
    artifact: "dog-id-svg",
    label: "iOS Dog ID SVG image source",
    mimeType: "image/svg+xml",
    extension: ".svg",
    tokens: ["dog", "id"],
  },
  {
    platform: "android",
    artifact: "dog-id-svg",
    label: "Android Dog ID SVG image source",
    mimeType: "image/svg+xml",
    extension: ".svg",
    tokens: ["dog", "id"],
  },
];

function extensionForMimeType(mimeType: ReportArtifactExportMimeType): ".html" | ".svg" {
  return mimeType === "image/svg+xml" ? ".svg" : ".html";
}

function cleanRecordsProofEvidence(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordsNativeFileEvidenceText(evidence: RecordsNativeFileHandoffEvidence): string {
  return `${cleanRecordsProofEvidence(evidence.fileName)} ${cleanRecordsProofEvidence(evidence.uri)}`.toLowerCase();
}

function recordsNativeFileEvidenceHasPlatform(text: string, platform: RecordsNativeFilePlatform): boolean {
  if (platform === "ios") {
    return /\bios\b|\biphone\b|\bipad\b/.test(text);
  }
  return /\bandroid\b/.test(text);
}

function recordsNativeFileEvidenceMatches(
  evidence: RecordsNativeFileHandoffEvidence,
  requirement: RequiredRecordsNativeFileEvidence,
): boolean {
  if (
    evidence.platform !== requirement.platform ||
    evidence.artifact !== requirement.artifact ||
    evidence.mimeType !== requirement.mimeType ||
    !Number.isFinite(evidence.byteSize) ||
    evidence.byteSize <= 0 ||
    !evidence.shared ||
    !evidence.opened
  ) {
    return false;
  }
  const text = recordsNativeFileEvidenceText(evidence);
  return (
    text.includes(requirement.extension) &&
    recordsNativeFileEvidenceHasPlatform(text, requirement.platform) &&
    requirement.tokens.every((token) => text.includes(token))
  );
}

function recordsNativeFileEvidenceHasAndroidUri(evidence: RecordsNativeFileHandoffEvidence): boolean {
  if (evidence.platform !== "android") return false;
  const uri = cleanRecordsProofEvidence(evidence.uri).toLowerCase();
  return uri.startsWith("content://") || uri.startsWith("file://");
}

function summarizeRecordsNativeFileEvidence(evidence: readonly RecordsNativeFileHandoffEvidence[] | undefined) {
  const rows = REQUIRED_RECORDS_NATIVE_FILE_EVIDENCE.map((requirement) => {
    const matchingEvidence = evidence?.find((item) => recordsNativeFileEvidenceMatches(item, requirement));
    return {
      ...requirement,
      nativeReady: Boolean(matchingEvidence),
      androidUriReady: Boolean(matchingEvidence && recordsNativeFileEvidenceHasAndroidUri(matchingEvidence)),
    };
  });
  const androidRows = rows.filter((row) => row.platform === "android");
  return {
    rows,
    nativeReadyCount: rows.filter((row) => row.nativeReady).length,
    androidUriReadyCount: androidRows.filter((row) => row.androidUriReady).length,
    missingNativeLabels: rows.filter((row) => !row.nativeReady).map((row) => row.label),
    missingAndroidUriLabels: androidRows.filter((row) => !row.androidUriReady).map((row) => row.label),
  };
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
  const boundary =
    printable.boundary?.trim() ||
    "This file stays inside WoofWatcher unless you share it. WoofWatcher cloud backup is not included.";
  const documentDirectory = typeof options.documentDirectory === "string" && options.documentDirectory.trim().length
    ? withTrailingSlash(options.documentDirectory.trim())
    : null;
  const directoryUri = documentDirectory ? `${documentDirectory}${directoryName}/` : null;
  const fileUri = directoryUri ? `${directoryUri}${fileName}` : null;
  const canWriteLocalFile = Boolean(directoryUri && fileUri);
  const fallbackReason = canWriteLocalFile
    ? null
    : "Local file export is unavailable because this runtime does not expose a document directory.";
  const fallbackText =
    typeof printable.fallbackText === "string"
      ? printable.fallbackText.trim()
      : "";

  return {
    directoryUri,
    fileName,
    fileUri,
    html: printable.html,
    fallbackText:
      fallbackText ||
      `${options.title}. The printable file could not be included as readable text.`,
    mimeType,
    shareTitle: `${options.title} printable source`,
    canWriteLocalFile,
    fallbackReason,
    message: canWriteLocalFile
      ? `WoofWatcher printable ${printableLabel} is saved inside WoofWatcher as a local ${formatLabel}. ${boundary}`
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
    message: `${plan.message}\n\n${plan.fallbackText}`,
  };
}

export function buildRecordsLocalFileHandoffProofManifest(
  input: RecordsLocalFileHandoffProofEvidence | null | undefined = {},
): RecordsLocalFileHandoffProofManifest {
  const evidence = input ?? {};
  const nativeFileEvidence = summarizeRecordsNativeFileEvidence(evidence.nativeFileEvidence);
  const items = RECORDS_LOCAL_FILE_HANDOFF_PROOF_ITEMS.map<RecordsLocalFileHandoffProofManifestItem>((item, index) => {
    if (item.label === "Native share sheet behavior") {
      const ready = nativeFileEvidence.missingNativeLabels.length === 0;
      return {
        ...item,
        status: ready ? "ready" : "blocked",
        evidenceAttached: ready
          ? [`6/6 native file proofs ready: ${nativeFileEvidence.rows.map((row) => row.label).join(", ")}`]
          : [],
      };
    }
    if (item.label === "Android content URI or saved-file proof") {
      const ready = nativeFileEvidence.missingAndroidUriLabels.length === 0;
      const androidRows = nativeFileEvidence.rows.filter((row) => row.platform === "android");
      return {
        ...item,
        status: ready ? "ready" : "blocked",
        evidenceAttached: ready
          ? [`3/3 Android URI proofs ready: ${androidRows.map((row) => row.label).join(", ")}`]
          : [],
      };
    }
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
    blockers: items
      .filter((item) => item.status === "blocked")
      .map((item) => {
        if (item.label === "Native share sheet behavior") {
          return `Native share sheet behavior: platform-specific local file evidence needs file name or URI, MIME, file size, share, and reopen proof for: ${nativeFileEvidence.missingNativeLabels.join(", ")}.`;
        }
        if (item.label === "Android content URI or saved-file proof") {
          return `Android content URI or saved-file proof: Android Records local-file evidence needs content:// or file:// URI proof for: ${nativeFileEvidence.missingAndroidUriLabels.join(", ")}.`;
        }
        return `${item.label}: ${item.requiredEvidence}`;
      }),
  };
}
