export interface ReportBinaryExportProofItem {
  label: string;
  requiredEvidence: string;
}

export type ReportBinaryExportProofStatus = "ready" | "blocked";

export interface ReportBinaryExportProofManifestInput {
  carePassHtmlFileName: string;
  dogIdSvgFileName: string;
  generatedCarePassPdf?: ReportGeneratedBinaryArtifactProof;
  generatedDogIdPng?: ReportGeneratedBinaryArtifactProof;
  nativeArtifactEvidence?: readonly ReportNativeArtifactEvidence[];
  providerStorageEvidence?: readonly ReportProviderStorageEvidence[];
  storageProviderConfigured?: boolean;
  pdfGeneratorApproved: boolean;
  pngRendererApproved: boolean;
  nativeArtifactEvidenceApproved: boolean;
}

export type ReportBinaryExportProofEvidence = Partial<ReportBinaryExportProofManifestInput>;

export interface ReportGeneratedBinaryArtifactProof {
  fileName: string;
  mimeType: "application/pdf" | "image/png";
  byteSize: number;
}

export type ReportNativeArtifactPlatform = "ios" | "android";
export type ReportNativeArtifactKind = "pdf" | "png";

export interface ReportNativeArtifactEvidence {
  platform: ReportNativeArtifactPlatform;
  artifact: ReportNativeArtifactKind;
  fileName?: string;
  uri?: string;
  mimeType: "application/pdf" | "image/png";
  byteSize: number;
  shared: boolean;
  reopened: boolean;
}

export interface ReportProviderStorageEvidence {
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  bucketNames?: readonly string[] | null;
  signedUploadPolicy?: string | null;
  signedDownloadPolicy?: string | null;
  householdScopePolicy?: string | null;
  retentionPolicy?: string | null;
  exportPolicy?: string | null;
  deletionPolicy?: string | null;
  qaEvidenceStoragePolicy?: string | null;
  householdScoped?: boolean | null;
  signedUploadApproved?: boolean | null;
  signedDownloadApproved?: boolean | null;
  retentionApproved?: boolean | null;
  exportApproved?: boolean | null;
  deletionApproved?: boolean | null;
  qaEvidenceStorageApproved?: boolean | null;
}

export interface ReportBinaryExportProofManifestRow {
  label: string;
  value: string;
  detail: string;
  status: ReportBinaryExportProofStatus;
}

export interface ReportBinaryExportProofManifest {
  status: ReportBinaryExportProofStatus;
  rows: ReportBinaryExportProofManifestRow[];
  blockers: string[];
}

function clean(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text.length ? text : fallback;
}

function normalize(value: unknown): string {
  return clean(value, "").toLowerCase();
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasProofMime(value: unknown): boolean {
  const mime = normalize(value);
  return (
    mime === "application/json" ||
    mime.endsWith("+json") ||
    mime === "text/markdown" ||
    mime === "text/plain" ||
    mime === "application/pdf"
  );
}

function replaceExtension(fileName: string, extension: ".pdf" | ".png"): string {
  const cleanName = clean(fileName, `woofwatcher-artifact${extension}`);
  const baseName = cleanName.replace(/\.[a-z0-9]+$/i, "");
  return `${baseName}${extension}`;
}

function cleanGeneratedProof(
  proof: ReportGeneratedBinaryArtifactProof | undefined,
  mimeType: ReportGeneratedBinaryArtifactProof["mimeType"],
): ReportGeneratedBinaryArtifactProof | null {
  if (!proof || proof.mimeType !== mimeType || !clean(proof.fileName, "") || !Number.isFinite(proof.byteSize) || proof.byteSize <= 0) {
    return null;
  }
  return {
    fileName: clean(proof.fileName, mimeType === "application/pdf" ? "care-pass-report.pdf" : "dog-id.png"),
    mimeType,
    byteSize: Math.max(1, Math.round(proof.byteSize)),
  };
}

interface RequiredNativeArtifactEvidence {
  platform: ReportNativeArtifactPlatform;
  artifact: ReportNativeArtifactKind;
  label: string;
  mimeType: ReportNativeArtifactEvidence["mimeType"];
  extension: ".pdf" | ".png";
}

const REQUIRED_NATIVE_ARTIFACT_EVIDENCE: readonly RequiredNativeArtifactEvidence[] = [
  {
    platform: "ios",
    artifact: "pdf",
    label: "iOS Care Pass PDF",
    mimeType: "application/pdf",
    extension: ".pdf",
  },
  {
    platform: "android",
    artifact: "pdf",
    label: "Android Care Pass PDF",
    mimeType: "application/pdf",
    extension: ".pdf",
  },
  {
    platform: "ios",
    artifact: "png",
    label: "iOS Dog ID PNG",
    mimeType: "image/png",
    extension: ".png",
  },
  {
    platform: "android",
    artifact: "png",
    label: "Android Dog ID PNG",
    mimeType: "image/png",
    extension: ".png",
  },
];

function nativeArtifactEvidenceText(evidence: ReportNativeArtifactEvidence): string {
  return `${clean(evidence.fileName, "")} ${clean(evidence.uri, "")}`.toLowerCase();
}

function nativeArtifactEvidenceHasPlatform(text: string, platform: ReportNativeArtifactPlatform): boolean {
  if (platform === "ios") {
    return /\bios\b|\biphone\b|\bipad\b/.test(text);
  }
  return /\bandroid\b/.test(text);
}

function nativeArtifactEvidenceMatches(
  evidence: ReportNativeArtifactEvidence,
  requirement: RequiredNativeArtifactEvidence,
): boolean {
  if (
    evidence.platform !== requirement.platform ||
    evidence.artifact !== requirement.artifact ||
    evidence.mimeType !== requirement.mimeType ||
    !Number.isFinite(evidence.byteSize) ||
    evidence.byteSize <= 0 ||
    !evidence.shared ||
    !evidence.reopened
  ) {
    return false;
  }
  const text = nativeArtifactEvidenceText(evidence);
  return text.includes(requirement.extension) && nativeArtifactEvidenceHasPlatform(text, requirement.platform);
}

function summarizeNativeArtifactEvidence(evidence: readonly ReportNativeArtifactEvidence[] | undefined) {
  const rows = REQUIRED_NATIVE_ARTIFACT_EVIDENCE.map((requirement) => ({
    ...requirement,
    ready: Boolean(evidence?.some((item) => nativeArtifactEvidenceMatches(item, requirement))),
  }));
  return {
    rows,
    readyCount: rows.filter((row) => row.ready).length,
    missingLabels: rows.filter((row) => !row.ready).map((row) => row.label),
    pdfReady: rows.filter((row) => row.artifact === "pdf").every((row) => row.ready),
    pngReady: rows.filter((row) => row.artifact === "png").every((row) => row.ready),
  };
}

function providerStorageEvidenceMatches(evidence: ReportProviderStorageEvidence): boolean {
  const locator = `${normalize(evidence.fileName)} ${normalize(evidence.uri)}`;
  const bucketNames = Array.isArray(evidence.bucketNames)
    ? evidence.bucketNames.map((item) => clean(item, "")).filter(Boolean)
    : [];
  return (
    locator.includes("storage") &&
    (locator.includes("provider") || locator.includes("bucket")) &&
    hasProofMime(evidence.mimeType) &&
    hasPositiveByteSize(evidence.byteSize) &&
    bucketNames.length >= 3 &&
    clean(evidence.signedUploadPolicy, "").length > 0 &&
    clean(evidence.signedDownloadPolicy, "").length > 0 &&
    clean(evidence.householdScopePolicy, "").length > 0 &&
    clean(evidence.retentionPolicy, "").length > 0 &&
    clean(evidence.exportPolicy, "").length > 0 &&
    clean(evidence.deletionPolicy, "").length > 0 &&
    clean(evidence.qaEvidenceStoragePolicy, "").length > 0 &&
    evidence.householdScoped === true &&
    evidence.signedUploadApproved === true &&
    evidence.signedDownloadApproved === true &&
    evidence.retentionApproved === true &&
    evidence.exportApproved === true &&
    evidence.deletionApproved === true &&
    evidence.qaEvidenceStorageApproved === true
  );
}

function summarizeProviderStorageEvidence(evidence: readonly ReportProviderStorageEvidence[] | undefined) {
  const proof = evidence?.find(providerStorageEvidenceMatches);
  return {
    ready: Boolean(proof),
    label: proof ? clean(proof.fileName, clean(proof.uri, "Provider storage proof")) : "",
  };
}

export const REPORT_BINARY_EXPORT_PROOF_ITEMS: readonly ReportBinaryExportProofItem[] = [
  {
    label: "PDF generator",
    requiredEvidence:
      "Approved native PDF generator such as expo-print or a provider renderer, generated Care Pass Report History PDF on iOS and Android, file name, file size, MIME proof, and no HTML-only fallback in the PDF action.",
  },
  {
    label: "Credential PNG generator",
    requiredEvidence:
      "Approved image renderer such as react-native-view-shot or server renderer, generated Dog ID PNG on iOS and Android, file name, file size, MIME proof, and SVG source retained as fallback.",
  },
  {
    label: "Provider storage handoff",
    requiredEvidence:
      "structured provider storage proof file with signed upload/download buckets for report PDFs, credential PNG/SVG/HTML, and QA evidence, household scope, retention/export/deletion policy, MIME, byte size, and row-specific approval booleans.",
  },
  {
    label: "Native artifact proof",
    requiredEvidence:
      "iOS and Android evidence showing PDF and PNG artifacts generated, shared, reopened, and still bounded by provider/storage approval before launch.",
  },
];

export const REPORT_BINARY_EXPORT_PROOF_SUMMARY =
  "Report binary export proof packet: local Care Pass PDF and Dog ID PNG artifact bytes, structured provider storage proof, native share/reopen proof, and iOS/Android artifact proof before PDF or PNG readiness can be claimed.";

export function buildReportBinaryExportProofManifest(
  input: ReportBinaryExportProofManifestInput,
): ReportBinaryExportProofManifest {
  const carePassHtmlFileName = clean(input.carePassHtmlFileName, "care-pass-report.html");
  const dogIdSvgFileName = clean(input.dogIdSvgFileName, "dog-id.svg");
  const pdfFileName = replaceExtension(carePassHtmlFileName, ".pdf");
  const pngFileName = replaceExtension(dogIdSvgFileName, ".png");
  const generatedCarePassPdf = cleanGeneratedProof(input.generatedCarePassPdf, "application/pdf");
  const generatedDogIdPng = cleanGeneratedProof(input.generatedDogIdPng, "image/png");
  const storageProviderConfigured = Boolean(input.storageProviderConfigured);
  const nativeArtifactEvidence = summarizeNativeArtifactEvidence(input.nativeArtifactEvidence);
  const providerStorageEvidence = summarizeProviderStorageEvidence(input.providerStorageEvidence);
  const blockers: string[] = [];

  if (!input.pdfGeneratorApproved && !generatedCarePassPdf) {
    blockers.push("Care Pass PDF generator needs approved expo-print or provider-renderer proof.");
  }
  if (!input.pngRendererApproved && !generatedDogIdPng) {
    blockers.push("Dog ID PNG renderer needs approved react-native-view-shot or server-renderer proof.");
  }
  if (!providerStorageEvidence.ready) {
    blockers.push(
      "Provider storage needs a structured proof file with signed household-scoped upload/download, retention, export, deletion, QA evidence storage, MIME, byte size, and approval booleans.",
    );
  }
  if (nativeArtifactEvidence.missingLabels.length) {
    blockers.push(
      `Native artifact evidence needs generated file name, file size, MIME, share, and reopen proof for: ${nativeArtifactEvidence.missingLabels.join(", ")}.`,
    );
  }

  const pdfReady = (input.pdfGeneratorApproved || Boolean(generatedCarePassPdf)) && nativeArtifactEvidence.pdfReady;
  const pngReady = (input.pngRendererApproved || Boolean(generatedDogIdPng)) && nativeArtifactEvidence.pngReady;
  const status: ReportBinaryExportProofStatus =
    pdfReady && pngReady && providerStorageEvidence.ready ? "ready" : "blocked";

  return {
    status,
    rows: [
      {
        label: "Care Pass PDF",
        value: pdfReady ? "PDF proof ready" : generatedCarePassPdf ? "Local PDF generated" : "PDF pending",
        status: pdfReady ? "ready" : "blocked",
        detail: pdfReady
          ? `${pdfFileName} application/pdf proof is approved from ${carePassHtmlFileName}.`
          : generatedCarePassPdf
            ? `${generatedCarePassPdf.fileName} application/pdf is generated locally from ${carePassHtmlFileName} (${generatedCarePassPdf.byteSize} bytes); native share and reopen proof still required before PDF proof is ready.`
          : `${carePassHtmlFileName} text/html source is ready; ${pdfFileName} application/pdf still needs an approved PDF generator, file size, MIME proof, share proof, and reopen proof.`,
      },
      {
        label: "Dog ID PNG",
        value: pngReady ? "PNG proof ready" : generatedDogIdPng ? "Local PNG generated" : "PNG pending",
        status: pngReady ? "ready" : "blocked",
        detail: pngReady
          ? `${pngFileName} image/png proof is approved from ${dogIdSvgFileName}.`
          : generatedDogIdPng
            ? `${generatedDogIdPng.fileName} image/png is generated locally from ${dogIdSvgFileName} (${generatedDogIdPng.byteSize} bytes); native share and reopen proof plus provider storage proof still pending.`
          : `${dogIdSvgFileName} image/svg+xml source is ready; ${pngFileName} image/png still needs an approved PNG renderer, file size, MIME proof, share proof, and reopen proof.`,
      },
      {
        label: "Provider storage",
        value: providerStorageEvidence.ready
          ? "Provider storage proof ready"
          : storageProviderConfigured
            ? "Provider storage pending structured proof"
            : "Provider storage pending",
        status: providerStorageEvidence.ready ? "ready" : "blocked",
        detail: providerStorageEvidence.ready
          ? `${providerStorageEvidence.label} covers signed upload/download, household scope, retention/export/deletion, and QA evidence storage.`
          : storageProviderConfigured
            ? "Provider storage is staged, but structured proof still needs file name or URI, MIME, byte size, signed upload/download, household scope, retention, export, deletion, QA evidence storage, and approval booleans."
            : "Signed upload/download, household scope, retention, export, deletion, and QA evidence storage rules must be approved with structured proof before binary artifacts can be uploaded.",
      },
      {
        label: "Native artifact proof",
        value:
          nativeArtifactEvidence.readyCount === REQUIRED_NATIVE_ARTIFACT_EVIDENCE.length
            ? "4/4 native proofs ready"
            : `${nativeArtifactEvidence.readyCount}/4 native proofs attached`,
        status: nativeArtifactEvidence.readyCount === REQUIRED_NATIVE_ARTIFACT_EVIDENCE.length ? "ready" : "blocked",
        detail:
          nativeArtifactEvidence.readyCount === REQUIRED_NATIVE_ARTIFACT_EVIDENCE.length
            ? "Native iOS and Android artifact evidence is attached for Care Pass PDF and Dog ID PNG generated files, including file name or URI, MIME, file size, share, and reopen proof."
            : `Capture iOS and Android artifact-named evidence showing PDF and PNG artifacts generated, shared, reopened, and still bounded by provider/storage approval before launch. Missing: ${nativeArtifactEvidence.missingLabels.join(", ")}.`,
      },
    ],
    blockers,
  };
}
