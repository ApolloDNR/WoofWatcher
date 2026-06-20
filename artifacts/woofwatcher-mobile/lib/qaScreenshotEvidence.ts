export type QaScreenshotEvidenceSource = "library" | "camera";
export type QaScreenshotEvidencePlatform = "ios" | "android" | "web" | "unknown";

export interface QaScreenshotEvidence {
  uri: string;
  fileName: string;
  source: QaScreenshotEvidenceSource;
  targetPlatform: QaScreenshotEvidencePlatform;
  capturedAtIso: string;
}

export interface QaScreenshotEvidenceInput {
  uri: string;
  fileName?: string | null;
  source?: QaScreenshotEvidenceSource | null;
  targetPlatform?: QaScreenshotEvidencePlatform | null;
  capturedAtIso?: string | null;
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

export function buildQaScreenshotEvidence(
  input: QaScreenshotEvidenceInput,
  fallbackFileName = "qa-screenshot.png",
): QaScreenshotEvidence | null {
  const uri = typeof input.uri === "string" ? input.uri.trim() : "";
  if (!uri) return null;

  return {
    uri,
    fileName: cleanFileName(input.fileName, fallbackFileName),
    source: isSource(input.source) ? input.source : "library",
    targetPlatform: isPlatform(input.targetPlatform) ? input.targetPlatform : "unknown",
    capturedAtIso: cleanIso(input.capturedAtIso) ?? new Date().toISOString(),
  };
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
        },
        fallbackFileName,
      );
    })
    .filter((item): item is QaScreenshotEvidence => !!item);
}

export function qaScreenshotEvidenceNames(evidence: readonly QaScreenshotEvidence[]): string {
  return evidence
    .map((item) => `${item.fileName} (${qaScreenshotEvidencePlatformLabel(item.targetPlatform)})`)
    .join(", ");
}
