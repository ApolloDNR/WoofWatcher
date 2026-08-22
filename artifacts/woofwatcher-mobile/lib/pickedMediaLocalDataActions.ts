import type { AppFileSystem } from "./appFileSystem.ts";
import type { PersistPickedMediaResult } from "./durablePickedMedia.ts";

export interface PickedMediaAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface PickedMediaResult {
  canceled: boolean;
  assets?: readonly PickedMediaAsset[] | null;
}

export type PickedMediaLocalDataActionResult =
  | { status: "applied" }
  | { status: "canceled" }
  | { status: "revoked" }
  | {
      status: "not-saved";
      reason: Exclude<
        Extract<PersistPickedMediaResult, { ok: false }>["reason"],
        "reset-in-progress"
      >;
    };

interface RunPickedMediaActionOptions {
  appFileSystem: AppFileSystem;
  pick(): Promise<PickedMediaResult>;
  filePrefix: string;
  fallbackFileName: string;
  apply(input: {
    asset: PickedMediaAsset;
    fileName: string;
    uri: string;
  }): void;
}

async function runPickedMediaAction({
  appFileSystem,
  pick,
  filePrefix,
  fallbackFileName,
  apply,
}: RunPickedMediaActionOptions): Promise<PickedMediaLocalDataActionResult> {
  const intent = appFileSystem.captureIntent();
  if (!intent) return { status: "revoked" };

  let result: PickedMediaResult;
  try {
    result = await pick();
  } catch (error) {
    if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };
    throw error;
  }
  const asset = result.assets?.[0];
  if (result.canceled || !asset?.uri) return { status: "canceled" };
  if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };

  const fileName = asset.fileName?.trim() || fallbackFileName;
  let persisted: PersistPickedMediaResult;
  try {
    persisted = await appFileSystem.persistPickedMedia(intent, {
      sourceUri: asset.uri,
      fileName,
      mimeType: asset.mimeType,
      filePrefix,
    });
  } catch (error) {
    if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };
    throw error;
  }
  if (!persisted.ok) {
    return persisted.reason === "reset-in-progress"
      ? { status: "revoked" }
      : { status: "not-saved", reason: persisted.reason };
  }
  if (!appFileSystem.isIntentCurrent(intent)) return { status: "revoked" };

  apply({ asset, fileName, uri: persisted.uri });
  return { status: "applied" };
}

export function runRecordAttachmentPicker(
  options: Omit<RunPickedMediaActionOptions, "filePrefix" | "fallbackFileName">,
): Promise<PickedMediaLocalDataActionResult> {
  return runPickedMediaAction({
    ...options,
    filePrefix: "record-attachment",
    fallbackFileName: "Record attachment",
  });
}

export function runMedicationProofPhotoPicker(
  options: Omit<RunPickedMediaActionOptions, "filePrefix" | "fallbackFileName">,
): Promise<PickedMediaLocalDataActionResult> {
  return runPickedMediaAction({
    ...options,
    filePrefix: "medication-proof",
    fallbackFileName: "Medication proof photo",
  });
}
