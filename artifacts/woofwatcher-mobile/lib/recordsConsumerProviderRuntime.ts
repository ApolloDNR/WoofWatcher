import type {
  LaunchProviderProfileInput,
  LaunchStorageProviderEvidence,
} from "./launchProviderProfile.ts";

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
  providerRuntime?: RecordsOwnerProviderRuntime;
}

const CONSUMER_PROVIDER_RUNTIME: RecordsOwnerProviderRuntime = {
  storageProviderConfigured: false,
  storageProviderEvidence: null,
};

export function deriveRecordsOwnerProviderRuntime(
  _profile: LaunchProviderProfileInput,
): RecordsOwnerProviderRuntime {
  return CONSUMER_PROVIDER_RUNTIME;
}

export function buildRecordsOwnerBinaryProofManifest(
  _input: RecordsOwnerBinaryProofManifestInput,
): null {
  return null;
}
