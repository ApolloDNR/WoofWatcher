export interface ReportBinaryExportProofItem {
  label: string;
  requiredEvidence: string;
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
