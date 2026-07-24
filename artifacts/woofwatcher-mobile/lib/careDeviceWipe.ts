export type WipeTarget =
  | "async-storage"
  | "reports"
  | "attachments"
  | "query-cache";

export interface CareDeviceWipeStep {
  target: WipeTarget;
  status: "deleted" | "failed" | "not-applicable";
  message?: string;
}

export interface CareDeviceWipeReceipt {
  mode: "device-only";
  complete: boolean;
  steps: CareDeviceWipeStep[];
}

type WipeOperation = () => Promise<void> | void;

export interface CareDeviceWipeAdapters {
  "async-storage": WipeOperation;
  reports: WipeOperation | null;
  attachments: WipeOperation | null;
  "query-cache": WipeOperation;
}

interface CareDirectoryWipeAdapterInput {
  platform: string;
  documentDirectory: string | null;
  target: "reports" | "attachments";
  relativePath: string;
  deleteDirectory: (uri: string) => Promise<void> | void;
}

export interface CareDeviceWipeAttemptInput {
  receipt: CareDeviceWipeReceipt | null;
  additionalFailures: string[];
  requiresSignOut: boolean;
  initiatingUserId: string | null;
  getCurrentUserId: () => string | null;
  signOut: () => Promise<void>;
}

export interface CareDeviceWipeVerdict {
  complete: boolean;
  failures: string[];
  clearedAccountCare: boolean;
}

type CareDeviceWipeOperationResult =
  | "written"
  | "paused"
  | "stale"
  | "failed";

const TARGETS: WipeTarget[] = [
  "async-storage",
  "reports",
  "attachments",
  "query-cache",
];

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown device wipe failure.";
}

export function assertCareDeviceWipeOperationWritten(
  result: CareDeviceWipeOperationResult,
): void {
  if (result !== "written") throw new Error(`Device wipe ${result}`);
}

export function createCareDirectoryWipeAdapter({
  platform,
  documentDirectory,
  target,
  relativePath,
  deleteDirectory,
}: CareDirectoryWipeAdapterInput): WipeOperation | null {
  if (platform === "web") return null;
  if (!documentDirectory) {
    return async () => {
      throw new Error(`Native ${target} directory is unavailable.`);
    };
  }
  return () => deleteDirectory(`${documentDirectory}${relativePath}`);
}

export function finalizeCareDeviceWipeReceipt(
  receipt: CareDeviceWipeReceipt,
  lifecycleCurrent: boolean,
): CareDeviceWipeReceipt {
  if (lifecycleCurrent) return receipt;
  return {
    ...receipt,
    complete: false,
    steps: receipt.steps.map((step) =>
      step.target === "query-cache"
        ? {
            target: step.target,
            status: "failed",
            message: "Care identity changed during the device wipe.",
          }
        : step,
    ),
  };
}

export async function resolveCareDeviceWipeAttempt({
  receipt,
  additionalFailures,
  requiresSignOut,
  initiatingUserId,
  getCurrentUserId,
  signOut,
}: CareDeviceWipeAttemptInput): Promise<CareDeviceWipeVerdict> {
  const failures = [
    ...(receipt
      ? receipt.steps
          .filter((step) => step.status === "failed")
          .map((step) => step.target)
      : ["care-data"]),
    ...additionalFailures,
  ];

  if (receipt?.complete && failures.length === 0 && requiresSignOut) {
    if (!initiatingUserId || getCurrentUserId() !== initiatingUserId) {
      failures.push("auth-identity-changed");
    } else {
      try {
        await signOut();
      } catch {
        failures.push("account-sign-out");
      }
    }
  }

  const complete = Boolean(receipt?.complete) && failures.length === 0;
  return {
    complete,
    failures,
    clearedAccountCare: complete && requiresSignOut,
  };
}

export async function runCareDeviceWipe(
  adapters: CareDeviceWipeAdapters,
): Promise<CareDeviceWipeReceipt> {
  const steps = await Promise.all(
    TARGETS.map(async (target): Promise<CareDeviceWipeStep> => {
      const operation = adapters[target];
      if (!operation) return { target, status: "not-applicable" };
      try {
        await operation();
        return { target, status: "deleted" };
      } catch (error) {
        return {
          target,
          status: "failed",
          message: failureMessage(error),
        };
      }
    }),
  );

  return {
    mode: "device-only",
    complete: steps.every((step) => step.status !== "failed"),
    steps,
  };
}
