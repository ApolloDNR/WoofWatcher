export type PrivacyEraseStage = "confirm" | "confirm-final";

export interface PrivacyEraseStepCopy {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface PrivacyDataTruthCopy {
  hero: string;
  exportLimitation: string;
  rules: string;
  eraseSteps: Readonly<Record<PrivacyEraseStage, PrivacyEraseStepCopy>>;
}

export const PRIVACY_CURRENT_CARE_JSON_LIMITATION =
  "The current care JSON describes only the care data open in this app. It lists file references and a device file count, but does not include the underlying photo, document attachment, or saved report file bytes. It also does not include saved sign-in credentials or care data cached for other accounts or households.";

export const PRIVACY_PROVIDER_COPY_NOTICE =
  "A provider account copy may also exist if a connected or older build was used. Device deletion does not delete or prove deletion of that provider account copy.";

const ERASE_STEPS: Readonly<
  Record<PrivacyEraseStage, PrivacyEraseStepCopy>
> = Object.freeze({
  confirm: Object.freeze({
    title: "Delete all WoofWatcher data on this device?",
    message: `This permanently removes WoofWatcher data stored by this app on this device for every cached account, household, and dog: care logs, routines, records, memories, reports, avatars, app-owned files, preferences, caches, and saved sign-in credentials. ${PRIVACY_CURRENT_CARE_JSON_LIMITATION} Copy anything else you need separately before continuing. ${PRIVACY_PROVIDER_COPY_NOTICE} Opaque non-content reset and sync-cleanup IDs may remain only to stop deleted local data from returning.`,
    confirmLabel: "Delete device data",
    cancelLabel: "Cancel",
  }),
  "confirm-final": Object.freeze({
    title: "This cannot be undone",
    message:
      "Delete all WoofWatcher data stored by this app on this device now for every cached account, household, and dog? This also removes app-owned files and saved sign-in credentials. Provider account copies are outside this device reset.",
    confirmLabel: "Yes, delete device data",
    cancelLabel: "Keep my data",
  }),
});

export function getPrivacyDataTruthCopy(
  ownerOps: boolean,
): PrivacyDataTruthCopy {
  return Object.freeze({
    hero: ownerOps
      ? "Export the current care JSON, prepare a provider deletion request, and review the rules that keep AI, documents, and payments gated."
      : "WoofWatcher stores care data on this device. A provider account copy may also exist after using a connected or older build. Review the limits, export the current care JSON, or delete the app's data from this device.",
    exportLimitation: PRIVACY_CURRENT_CARE_JSON_LIMITATION,
    rules: `Care data is stored on this device. ${PRIVACY_PROVIDER_COPY_NOTICE}`,
    eraseSteps: ERASE_STEPS,
  });
}
