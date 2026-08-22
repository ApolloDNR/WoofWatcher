import {
  APP_FILE_DESTINATION_DIRECTORY_NAMES,
  type AppArtifactDestination,
} from "./appOwnedFileInventory.ts";
import type {
  AppFileArtifactResult,
  AppFileSystem,
  ProtectedAppFileResult,
} from "./appFileSystem.ts";
import {
  buildReportArtifactExportFilePlan,
  buildReportArtifactShareContent,
  type ReportArtifactPrintableSource,
  type ReportArtifactShareContent,
} from "./reportArtifactExportFile.ts";
import {
  buildGeneratedBinaryArtifactFilePlan,
  buildGeneratedBinaryArtifactShareContent,
  type GeneratedBinaryArtifactShareContent,
  type GeneratedBinaryArtifactSource,
} from "./reportGeneratedBinaryArtifact.ts";
import type { ShareTextOutcome, ShareTextPayload } from "./shareText.ts";

export type NativeRecordsFileShareContent =
  | ReportArtifactShareContent
  | GeneratedBinaryArtifactShareContent;

interface RecordsShareAdapters {
  appFileSystem: AppFileSystem;
  destination: AppArtifactDestination;
  title: string;
  shareNative(content: NativeRecordsFileShareContent): Promise<void>;
  shareText(payload: ShareTextPayload): Promise<ShareTextOutcome>;
}

export interface PrintableRecordsFileShareOptions extends RecordsShareAdapters {
  printable: ReportArtifactPrintableSource;
  printableLabel?: string;
}

export interface GeneratedRecordsFileShareOptions extends RecordsShareAdapters {
  source: GeneratedBinaryArtifactSource;
}

async function performWithTextFallback(
  receipt: AppFileArtifactResult,
  nativeContent: () => NativeRecordsFileShareContent,
  fallbackContent: () => ShareTextPayload,
  shareNative: RecordsShareAdapters["shareNative"],
  shareText: RecordsShareAdapters["shareText"],
  isCurrent: () => boolean,
): Promise<void> {
  if (receipt.ok) {
    try {
      await shareNative(nativeContent());
      return;
    } catch {
      // Preserve the established text fallback, but keep it inside the
      // protected callback so reset drains the whole sharing lifecycle.
      if (!isCurrent()) return;
    }
  }
  if (!isCurrent()) return;
  await shareText(fallbackContent());
}

export async function runPrintableRecordsFileShare({
  appFileSystem,
  destination,
  printable,
  printableLabel,
  title,
  shareNative,
  shareText,
}: PrintableRecordsFileShareOptions): Promise<ProtectedAppFileResult<void>> {
  const intent = appFileSystem.captureIntent();
  if (!intent) return { status: "revoked" };
  const directoryName = APP_FILE_DESTINATION_DIRECTORY_NAMES[destination];
  const plan = buildReportArtifactExportFilePlan(printable, {
    directoryName,
    documentDirectory: appFileSystem.getDocumentDirectoryForArtifactPlanning(),
    printableLabel,
    title,
  });
  const fallbackPlan = buildReportArtifactExportFilePlan(printable, {
    directoryName,
    documentDirectory: null,
    printableLabel,
    title,
  });

  return appFileSystem.runProtectedShare(
    intent,
    {
      destination,
      fileName: plan.fileName,
      content: printable.html,
      encoding: "utf8",
    },
    (receipt) =>
      performWithTextFallback(
        receipt,
        () =>
          buildReportArtifactShareContent(plan, {
            shareUri: receipt.ok ? receipt.shareUri : null,
          }),
        () => buildReportArtifactShareContent(fallbackPlan),
        shareNative,
        shareText,
        () => appFileSystem.isIntentCurrent(intent),
      ),
  );
}

export async function runGeneratedRecordsFileShare({
  appFileSystem,
  destination,
  source,
  title,
  shareNative,
  shareText,
}: GeneratedRecordsFileShareOptions): Promise<ProtectedAppFileResult<void>> {
  const intent = appFileSystem.captureIntent();
  if (!intent) return { status: "revoked" };
  const directoryName = APP_FILE_DESTINATION_DIRECTORY_NAMES[destination];
  const plan = buildGeneratedBinaryArtifactFilePlan(source, {
    directoryName,
    documentDirectory: appFileSystem.getDocumentDirectoryForArtifactPlanning(),
    title,
  });
  const fallbackPlan = buildGeneratedBinaryArtifactFilePlan(source, {
    directoryName,
    documentDirectory: null,
    title,
  });

  return appFileSystem.runProtectedShare(
    intent,
    {
      destination,
      fileName: plan.fileName,
      content: plan.contentBase64,
      encoding: "base64",
    },
    (receipt) =>
      performWithTextFallback(
        receipt,
        () =>
          buildGeneratedBinaryArtifactShareContent(plan, {
            shareUri: receipt.ok ? receipt.shareUri : null,
          }),
        () => buildGeneratedBinaryArtifactShareContent(fallbackPlan),
        shareNative,
        shareText,
        () => appFileSystem.isIntentCurrent(intent),
      ),
  );
}
