import {
  deriveLaunchProviderSetup,
  type LaunchProviderProfileInput,
} from "./launchProviderSetup.ts";
import {
  buildReportBinaryExportProofManifest,
  type ReportBinaryExportProofManifest,
} from "./reportBinaryExportProof.ts";
import type { LaunchStorageProviderEvidence } from "./launchProviderProfile.ts";

export interface RecordsOwnerProviderRuntime {
  storageProviderConfigured: boolean;
  storageProviderEvidence: LaunchStorageProviderEvidence | null;
}

export interface RecordsOwnerBinaryProofManifestInput {
  carePassHtmlFileName: string;
  dogIdSvgFileName: string;
  generatedDogIdPng?: {
    fileName: string;
    mimeType: "application/pdf" | "image/png";
    byteSize: number;
  };
  providerRuntime: RecordsOwnerProviderRuntime;
}

export function deriveRecordsOwnerProviderRuntime(
  profile: LaunchProviderProfileInput,
): RecordsOwnerProviderRuntime {
  const providerInput = deriveLaunchProviderSetup(profile).providerInput;
  return {
    storageProviderConfigured: Boolean(
      providerInput.storageProviderConfigured,
    ),
    storageProviderEvidence: providerInput.storageProviderEvidence ?? null,
  };
}

export function buildRecordsOwnerBinaryProofManifest(
  input: RecordsOwnerBinaryProofManifestInput,
): ReportBinaryExportProofManifest {
  return buildReportBinaryExportProofManifest({
    carePassHtmlFileName: input.carePassHtmlFileName,
    dogIdSvgFileName: input.dogIdSvgFileName,
    ...(input.generatedDogIdPng
      ? { generatedDogIdPng: input.generatedDogIdPng }
      : {}),
    storageProviderConfigured: input.providerRuntime.storageProviderConfigured,
    providerStorageEvidence: input.providerRuntime.storageProviderEvidence
      ? [input.providerRuntime.storageProviderEvidence]
      : [],
    pdfGeneratorApproved: false,
    pngRendererApproved: false,
    nativeArtifactEvidenceApproved: false,
  });
}
