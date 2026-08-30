import type { AppOwnedFileInventoryResult } from "./appFileSystem.ts";
import type { LocalDataIntent } from "./localDataIntent.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import type { ShareTextPayload } from "./shareText.ts";
import {
  serializePrivacyExportBundle,
  withPrivacyDeviceFileInventory,
  type PrivacyExportBundle,
} from "./privacySafety.ts";

export interface CapturedPrivacyCareExport {
  title: string;
  serializedBundle: string;
  inventoryIntent: LocalDataIntent;
}

export async function preparePrivacyCareExportWithDeviceInventory(
  captured: Readonly<CapturedPrivacyCareExport>,
  listOwnedFiles: (
    intent: LocalDataIntent,
  ) => Promise<AppOwnedFileInventoryResult>,
): Promise<ShareTextPayload> {
  const inventory = await listOwnedFiles(captured.inventoryIntent);
  if (inventory.status === "revoked") {
    throw new LocalDataResetInProgressError();
  }
  const bundle = JSON.parse(captured.serializedBundle) as PrivacyExportBundle;
  const enriched = withPrivacyDeviceFileInventory(bundle, inventory);
  return {
    title: captured.title,
    message: serializePrivacyExportBundle(enriched),
  };
}
