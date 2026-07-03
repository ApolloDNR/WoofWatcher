export interface ReportBinaryExportProofItem {
  label: string;
  requiredEvidence: string;
}

export type ReportBinaryExportProofStatus = "ready" | "blocked";

export interface ReportBinaryExportProofManifestInput {
  carePassHtmlFileName: string;
  dogIdSvgFileName: string;
  storageProviderConfigured?: boolean;
  pdfGeneratorApproved: boolean;
  pngRendererApproved: boolean;
  nativeArtifactEvidenceApproved: boolean;
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

function replaceExtension(fileName: string, extension: ".pdf" | ".png"): string {
  const cleanName = clean(fileName, `woofwatcher-artifact${extension}`);
  const baseName = cleanName.replace(/\.[a-z0-9]+$/i, "");
  return `${baseName}${extension}`;
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
      "signed upload/download storage buckets for report PDFs, credential PNG/SVG/HTML, and QA evidence, with household scope plus retention/export/deletion policy.",
  },
  {
    label: "Native artifact proof",
    requiredEvidence:
      "iOS and Android evidence showing PDF and PNG artifacts generated, shared, reopened, and still bounded by provider/storage approval before launch.",
  },
];

export const REPORT_BINARY_EXPORT_PROOF_SUMMARY =
  "Report binary export proof packet: approved Care Pass PDF generator, approved Dog ID PNG generator, provider storage policy, and iOS/Android artifact proof before PDF or PNG readiness can be claimed.";

export function buildReportBinaryExportProofManifest(
  input: ReportBinaryExportProofManifestInput,
): ReportBinaryExportProofManifest {
  const carePassHtmlFileName = clean(input.carePassHtmlFileName, "care-pass-report.html");
  const dogIdSvgFileName = clean(input.dogIdSvgFileName, "dog-id.svg");
  const pdfFileName = replaceExtension(carePassHtmlFileName, ".pdf");
  const pngFileName = replaceExtension(dogIdSvgFileName, ".png");
  const storageProviderConfigured = Boolean(input.storageProviderConfigured);
  const blockers: string[] = [];

  if (!input.pdfGeneratorApproved) {
    blockers.push("Care Pass PDF generator needs approved expo-print or provider-renderer proof.");
  }
  if (!input.pngRendererApproved) {
    blockers.push("Dog ID PNG renderer needs approved react-native-view-shot or server-renderer proof.");
  }
  if (!storageProviderConfigured) {
    blockers.push("Provider storage needs signed household-scoped upload/download, retention, export, and deletion proof.");
  }
  if (!input.nativeArtifactEvidenceApproved) {
    blockers.push("iOS and Android artifact evidence needs generated file name, file size, MIME, share, and reopen proof.");
  }

  const pdfReady = input.pdfGeneratorApproved && input.nativeArtifactEvidenceApproved;
  const pngReady = input.pngRendererApproved && input.nativeArtifactEvidenceApproved;
  const status: ReportBinaryExportProofStatus =
    pdfReady && pngReady && storageProviderConfigured ? "ready" : "blocked";

  return {
    status,
    rows: [
      {
        label: "Care Pass PDF",
        value: pdfReady ? "PDF proof ready" : "PDF pending",
        status: pdfReady ? "ready" : "blocked",
        detail: pdfReady
          ? `${pdfFileName} application/pdf proof is approved from ${carePassHtmlFileName}.`
          : `${carePassHtmlFileName} text/html source is ready; ${pdfFileName} application/pdf still needs an approved PDF generator, file size, MIME proof, share proof, and reopen proof.`,
      },
      {
        label: "Dog ID PNG",
        value: pngReady ? "PNG proof ready" : "PNG pending",
        status: pngReady ? "ready" : "blocked",
        detail: pngReady
          ? `${pngFileName} image/png proof is approved from ${dogIdSvgFileName}.`
          : `${dogIdSvgFileName} image/svg+xml source is ready; ${pngFileName} image/png still needs an approved PNG renderer, file size, MIME proof, share proof, and reopen proof.`,
      },
      {
        label: "Provider storage",
        value: storageProviderConfigured ? "Provider storage approved" : "Provider storage pending",
        status: storageProviderConfigured ? "ready" : "blocked",
        detail: storageProviderConfigured
          ? "Provider storage is approved for household-scoped report and credential artifact handoff."
          : "Signed upload/download, household scope, retention, export, and deletion rules must be approved before binary artifacts can be uploaded.",
      },
      {
        label: "Native artifact proof",
        value: input.nativeArtifactEvidenceApproved ? "iOS/Android proof ready" : "iOS/Android proof pending",
        status: input.nativeArtifactEvidenceApproved ? "ready" : "blocked",
        detail: input.nativeArtifactEvidenceApproved
          ? "Native iOS and Android artifact evidence is attached for generated PDF and PNG files."
          : "Capture iOS and Android evidence showing PDF and PNG artifacts generated, shared, reopened, and still bounded by provider/storage approval before launch.",
      },
    ],
    blockers,
  };
}
