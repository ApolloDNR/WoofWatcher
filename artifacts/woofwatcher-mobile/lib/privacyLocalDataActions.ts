import type { AppOwnedFileInventoryResult } from "./appFileSystem.ts";
import type { LocalDataIntent } from "./localDataIntent.ts";
import type {
  LocalDataOperations,
  LocalDataOperationState,
} from "./localDataOperations.ts";
import type { LocalDataResetResult } from "./localDataResetCoordinator.ts";
import { LocalDataResetInProgressError } from "./removableLocalDataStorage.ts";
import type { ShareTextOutcome, ShareTextPayload } from "./shareText.ts";
import {
  serializePrivacyExportBundle,
  withPrivacyDeviceFileInventory,
  type PrivacyExportBundle,
} from "./privacySafety.ts";

export interface PrivacyResetFailurePresentation {
  id: string;
  label: string;
}

export class PrivacyExportDismissedError extends Error {
  constructor() {
    super("The care export share was dismissed.");
    this.name = "PrivacyExportDismissedError";
  }
}

export type PrivacyLocalDataResetView =
  | { status: "hidden" }
  | { status: "deleting"; title: "Deleting local data…" }
  | {
      status: "failed";
      title: "Some data could not be deleted";
      failures: PrivacyResetFailurePresentation[];
    }
  | {
      status: "complete";
      title: "Local care content deleted";
      detail: string;
    };

export const PRIVACY_LOCAL_RESET_COMPLETE_DETAIL =
  "WoofWatcher removed your care content, app-owned files, preferences, caches, and saved sign-in credentials from this device. It may retain only opaque reset and sync-cleanup markers so stale tabs or older connected builds cannot restore deleted data; those markers contain no care details.";

const RESET_FAILURE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "auth-credentials": "Saved sign-in credentials",
  avatar: "Care twin & avatar",
  care: "Care logs, routines & records",
  "device-preferences": "Device preferences",
  files: "Files on this device",
  "query-cache": "In-app account cache",
  "walk-capture": "Active walk capture",
  "web-runtime": "Browser/runtime cache",
  "work-drain": "Pending local changes",
});

export function buildPrivacyResetFailurePresentation(
  failedParticipantIds: readonly string[],
): PrivacyResetFailurePresentation[] {
  const ids =
    failedParticipantIds.length > 0
      ? [...new Set(failedParticipantIds)]
      : ["reset"];
  return ids.map((id) => ({
    id,
    label:
      id === "reset"
        ? "Deletion coordinator"
        : (RESET_FAILURE_LABELS[id] ?? `Local data owner (${id})`),
  }));
}

export function getPrivacyLocalDataResetView(
  operationState: LocalDataOperationState,
): PrivacyLocalDataResetView {
  if (operationState.status === "deleting") {
    return { status: "deleting", title: "Deleting local data…" };
  }
  if (
    operationState.status === "failed" &&
    operationState.operation === "delete"
  ) {
    return {
      status: "failed",
      title: "Some data could not be deleted",
      failures: buildPrivacyResetFailurePresentation(
        operationState.failedParticipantIds,
      ),
    };
  }
  if (
    operationState.status === "complete" &&
    operationState.operation === "delete"
  ) {
    return {
      status: "complete",
      title: "Local care content deleted",
      detail: PRIVACY_LOCAL_RESET_COMPLETE_DETAIL,
    };
  }
  return { status: "hidden" };
}

export function runPrivacyCareDataExport<TCapture extends object = ShareTextPayload>(options: {
  runExport: LocalDataOperations["runExport"];
  capture(): TCapture;
  prepare?(
    captured: Readonly<TCapture>,
  ): ShareTextPayload | Promise<ShareTextPayload>;
  share(payload: Readonly<ShareTextPayload>): Promise<ShareTextOutcome>;
}): Promise<void> {
  return options.runExport(
    () => {
      return Object.freeze(options.capture());
    },
    async (captured) => {
      const prepared = options.prepare
        ? await options.prepare(captured)
        : (captured as unknown as ShareTextPayload);
      const payload = Object.freeze({
        title: String(prepared.title),
        message: String(prepared.message),
      });
      const outcome = await options.share(payload);
      if (outcome === "failed" || outcome === "dismissed") {
        if (outcome === "dismissed") {
          throw new PrivacyExportDismissedError();
        }
        throw new Error("The care export could not be shared.");
      }
    },
  );
}

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

export type PrivacyLocalDataResetVerdict = {
  status: "complete" | "failed";
  failedParticipantIds: string[];
};

export async function runPrivacyLocalDataReset(
  runReset: () => Promise<LocalDataResetResult>,
): Promise<PrivacyLocalDataResetVerdict> {
  try {
    const result = await runReset();
    return result.status === "complete"
      ? { status: "complete", failedParticipantIds: [] }
      : {
          status: "failed",
          failedParticipantIds: [...result.failedParticipantIds],
        };
  } catch {
    return { status: "failed", failedParticipantIds: [] };
  }
}
