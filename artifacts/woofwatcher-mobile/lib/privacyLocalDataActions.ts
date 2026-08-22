import type {
  LocalDataOperations,
  LocalDataOperationState,
} from "./localDataOperations.ts";
import type { LocalDataResetResult } from "./localDataResetCoordinator.ts";
import type { ShareTextOutcome, ShareTextPayload } from "./shareText.ts";

export interface PrivacyResetFailurePresentation {
  id: string;
  label: string;
}

export type PrivacyLocalDataResetView =
  | { status: "hidden" }
  | { status: "deleting"; title: "Deleting local data…" }
  | {
      status: "failed";
      title: "Some data could not be deleted";
      failures: PrivacyResetFailurePresentation[];
    }
  | { status: "complete"; title: "All data deleted" };

const RESET_FAILURE_LABELS: Readonly<Record<string, string>> = Object.freeze({
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
    return { status: "complete", title: "All data deleted" };
  }
  return { status: "hidden" };
}

export function runPrivacyCareDataExport(options: {
  runExport: LocalDataOperations["runExport"];
  capture(): ShareTextPayload;
  share(payload: Readonly<ShareTextPayload>): Promise<ShareTextOutcome>;
}): Promise<void> {
  return options.runExport(
    () => {
      const payload = options.capture();
      return Object.freeze({
        title: String(payload.title),
        message: String(payload.message),
      });
    },
    async (payload) => {
      const outcome = await options.share(payload);
      if (outcome === "failed") {
        throw new Error("The care export could not be shared.");
      }
    },
  );
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
