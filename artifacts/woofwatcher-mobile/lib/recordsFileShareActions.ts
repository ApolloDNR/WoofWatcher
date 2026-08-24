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
import type { NativeFileShareOutcome } from "./nativeFileSharePolicy.ts";

export type NativeRecordsFileShareContent =
  | ReportArtifactShareContent
  | GeneratedBinaryArtifactShareContent;

interface RecordsShareAdapters {
  appFileSystem: AppFileSystem;
  destination: AppArtifactDestination;
  title: string;
  shareNative(
    content: NativeRecordsFileShareContent,
  ): Promise<NativeFileShareOutcome>;
  shareText(payload: ShareTextPayload): Promise<ShareTextOutcome>;
}

export type RecordsFileShareResult =
  | {
      status: "complete";
      outcome: Exclude<ShareTextOutcome, "dismissed" | "failed">;
    }
  | { status: "dismissed" | "failed" | "revoked" };

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
  savedFileFallbackContent: () => ShareTextPayload,
  unavailableFallbackContent: () => ShareTextPayload,
  shareNative: RecordsShareAdapters["shareNative"],
  shareText: RecordsShareAdapters["shareText"],
  isCurrent: () => boolean,
): Promise<ShareTextOutcome> {
  if (receipt.ok) {
    try {
      return await shareNative(nativeContent());
    } catch {
      if (!isCurrent()) return "failed";
      return shareText(savedFileFallbackContent());
    }
  }
  if (!isCurrent()) return "failed";
  return shareText(unavailableFallbackContent());
}

function recordsFileShareResult(
  protectedResult: ProtectedAppFileResult<ShareTextOutcome>,
): RecordsFileShareResult {
  if (protectedResult.status === "revoked") return protectedResult;
  if (protectedResult.value === "dismissed") return { status: "dismissed" };
  if (protectedResult.value === "failed") return { status: "failed" };
  return { status: "complete", outcome: protectedResult.value };
}

function savedFileCouldNotAttach(
  payload: ShareTextPayload,
  fallbackBody?: string,
): ShareTextPayload {
  return {
    title: payload.title,
    message: [
      payload.message,
      "The local file was saved inside WoofWatcher, but it could not be attached by this share sheet. WoofWatcher is sharing the text handoff instead.",
      fallbackBody,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export async function runPrintableRecordsFileShare({
  appFileSystem,
  destination,
  printable,
  printableLabel,
  title,
  shareNative,
  shareText,
}: PrintableRecordsFileShareOptions): Promise<RecordsFileShareResult> {
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

  const protectedResult = await appFileSystem.runProtectedShare(
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
        () =>
          savedFileCouldNotAttach(
            { title: plan.shareTitle, message: plan.message },
            plan.fallbackText,
          ),
        () => buildReportArtifactShareContent(fallbackPlan),
        shareNative,
        shareText,
        () => appFileSystem.isIntentCurrent(intent),
      ),
  );
  return recordsFileShareResult(protectedResult);
}

export async function runGeneratedRecordsFileShare({
  appFileSystem,
  destination,
  source,
  title,
  shareNative,
  shareText,
}: GeneratedRecordsFileShareOptions): Promise<RecordsFileShareResult> {
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

  const protectedResult = await appFileSystem.runProtectedShare(
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
        () =>
          savedFileCouldNotAttach({
            title: plan.shareTitle,
            message: plan.message,
          }),
        () => buildGeneratedBinaryArtifactShareContent(fallbackPlan),
        shareNative,
        shareText,
        () => appFileSystem.isIntentCurrent(intent),
      ),
  );
  return recordsFileShareResult(protectedResult);
}
