export type QaScreenshotEvidenceSource = "library" | "camera";
export type QaScreenshotEvidencePlatform = "ios" | "android" | "web" | "unknown";
export type QaScreenshotEvidenceVerification =
  | "manual-self-attested"
  | "exact-binary-device";

export interface QaScreenshotEvidence {
  uri: string;
  fileName: string;
  source: QaScreenshotEvidenceSource;
  targetPlatform: QaScreenshotEvidencePlatform;
  capturedAtIso: string;
  verification?: QaScreenshotEvidenceVerification;
  nativeBuildIdentifier?: string;
  deviceIdentifier?: string;
}

export interface QaScreenshotEvidenceInput {
  uri: string;
  fileName?: string | null;
  source?: QaScreenshotEvidenceSource | null;
  targetPlatform?: QaScreenshotEvidencePlatform | null;
  capturedAtIso?: string | null;
  verification?: QaScreenshotEvidenceVerification | null;
  nativeBuildIdentifier?: string | null;
  deviceIdentifier?: string | null;
}

function isSource(value: unknown): value is QaScreenshotEvidenceSource {
  return value === "library" || value === "camera";
}

function isPlatform(value: unknown): value is QaScreenshotEvidencePlatform {
  return value === "ios" || value === "android" || value === "web" || value === "unknown";
}

export function qaScreenshotEvidencePlatformLabel(platform: QaScreenshotEvidencePlatform): string {
  switch (platform) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "web":
      return "Web";
    default:
      return "Unknown platform";
  }
}

function cleanFileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function cleanIso(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number.isNaN(new Date(trimmed).getTime()) ? null : trimmed;
}

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function buildQaScreenshotEvidence(
  input: QaScreenshotEvidenceInput,
  fallbackFileName = "qa-screenshot.png",
): QaScreenshotEvidence | null {
  const uri = typeof input.uri === "string" ? input.uri.trim() : "";
  if (!uri) return null;

  const source = isSource(input.source) ? input.source : "library";
  const requestedVerification =
    input.verification === "exact-binary-device"
      ? "exact-binary-device"
      : "manual-self-attested";
  const verification =
    source === "library" ? "manual-self-attested" : requestedVerification;

  return {
    uri,
    fileName: cleanFileName(input.fileName, fallbackFileName),
    source,
    targetPlatform: isPlatform(input.targetPlatform) ? input.targetPlatform : "unknown",
    capturedAtIso: cleanIso(input.capturedAtIso) ?? new Date().toISOString(),
    verification,
    ...(verification === "exact-binary-device"
      ? {
          nativeBuildIdentifier: cleanOptionalText(input.nativeBuildIdentifier),
          deviceIdentifier: cleanOptionalText(input.deviceIdentifier),
        }
      : {}),
  };
}

export function qaScreenshotEvidenceIsExactDeviceProof(
  evidence: QaScreenshotEvidence,
): boolean {
  return Boolean(
    evidence.source === "camera" &&
      evidence.verification === "exact-binary-device" &&
      (evidence.targetPlatform === "ios" || evidence.targetPlatform === "android") &&
      cleanOptionalText(evidence.nativeBuildIdentifier) &&
      cleanOptionalText(evidence.deviceIdentifier),
  );
}

export function cleanQaScreenshotEvidence(
  value: unknown,
  fallbackFileName = "qa-screenshot.png",
): QaScreenshotEvidence[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<QaScreenshotEvidence>;
      return buildQaScreenshotEvidence(
        {
          uri: typeof candidate.uri === "string" ? candidate.uri : "",
          fileName: candidate.fileName,
          source: candidate.source,
          targetPlatform: candidate.targetPlatform,
          capturedAtIso: candidate.capturedAtIso,
          verification: candidate.verification,
          nativeBuildIdentifier: candidate.nativeBuildIdentifier,
          deviceIdentifier: candidate.deviceIdentifier,
        },
        fallbackFileName,
      );
    })
    .filter((item): item is QaScreenshotEvidence => !!item);
}

export function qaScreenshotEvidenceNames(evidence: readonly QaScreenshotEvidence[]): string {
  return evidence
    .map((item) => {
      const verification = qaScreenshotEvidenceIsExactDeviceProof(item)
        ? "exact binary/device"
        : "manual self-attested";
      return `${item.fileName} (${qaScreenshotEvidencePlatformLabel(item.targetPlatform)}, ${verification})`;
    })
    .join(", ");
}
