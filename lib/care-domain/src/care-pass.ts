import { normalizeCareEventType } from "./events.ts";
import { deriveAloneTime, type AloneTimeItem } from "./alone-time.ts";
import { deriveCareTrends, type CareTrendSignal } from "./care-trends.ts";
import { deriveDietProgress } from "./diet-progress.ts";
import { deriveCareHandoff, type CareHandoffCaregiver, type CareHandoffRoutine } from "./handoff.ts";
import { deriveHealthWatch, type CareHealthEntry } from "./health.ts";
import { deriveIncidentWatch, type IncidentWatchItem } from "./incident-watch.ts";
import { deriveGroomingCare, type GroomingCareItem } from "./grooming-care.ts";
import { deriveMedicationAdherence, deriveMedicationFollowUps } from "./medication.ts";
import { recordDueNeedsCorrection } from "./record-vault.ts";
import { DEFAULT_PET_DISPLAY_NAME, resolvePetName } from "./pet-identity.ts";
import { derivePottyHealth } from "./potty-health.ts";
import { isHouseholdVisibleCareEvidence, selectSharedCareEvidence } from "./shared-evidence.ts";
import { deriveTrainingProgress, type TrainingProgressItem } from "./training-progress.ts";
import { deriveWaterHydration } from "./water.ts";
import { deriveWalkActivity, deriveWalkRouteTemplates, type WalkRouteTemplate } from "./walk-activity.ts";
import { deriveWeightTrend, type WeightTrendItem } from "./weight-trend.ts";

export type CarePassAudience = "caregiver" | "sitter" | "vet" | "trainer";

export interface CarePassProfile {
  name?: string;
  breed?: string;
  careFocus?: string;
  vetBoundary?: string;
  weight?: {
    current?: number;
    goal?: string;
    unit?: string;
  };
}

export interface CarePassGoal {
  id?: string;
  category?: string;
  title?: string;
  target?: string;
  status?: string;
  due?: string;
  note?: string;
}

export interface CarePassDietProfile {
  primaryFood?: string;
  normalPortion?: string;
  mealSchedule?: string;
  bedtimeSnack?: string;
  avoid?: string;
  sensitivities?: string;
  appetiteQuirks?: string;
  vetNotes?: string;
}

export interface CarePassRecord {
  id?: string;
  type: string;
  title: string;
  due?: string;
  note?: string;
  correctionIssues?: readonly unknown[];
}

export interface CarePassInput {
  audience: CarePassAudience;
  profile?: CarePassProfile;
  dietProfile?: CarePassDietProfile;
  entries: readonly CareHealthEntry[];
  routines?: readonly CareHandoffRoutine[];
  caregivers?: readonly CareHandoffCaregiver[];
  records?: readonly CarePassRecord[];
  goals?: readonly CarePassGoal[];
  now?: number;
}

export interface CarePassSection {
  title: string;
  lines: string[];
}

export interface CarePass {
  audience: CarePassAudience;
  title: string;
  generatedAt: string;
  summary: string;
  sections: CarePassSection[];
  message: string;
}

export interface CarePassArtifact {
  id: string;
  kind: "care_pass";
  audience: CarePassAudience;
  title: string;
  generatedAt: string;
  createdAt: string;
  summary: string;
  sectionTitles: string[];
  message: string;
  printFileName?: string;
  printHtml?: string;
  storageStatus?: CarePassArtifactStorageStatus;
}

export interface CarePassArtifactPrintView {
  fileName: string;
  html: string;
  status: "ready" | "restored";
}

export interface CarePassArtifactExportManifestRow {
  label: string;
  value: string;
  detail: string;
}

export interface CarePassArtifactExportView {
  fileName: string;
  mimeType: "text/html";
  formatLabel: "Printable HTML";
  sourceStatus: CarePassArtifactPrintView["status"];
  byteSize: number;
  pdfStatus: "not-generated" | "generated-local";
  pdfDetail: string;
  storage: CarePassArtifactStorageView;
  providerBacked: boolean;
  manifestRows: CarePassArtifactExportManifestRow[];
}

export interface CarePassGeneratedPdfProof {
  fileName: string;
  mimeType: "application/pdf";
  byteSize: number;
}

export type CarePassArtifactStorageStatus = "local-only" | "upload-ready" | "uploaded" | "failed";

export interface CarePassArtifactStorageView {
  status: CarePassArtifactStorageStatus;
  label: string;
  detail: string;
  providerBacked: boolean;
}

export interface CarePassStorageProviderEvidence {
  fileName?: string | null;
  uri?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  bucketNames?: readonly string[] | null;
  signedUploadPolicy?: string | null;
  signedDownloadPolicy?: string | null;
  householdScopePolicy?: string | null;
  retentionPolicy?: string | null;
  exportPolicy?: string | null;
  deletionPolicy?: string | null;
  qaEvidenceStoragePolicy?: string | null;
  apolloApprovalOwner?: string | null;
  signedAccessApproved?: boolean | null;
  householdScopeApproved?: boolean | null;
  retentionExportDeletionApproved?: boolean | null;
  qaEvidenceStorageApproved?: boolean | null;
  apolloApproved?: boolean | null;
}

export interface CarePassArtifactStorageOptions {
  storageProviderConfigured?: boolean;
  storageProviderEvidence?: CarePassStorageProviderEvidence | null;
}

export interface CarePassArtifactExportOptions
  extends CarePassArtifactStorageOptions {
  generatedPdf?: CarePassGeneratedPdfProof | null;
}

const AUDIENCE_LABEL: Record<CarePassAudience, string> = {
  caregiver: "Caregiver",
  sitter: "Sitter",
  vet: "Vet",
  trainer: "Trainer",
};
const CARE_PASS_TITLE_MAX_CHARS = 192;
const CARE_PASS_SUMMARY_MAX_CHARS = 1_024;
const CARE_PASS_LINE_MAX_CHARS = 2_048;
const CARE_PASS_MESSAGE_MAX_CHARS = 65_536;
const CARE_PASS_MAX_SECTIONS = 32;
const CARE_PASS_MAX_LINES_PER_SECTION = 64;
const CARE_PASS_TEXT_TRUNCATION_MARKER = " ... [content shortened] ... ";

function boundCarePassText(value: unknown, maxChars: number): string {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  if (maxChars <= CARE_PASS_TEXT_TRUNCATION_MARKER.length) {
    return text.slice(0, maxChars);
  }
  const remaining = maxChars - CARE_PASS_TEXT_TRUNCATION_MARKER.length;
  const headLength = Math.ceil(remaining * 0.6);
  return `${text.slice(0, headLength)}${CARE_PASS_TEXT_TRUNCATION_MARKER}${text.slice(-(remaining - headLength))}`;
}

function boundedCarePassLine(value: unknown, maxChars = CARE_PASS_LINE_MAX_CHARS): string {
  return clean(boundCarePassText(value, maxChars));
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: unknown): string {
  return boundedCarePassLine(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlBlock(value: unknown): string {
  return boundCarePassText(value, CARE_PASS_MESSAGE_MAX_CHARS)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CARE_PASS_FILE_NAME_MAX_CHARS = 96;
const CARE_PASS_FILE_STEM_MAX_CHARS = 80;
const CARE_PASS_FILE_TRUNCATION_MARKER = "---";

function capCarePassFileStem(stem: string, maxChars = CARE_PASS_FILE_STEM_MAX_CHARS): string {
  if (stem.length <= maxChars) return stem;
  const remaining = maxChars - CARE_PASS_FILE_TRUNCATION_MARKER.length;
  const headLength = Math.ceil(remaining * 0.65);
  return `${stem.slice(0, headLength)}${CARE_PASS_FILE_TRUNCATION_MARKER}${stem.slice(-(remaining - headLength))}`;
}

function slugify(value: string): string {
  const raw = String(value ?? "");
  const bounded = raw.length <= 512
    ? raw
    : `${raw.slice(0, 300)} content shortened ${raw.slice(-190)}`;
  const stem = clean(bounded)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "care-pass";
  return capCarePassFileStem(stem);
}

function normalizeStoredCarePassHtmlFileName(value: unknown, fallback: string): string {
  const rawValue = String(value ?? "");
  const boundedValue = rawValue.length <= 512
    ? rawValue
    : `${rawValue.slice(0, 300)} content shortened ${rawValue.slice(-190)}`;
  const raw = clean(boundedValue);
  if (!raw) return fallback;
  const withoutExtension = raw.replace(/\.[a-z0-9]+$/i, "");
  const normalized = withoutExtension
    .replace(/[\\/:*?"<>|#%{}^[\]`]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "") || "care-pass";
  const maxStemChars = CARE_PASS_FILE_NAME_MAX_CHARS - ".html".length;
  return `${capCarePassFileStem(normalized, maxStemChars)}.html`;
}

function notEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function printDateStamp(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "saved";
  return parsed.toISOString().slice(0, 10);
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function hasText(value: unknown): boolean {
  return clean(value).length > 0;
}

function hasProofMime(value: unknown): boolean {
  const mime = lower(value);
  return mime === "application/json" || mime === "application/pdf" || mime === "text/markdown" || mime === "text/plain";
}

function hasPositiveByteSize(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasEnoughBuckets(value: unknown): boolean {
  return Array.isArray(value) && value.map(clean).filter(Boolean).length >= 3;
}

export function isCarePassStorageProviderProofReady(options: CarePassArtifactStorageOptions = {}): boolean {
  const evidence = options.storageProviderEvidence;
  if (!options.storageProviderConfigured || !evidence) return false;

  const locator = `${lower(evidence.fileName)} ${lower(evidence.uri)}`;
  const namesStorageProof =
    locator.includes("storage") &&
    locator.includes("proof") &&
    (locator.includes("attachment") || locator.includes("care-pass") || locator.includes("report"));

  return Boolean(
    namesStorageProof &&
      hasProofMime(evidence.mimeType) &&
      hasPositiveByteSize(evidence.byteSize) &&
      hasEnoughBuckets(evidence.bucketNames) &&
      hasText(evidence.signedUploadPolicy) &&
      hasText(evidence.signedDownloadPolicy) &&
      hasText(evidence.householdScopePolicy) &&
      hasText(evidence.retentionPolicy) &&
      hasText(evidence.exportPolicy) &&
      hasText(evidence.deletionPolicy) &&
      hasText(evidence.qaEvidenceStoragePolicy) &&
      hasText(evidence.apolloApprovalOwner) &&
      evidence.signedAccessApproved === true &&
      evidence.householdScopeApproved === true &&
      evidence.retentionExportDeletionApproved === true &&
      evidence.qaEvidenceStorageApproved === true &&
      evidence.apolloApproved === true,
  );
}

function entryLabel(entry: CareHealthEntry): string {
  const title = boundedCarePassLine(entry.title) || normalizeCareEventType(entry.type, entry.details);
  const caregiver = boundedCarePassLine(entry.caregiver, 256);
  const time = new Date(entry.occurredAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return caregiver ? `${title} (${caregiver}, ${time})` : `${title} (${time})`;
}

function latestEntries(
  entries: readonly CareHealthEntry[],
  type: string,
  limit: number,
): CareHealthEntry[] {
  return [...entries]
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === type)
    .sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, limit);
}

function detailRecord(entry: CareHealthEntry): Record<string, unknown> {
  return entry.details != null && typeof entry.details === "object" && !Array.isArray(entry.details)
    ? entry.details
    : {};
}

function lower(value: unknown): string {
  return clean(value).toLowerCase();
}

function isHouseholdVisible(entry: CareHealthEntry): boolean {
  return isHouseholdVisibleCareEvidence(entry);
}

function isPendingMeal(entry: CareHealthEntry): boolean {
  const details = detailRecord(entry);
  const completion = lower(details.mealCompletion ?? details.completion ?? details.outcome);
  const lifecycle = lower(details.mealLifecycle);
  return ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(completion) ||
    ["served", "pending", "outcome-pending", "still grazing", "grazing"].includes(lifecycle);
}

function hasExactEatenAmount(details: Record<string, unknown>): boolean {
  return Number.isFinite(Number(details.eatenAmount ?? details.amountEaten ?? details.eatenQuantity));
}

function isEstimatedMeal(entry: CareHealthEntry): boolean {
  const details = detailRecord(entry);
  const completion = lower(details.mealCompletion ?? details.completion ?? details.outcome);
  if (details.eatenAmountEstimated === true) return true;
  return ["partial", "ate some", "some"].includes(completion) && !hasExactEatenAmount(details);
}

function hasCorrectionAudit(entry: CareHealthEntry): boolean {
  const details = detailRecord(entry);
  if (lower(details.trustState) === "corrected") return true;
  const auditTrail = Array.isArray(details.auditTrail) ? details.auditTrail : [];
  return auditTrail.some((event) => {
    if (event == null || typeof event !== "object" || Array.isArray(event)) return false;
    const record = event as Record<string, unknown>;
    return lower(record.action) === "corrected" || lower(record.summary).includes("corrected");
  });
}

function mealFollowUpLines(entries: readonly CareHealthEntry[], limit = 6): string[] {
  return entries
    .filter((entry) => normalizeCareEventType(entry.type, entry.details) === "meal" && isHouseholdVisible(entry))
    .flatMap((entry) => {
      const label = entryLabel(entry);
      return [
        isPendingMeal(entry) ? `Outcome pending: ${label} - update eaten amount before sharing.` : "",
        isEstimatedMeal(entry) ? `Estimated amount: ${label} - confirm exact eaten amount if possible.` : "",
        hasCorrectionAudit(entry) ? `Corrected outcome: ${label} - review audit history before sharing.` : "",
      ].filter(notEmpty);
    })
    .slice(0, limit);
}

function section(title: string, lines: string[]): CarePassSection | null {
  const cleaned = lines
    .slice(0, CARE_PASS_MAX_LINES_PER_SECTION)
    .map((line) => boundedCarePassLine(line))
    .filter(notEmpty);
  return cleaned.length
    ? { title: boundedCarePassLine(title, 128), lines: cleaned }
    : null;
}

function walkRouteTemplateLine(template: WalkRouteTemplate): string {
  const visits = `${template.visits} ${template.visits === 1 ? "visit" : "visits"}`;
  const dogInteractions = `${template.dogInteractions} dog ${template.dogInteractions === 1 ? "interaction" : "interactions"}`;
  return `${template.name} (${visits}, ${template.averageMinutes}m avg, ${dogInteractions}) - ${template.suggestedUse}`;
}

function careTrendSignalLine(signal: CareTrendSignal): string {
  return `Watch: ${signal.label} - ${signal.detail} Action: ${signal.action}`;
}

function trainingLatestLine(item: TrainingProgressItem | null): string {
  if (!item) return "";
  return `Latest: ${item.label} - ${item.outcome} with ${item.caregiver}`;
}

function aloneLatestLine(item: AloneTimeItem | null): string {
  if (!item) return "";
  const lead = [item.outcome, item.caregiver ? `with ${item.caregiver}` : ""].filter(Boolean).join(" ");
  const parts = [
    lead,
    item.durationMinutes ? `${item.durationMinutes}m` : "",
    item.recoveryMinutes ? `${item.recoveryMinutes}m recovery` : "",
  ].filter(Boolean);
  return `Latest: ${item.label} - ${parts.join(", ")}`;
}

function weightLatestLine(item: WeightTrendItem | null): string {
  if (!item) return "";
  return `Latest: ${item.weight} ${item.unit} by ${item.caregiver}`;
}

function groomingLatestLine(item: GroomingCareItem | null): string {
  if (!item) return "";
  return `Latest: ${item.label} - ${item.kindLabel} with ${item.caregiver}`;
}

function incidentLatestLine(item: IncidentWatchItem | null): string {
  if (!item) return "";
  const parts = [
    item.kind,
    item.trigger ? `trigger: ${item.trigger}` : "",
    item.exposure ? `exposure: ${item.exposure}` : "",
    item.injuryLevel ? `injury: ${item.injuryLevel}` : "",
  ].filter(Boolean);
  return `Latest: ${item.label} - ${parts.join(", ")} with ${item.caregiver}`;
}

function audienceChecklist(audience: CarePassAudience, name: string): string[] {
  if (audience === "vet") {
    return [
      "Review Health Watch patterns as owner-reported context, not a diagnosis.",
      "Compare appetite, stool, vomit, weight, medication, and record history.",
      "Tell the household what to monitor next and when to seek follow-up care.",
    ];
  }
  if (audience === "trainer") {
    return [
      "Review routine, activity, appetite, anxiety, and recovery context before the session.",
      "Log training wins, triggers, dog interactions, and next practice notes.",
      "Flag any behavior, energy, or health change for the household before leaving.",
    ];
  }
  if (audience === "caregiver") {
    return [
      "Check the next routine and owner assignment before starting care.",
      "Log what happened with notes so the next household member has context.",
      "Review Health Watch if appetite, stool, vomit, energy, or mood changes.",
    ];
  }
  return [
    `Confirm the next routine for ${name} before leaving.`,
    "Log meals with expected portion, served amount, eaten amount, completion, and notes.",
    "Review Health Watch and contact the owner if appetite, stool, vomit, energy, or mood changes.",
  ];
}

function renderMessage(pass: Omit<CarePass, "message">): string {
  const parts = [
    pass.title,
    pass.summary,
    `Generated: ${pass.generatedAt}`,
    "",
    ...pass.sections.flatMap((item) => [
      item.title,
      ...item.lines.map((line) => `- ${line}`),
      "",
    ]),
  ];
  return boundCarePassText(parts.join("\n").trim(), CARE_PASS_MESSAGE_MAX_CHARS);
}

function normalizeCarePassForOutput(pass: CarePass): CarePass {
  const sections = (Array.isArray(pass.sections) ? pass.sections : [])
    .slice(0, CARE_PASS_MAX_SECTIONS)
    .map((item) => ({
      title: boundedCarePassLine(item?.title, 128),
      lines: (Array.isArray(item?.lines) ? item.lines : [])
        .slice(0, CARE_PASS_MAX_LINES_PER_SECTION)
        .map((line) => boundedCarePassLine(line))
        .filter(notEmpty),
    }))
    .filter((item) => item.title && item.lines.length > 0);
  return {
    ...pass,
    title: boundedCarePassLine(pass.title, CARE_PASS_TITLE_MAX_CHARS),
    summary: boundedCarePassLine(pass.summary, CARE_PASS_SUMMARY_MAX_CHARS),
    generatedAt: boundedCarePassLine(pass.generatedAt, 128),
    sections,
    message: boundCarePassText(pass.message, CARE_PASS_MESSAGE_MAX_CHARS),
  };
}

export function renderCarePassPrintHtml(pass: CarePass): string {
  const safePass = normalizeCarePassForOutput(pass);
  const sections = safePass.sections
    .map((item) => `
      <section class="section">
        <h2>${escapeHtml(item.title)}</h2>
        <ul>
          ${item.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n          ")}
        </ul>
      </section>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(safePass.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1a2332;
      --muted: #5f6f63;
      --line: #d4cfc4;
      --wash: #f7f5f1;
      --accent: #2e5846;
      --copper: #c87a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--wash);
      color: var(--ink);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.48;
    }
    main {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 32px;
      background: #ffffff;
      min-height: 100vh;
    }
    header {
      border-bottom: 2px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand {
      color: var(--copper);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    h1 {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 34px;
      line-height: 1.08;
      margin: 0;
    }
    .summary {
      color: var(--muted);
      font-size: 14px;
      margin: 10px 0 0;
    }
    .generated {
      color: var(--muted);
      font-size: 12px;
      margin-top: 6px;
    }
    .section {
      break-inside: avoid;
      border-bottom: 1px solid var(--line);
      padding: 16px 0;
    }
    h2 {
      color: var(--accent);
      font-size: 15px;
      letter-spacing: 0.02em;
      margin: 0 0 8px;
    }
    ul {
      margin: 0;
      padding-left: 18px;
    }
    li {
      margin: 5px 0;
      font-size: 13.5px;
    }
    footer {
      color: var(--muted);
      font-size: 11.5px;
      padding-top: 18px;
    }
    @media print {
      body { background: #ffffff; }
      main { max-width: none; padding: 24px; }
      header { margin-bottom: 16px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">WoofWatcher Care Pass</div>
      <h1>${escapeHtml(safePass.title)}</h1>
      <p class="summary">${escapeHtml(safePass.summary)}</p>
      <div class="generated">Generated ${escapeHtml(safePass.generatedAt)}</div>
    </header>
${sections}
    <footer>
      WoofWatcher organizes owner-reported care context for handoff and veterinarian review. It does not diagnose or replace veterinary care.
    </footer>
  </main>
</body>
</html>`;
}

function renderLegacyArtifactPrintHtml(artifact: CarePassArtifact): string {
  const sectionTitles = Array.isArray(artifact.sectionTitles) ? artifact.sectionTitles : [];
  const sections = sectionTitles
    .map(clean)
    .filter(notEmpty)
    .map((title) => `
      <section class="section">
        <h2>${escapeHtml(title)}</h2>
      </section>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(artifact.title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1a2332;
      --muted: #5f6f63;
      --line: #d4cfc4;
      --wash: #f7f5f1;
      --accent: #2e5846;
      --copper: #c87a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--wash);
      color: var(--ink);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.48;
    }
    main {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 32px;
      background: #ffffff;
      min-height: 100vh;
    }
    header {
      border-bottom: 2px solid var(--line);
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand {
      color: var(--copper);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    h1 {
      font-family: "Playfair Display", Georgia, serif;
      font-size: 34px;
      line-height: 1.08;
      margin: 0;
    }
    .summary {
      color: var(--muted);
      font-size: 14px;
      margin: 10px 0 0;
    }
    .generated {
      color: var(--muted);
      font-size: 12px;
      margin-top: 6px;
    }
    .section {
      break-inside: avoid;
      border-bottom: 1px solid var(--line);
      padding: 16px 0;
    }
    h2 {
      color: var(--accent);
      font-size: 15px;
      letter-spacing: 0.02em;
      margin: 0;
    }
    pre {
      white-space: pre-wrap;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--wash);
      padding: 16px;
      font: 13.5px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    footer {
      color: var(--muted);
      font-size: 11.5px;
      padding-top: 18px;
    }
    @media print {
      body { background: #ffffff; }
      main { max-width: none; padding: 24px; }
      header { margin-bottom: 16px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">WoofWatcher Care Pass</div>
      <h1>${escapeHtml(artifact.title)}</h1>
      <p class="summary">${escapeHtml(artifact.summary || "Saved Care Pass report.")}</p>
      <div class="generated">Generated ${escapeHtml(artifact.generatedAt)}</div>
    </header>
${sections}
    <section class="section">
      <h2>Saved Report Text</h2>
      <pre>${escapeHtmlBlock(artifact.message)}</pre>
    </section>
    <footer>
      WoofWatcher organizes owner-reported care context for handoff and veterinarian review. It does not diagnose or replace veterinary care.
    </footer>
  </main>
</body>
</html>`;
}

export function getCarePassArtifactPrintView(artifact: CarePassArtifact): CarePassArtifactPrintView {
  const storedHtml = typeof artifact.printHtml === "string" && artifact.printHtml.trim().length > 0;
  const fallbackFileName = `${slugify(artifact.title)}-${printDateStamp(artifact.createdAt)}.html`;
  return {
    fileName: normalizeStoredCarePassHtmlFileName(
      artifact.printFileName,
      fallbackFileName,
    ),
    html: storedHtml ? artifact.printHtml as string : renderLegacyArtifactPrintHtml(artifact),
    status: storedHtml ? "ready" : "restored",
  };
}

export function describeCarePassArtifactStorage(
  artifact: Pick<CarePassArtifact, "storageStatus">,
  options: CarePassArtifactStorageOptions = {},
): CarePassArtifactStorageView {
  const baseStatus = artifact.storageStatus ?? "local-only";
  const storageProviderProofReady = isCarePassStorageProviderProofReady(options);
  const status =
    baseStatus === "uploaded" || baseStatus === "failed"
      ? baseStatus
      : storageProviderProofReady
        ? "upload-ready"
        : "local-only";
  const missingStructuredProof =
    (options.storageProviderConfigured === true || baseStatus === "upload-ready") && !storageProviderProofReady;
  if (status === "uploaded") {
    return {
      status,
      label: "Provider stored",
      detail: "Uploaded to provider storage for account-backed resend.",
      providerBacked: true,
    };
  }
  if (status === "upload-ready") {
    return {
      status,
      label: "Ready to upload",
      detail: "Print source is saved locally and ready for provider storage once signed access, retention, export, and deletion rules are approved.",
      providerBacked: false,
    };
  }
  if (status === "failed") {
    return {
      status,
      label: "Upload needs retry",
      detail: "Local report copy is safe; provider upload needs a retry.",
      providerBacked: false,
    };
  }
  return {
    status: "local-only",
    label: "Saved locally",
    detail: missingStructuredProof
      ? "Provider storage is staged, but this report stays saved locally until structured storage proof covers buckets, signed access, household scope, retention, export, deletion, QA evidence storage, and Apollo approval."
      : "Cloud storage pending - saved on this device as text and print-ready HTML source.",
    providerBacked: false,
  };
}

export function describeCarePassArtifactExport(
  artifact: CarePassArtifact,
  options: CarePassArtifactExportOptions = {},
): CarePassArtifactExportView {
  const printable = getCarePassArtifactPrintView(artifact);
  const storage = describeCarePassArtifactStorage(artifact, options);
  const sourceLabel = printable.status === "ready" ? "Print-ready" : "Print restored";
  const byteSize = utf8ByteLength(printable.html);
  const generatedPdf =
    options.generatedPdf?.mimeType === "application/pdf" &&
    clean(options.generatedPdf.fileName) &&
    Number.isFinite(options.generatedPdf.byteSize) &&
    options.generatedPdf.byteSize > 0
      ? options.generatedPdf
      : null;
  const pdfDetail = generatedPdf
    ? `${generatedPdf.fileName} was generated locally (${Math.round(generatedPdf.byteSize).toLocaleString("en-US")} bytes); native share and reopen proof still required on iOS and Android. ${storage.providerBacked ? "Provider-backed storage proof is attached." : "Provider storage is not enabled for this artifact."}`
    : "No generated local PDF is attached to this export view; the printable HTML source remains available without claiming PDF readiness.";
  return {
    fileName: printable.fileName,
    mimeType: "text/html",
    formatLabel: "Printable HTML",
    sourceStatus: printable.status,
    byteSize,
    pdfStatus: generatedPdf ? "generated-local" : "not-generated",
    pdfDetail,
    storage,
    providerBacked: storage.providerBacked,
    manifestRows: [
      {
        label: "Format",
        value: "Printable HTML",
        detail: `${Math.max(1, Math.ceil(byteSize / 1024))} KB source for print/share.`,
      },
      {
        label: "Source",
        value: sourceLabel,
        detail: printable.status === "ready" ? "Saved from the generated Care Pass." : "Restored from saved report text.",
      },
      {
        label: "PDF",
        value: generatedPdf ? "PDF generated locally" : "PDF not generated",
        detail: pdfDetail,
      },
      {
        label: "Storage",
        value: storage.label,
        detail: storage.detail,
      },
    ],
  };
}

export function buildCarePass(input: CarePassInput): CarePass {
  const now = input.now ?? Date.now();
  const sourceProfile = input.profile ?? {};
  const profile: CarePassProfile = {
    ...sourceProfile,
    name: boundedCarePassLine(sourceProfile.name, 128),
    breed: boundedCarePassLine(sourceProfile.breed, 512),
    careFocus: boundedCarePassLine(sourceProfile.careFocus, 512),
    vetBoundary: boundedCarePassLine(sourceProfile.vetBoundary, 512),
    ...(sourceProfile.weight
      ? {
          weight: {
            ...sourceProfile.weight,
            goal: boundedCarePassLine(sourceProfile.weight.goal, 256),
            unit: ["lb", "kg"].includes(
              boundedCarePassLine(sourceProfile.weight.unit, 8).toLowerCase(),
            )
              ? boundedCarePassLine(sourceProfile.weight.unit, 8).toLowerCase()
              : "lb",
          },
        }
      : {}),
  };
  const sourceDiet = input.dietProfile ?? {};
  const diet: CarePassDietProfile = {
    primaryFood: boundedCarePassLine(sourceDiet.primaryFood, 512),
    normalPortion: boundedCarePassLine(sourceDiet.normalPortion, 512),
    mealSchedule: boundedCarePassLine(sourceDiet.mealSchedule, 512),
    bedtimeSnack: boundedCarePassLine(sourceDiet.bedtimeSnack, 512),
    avoid: boundedCarePassLine(sourceDiet.avoid, 512),
    sensitivities: boundedCarePassLine(sourceDiet.sensitivities, 512),
    appetiteQuirks: boundedCarePassLine(sourceDiet.appetiteQuirks, 512),
    vetNotes: boundedCarePassLine(sourceDiet.vetNotes, 512),
  };
  // Privacy/truthfulness chokepoint: the Care Pass is a shared artifact, so
  // private logs are rejected before their timestamp or content is observed,
  // and future/malformed logs are rejected before any section derives from
  // them. Filtering once at the entrance keeps every downstream helper and
  // every exported section on the same observable evidence set.
  const entries = selectSharedCareEvidence(input.entries ?? [], now);
  const routines = input.routines ?? [];
  const records = input.records ?? [];
  // The share artifact must agree with every app surface: the stored "My Dog"
  // placeholder (and an empty name) resolve to the same display name the rest
  // of the app shows, never a raw placeholder in the pass title or Dog card.
  const name = resolvePetName(clean(profile.name));
  const isNeutralPetName = name === DEFAULT_PET_DISPLAY_NAME;
  const audienceLabel = AUDIENCE_LABEL[input.audience];
  const generatedAt = formatDateTime(now);
  // Every derive helper that writes dog-name copy gets the same resolved name,
  // so the shared pass uses the current name or a neutral fresh-install fallback.
  const health = deriveHealthWatch({ entries, routines, now, petName: name });
  const handoff = deriveCareHandoff({
    entries,
    routines,
    caregivers: input.caregivers ?? [],
    now,
  });
  const medication = deriveMedicationAdherence({ entries, routines, now });
  const medicationFollowUps = deriveMedicationFollowUps({ entries, routines, records, now }).slice(0, 4);
  const hydration = deriveWaterHydration({ entries, now });
  const walkActivity = deriveWalkActivity({ entries, now, petName: name });
  const walkRouteTemplates = deriveWalkRouteTemplates({ entries, now, limit: 3 });
  const pottyHealth = derivePottyHealth({ entries, now, petName: name });
  const careTrends = deriveCareTrends({ entries, now, windowDays: 7 });
  const dietProgress = deriveDietProgress({ dietProfile: diet, entries, now });
  const trainingProgress = deriveTrainingProgress({ entries, now, lookbackDays: 30 });
  const aloneTime = deriveAloneTime({ entries, now, lookbackDays: 30 });
  const weightTrend = deriveWeightTrend({ entries, profile, goals: input.goals ?? [], now, lookbackDays: 90, petName: name });
  const groomingCare = deriveGroomingCare({ entries, now, lookbackDays: 45 });
  const incidentWatch = deriveIncidentWatch({ entries, now, lookbackDays: 90, petName: name });

  const latestMeals = latestEntries(entries, "meal", 2);
  const latestWalks = latestEntries(entries, "walk", 2);
  const latestHealth = [...entries]
    .filter((entry) => {
      const type = normalizeCareEventType(entry.type, entry.details);
      return type === "vomit" || type === "symptom" || entry.severity === "watch" || entry.severity === "urgent";
    })
    .sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, 4);

  const summary = isNeutralPetName
    ? input.audience === "vet"
      ? "Your dog's health and care context for veterinarian review."
      : input.audience === "trainer"
        ? "Your dog's behavior, routine, and activity context for training."
        : `Care handoff for your dog with ${audienceLabel.toLowerCase()} support.`
    : input.audience === "vet"
      ? `${name} health and care context for veterinarian review.`
      : input.audience === "trainer"
        ? `${name} behavior, routine, and activity context for training.`
        : `${name} care handoff for ${audienceLabel.toLowerCase()} support.`;
  const mealAmountNotes = [
    dietProgress.pendingMealCount
      ? `${dietProgress.pendingMealCount} outcome${dietProgress.pendingMealCount === 1 ? "" : "s"} pending`
      : "",
    dietProgress.estimatedMealCount
      ? `${dietProgress.estimatedMealCount} estimated partial amount${dietProgress.estimatedMealCount === 1 ? "" : "s"}`
      : "",
  ].filter(notEmpty).join("; ");

  const sections = [
    section("Dog", [
      `${name}${profile.breed ? ` - ${profile.breed}` : ""}`,
      profile.weight?.current ? `Weight: ${profile.weight.current} ${profile.weight.unit ?? "lb"}` : "",
      profile.careFocus ? `Care focus: ${profile.careFocus}` : "",
    ]),
    section("Next Care", [
      handoff.next ? `${handoff.next.label} at ${handoff.next.time}${handoff.next.owner ? ` with ${handoff.next.owner}` : ""}` : "No upcoming routine is currently scheduled.",
      // Each attention item is its own full sentence; gluing them with "; "
      // produced machine-joined text like "...still open.; Walk remaining...".
      ...handoff.sections.needsAttention.map((item) => `${item.label}: ${item.detail}`),
      handoff.message,
    ]),
    section("Handoff Checklist", audienceChecklist(input.audience, name)),
    section("Care Trends", [
      `${careTrends.windowDays}-day trends`,
      careTrends.summary,
      careTrends.current.meals.total
        ? `Meals: ${careTrends.current.meals.complete} complete, ${careTrends.current.meals.partial} partial, ${careTrends.current.meals.skipped} skipped${careTrends.current.meals.pending ? `, ${careTrends.current.meals.pending} pending outcome${careTrends.current.meals.pending === 1 ? "" : "s"}` : ""}`
        : "",
      careTrends.current.walks.count
        ? `Walks: ${careTrends.current.walks.totalMinutes} min${careTrends.deltas.walkMinutes ? ` (${careTrends.deltas.walkMinutes > 0 ? "+" : ""}${careTrends.deltas.walkMinutes} vs prior window)` : ""}`
        : "",
      careTrends.current.water.logs ? `Water: ${careTrends.current.water.refillEquivalent} bowl refills` : "",
      careTrends.current.potty.total ? `Potty: ${careTrends.current.potty.watchCount} review logs` : "",
      ...careTrends.signals.slice(0, 3).map(careTrendSignalLine),
      careTrends.nextStep,
    ]),
    section("Diet", [
      diet.primaryFood ? `Food: ${diet.primaryFood}` : "",
      diet.normalPortion ? `Portion: ${diet.normalPortion}` : "",
      diet.mealSchedule ? `Schedule: ${diet.mealSchedule}` : "",
      dietProgress.targetAmount != null || dietProgress.mealCount
        ? `Daily food: ${dietProgress.summary}`
        : "",
      mealAmountNotes ? `Meal amount note: ${mealAmountNotes}` : "",
      diet.bedtimeSnack ? `Bedtime snack: ${diet.bedtimeSnack}` : "",
      diet.avoid ? `Avoid: ${diet.avoid}` : "",
      diet.sensitivities ? `Sensitivities: ${diet.sensitivities}` : "",
      diet.appetiteQuirks ? `Appetite notes: ${diet.appetiteQuirks}` : "",
    ]),
    section("Meal Follow-ups", mealFollowUpLines(entries)),
    section("Weight Trend", [
      weightTrend.summary,
      weightTrend.goalWeight ? `Goal: ${weightTrend.goalWeight} ${weightTrend.unit}` : "",
      weightTrend.changeFromPrevious ? `Change: ${weightTrend.changeFromPrevious > 0 ? "+" : ""}${weightTrend.changeFromPrevious} ${weightTrend.unit} from previous weigh-in` : "",
      weightLatestLine(weightTrend.latest),
      weightTrend.nextStep,
      "Weight is owner-reported context for caregiver and veterinarian review, not a diagnosis.",
    ]),
    section("Hydration", [
      hydration.summary,
      hydration.last ? `Latest: ${hydration.last.amountLabel} by ${hydration.last.caregiver}` : "",
      hydration.nextStep,
    ]),
    section("Walk Activity", [
      walkActivity.summary,
      walkActivity.places.length ? `Places: ${walkActivity.places.join(", ")}` : "",
      walkActivity.last ? `Latest: ${walkActivity.last.label}${walkActivity.last.place ? ` at ${walkActivity.last.place}` : ""} by ${walkActivity.last.caregiver}` : "",
      walkActivity.last?.socialOutcome ? `Social notes: ${walkActivity.last.socialOutcome}` : "",
      walkRouteTemplates.length ? `Saved routes: ${walkRouteTemplates.map(walkRouteTemplateLine).join("; ")}` : "",
      walkActivity.nextStep,
    ]),
    section("Training Progress", [
      trainingProgress.summary,
      trainingProgress.focusSkills.length ? `Skills: ${trainingProgress.focusSkills.slice(0, 5).join(", ")}` : "",
      trainingProgress.totalSessions
        ? `Outcomes: ${trainingProgress.winCount} wins, ${trainingProgress.practiceCount} practice, ${trainingProgress.struggleCount} struggle`
        : "",
      trainingLatestLine(trainingProgress.latest),
      trainingProgress.latest?.trigger ? `Trigger/context: ${trainingProgress.latest.trigger}` : "",
      trainingProgress.latest?.nextPractice ? `Next practice: ${trainingProgress.latest.nextPractice}` : "",
      trainingProgress.nextStep,
    ]),
    section("Alone Time", [
      aloneTime.summary,
      aloneTime.totalSessions
        ? `Outcomes: ${aloneTime.calmCount} calm, ${aloneTime.anxiousCount} anxious, ${aloneTime.distressedCount} distressed`
        : "",
      aloneTime.triggers.length ? `Triggers: ${aloneTime.triggers.slice(0, 5).join(", ")}` : "",
      aloneTime.supports.length ? `Supports: ${aloneTime.supports.slice(0, 5).join(", ")}` : "",
      aloneTime.averageRecoveryMinutes ? `Average recovery: ${aloneTime.averageRecoveryMinutes} minutes` : "",
      aloneLatestLine(aloneTime.latest),
      aloneTime.nextStep,
    ]),
    section("Grooming Care", [
      groomingCare.summary,
      groomingCare.totalSessions
        ? `Types: ${groomingCare.brushCount} brush, ${groomingCare.bathCount} bath, ${groomingCare.nailCount} nails, ${groomingCare.teethCount} teeth`
        : "",
      groomingLatestLine(groomingCare.latest),
      groomingCare.latest?.condition ? `Coat note: ${groomingCare.latest.condition}` : "",
      groomingCare.products.length ? `Products: ${groomingCare.products.slice(0, 5).join(", ")}` : "",
      groomingCare.nextDue ? `Next due: ${groomingCare.nextDue}` : "",
      groomingCare.nextStep,
      "Grooming is owner-reported coat and grooming context for handoff and veterinarian review, not a diagnosis.",
    ]),
    section("Incident Watch", [
      incidentWatch.summary,
      incidentWatch.totalIncidents
        ? `Outcomes: ${incidentWatch.watchCount} watch, ${incidentWatch.alertCount} review alerts, ${incidentWatch.followUpCount} follow-ups`
        : "",
      `Trend: ${incidentWatch.trend.label} - ${incidentWatch.trend.detail}`,
      incidentWatch.triggers.length ? `Triggers: ${incidentWatch.triggers.slice(0, 5).join(", ")}` : "",
      incidentWatch.exposures.length ? `Exposure/context: ${incidentWatch.exposures.slice(0, 5).join(", ")}` : "",
      incidentWatch.injuryCount ? `Injury checks: ${incidentWatch.injuryCount} noted` : "",
      incidentLatestLine(incidentWatch.latest),
      incidentWatch.latest?.actionTaken ? `Action taken: ${incidentWatch.latest.actionTaken}` : "",
      incidentWatch.latest?.followUp ? `Follow-up: ${incidentWatch.latest.followUp}` : "",
      incidentWatch.followUpTasks.length
        ? `Owner follow-ups: ${incidentWatch.followUpTasks.map((task) => task.label).join("; ")}`
        : "",
      incidentWatch.trainerGoals.length
        ? `Trainer goal ideas: ${incidentWatch.trainerGoals.map((goal) => `${goal.label} (${goal.evidence})`).join("; ")}`
        : "",
      incidentWatch.nextStep,
      "Incident Watch is factual owner-reported context for household, trainer, sitter, or veterinarian review; it does not diagnose behavior or medical issues.",
    ]),
    section("Potty Health", [
      pottyHealth.summary,
      pottyHealth.conditions.length ? `Conditions: ${pottyHealth.conditions.join(", ")}` : "",
      pottyHealth.stoolColors.length ? `Colors: ${pottyHealth.stoolColors.join(", ")}` : "",
      pottyHealth.contexts.length ? `Context: ${pottyHealth.contexts.join(", ")}` : "",
      pottyHealth.last
        ? `Latest: ${pottyHealth.last.label} - ${[
            pottyHealth.last.kindLabel,
            pottyHealth.last.condition,
            pottyHealth.last.stoolColor,
            pottyHealth.last.context,
          ].filter(Boolean).join(", ")}`
        : "",
      pottyHealth.nextStep,
    ]),
    section("Medication", [
      medication.total > 0 ? medication.summary : "",
      ...medication.items.slice(0, 6).map((item) => (
        `${item.label}: ${item.status}${item.dose ? ` - ${item.dose}` : ""}${item.time ? ` at ${item.time}` : ""}${item.takenBy ? ` by ${item.takenBy}` : ""}`
      )),
      ...medicationFollowUps.map((item) => `${item.label}: ${item.detail} Action: ${item.action}`),
    ]),
    section(
      "Health Pattern Review",
      health.patterns.slice(0, 4).map((pattern) => (
        `${pattern.label} (${pattern.window}): ${pattern.evidence} Next: ${pattern.nextStep}`
      )),
    ),
    section("Health Watch", [
      `${health.status === "good" ? "Health steady" : health.status === "alert" ? "Health alert" : "Health watch"}: ${health.summary}`,
      ...health.signals.slice(0, 4).map((signal) => `${signal.label}: ${signal.detail}`),
      ...health.redFlags.slice(0, 3).map((flag) => `Red flag: ${flag.label}${flag.detail ? ` - ${flag.detail}` : ""}`),
      profile.vetBoundary || health.vetBoundary,
    ]),
    section("Recent Care", [
      ...latestMeals.map((entry) => `Meal: ${entryLabel(entry)}`),
      ...latestWalks.map((entry) => `Walk: ${entryLabel(entry)}`),
      ...latestHealth.map((entry) => `Health: ${entryLabel(entry)}`),
    ]),
    input.audience === "trainer"
      ? section("Training focus", [
          profile.careFocus ? `Focus: ${profile.careFocus}` : "",
          diet.appetiteQuirks ? `Food/anxiety context: ${diet.appetiteQuirks}` : "",
          latestWalks[0] ? `Recent activity: ${entryLabel(latestWalks[0])}` : "",
        ])
      : null,
    input.audience === "vet"
      ? section("Records", records.slice(0, 6).map((record) => (
          `${record.title}${recordDueNeedsCorrection(record) ? " - date needs correction" : record.due ? ` due ${record.due}` : ""}${record.note ? ` - ${record.note}` : ""}`
        )))
      : null,
  ].filter((item): item is CarePassSection => item !== null);

  const passWithoutMessage = {
    audience: input.audience,
    title: boundedCarePassLine(
      isNeutralPetName
        ? `${audienceLabel} Care Pass for your dog`
        : `${name} ${audienceLabel} Care Pass`,
      CARE_PASS_TITLE_MAX_CHARS,
    ),
    generatedAt,
    summary: boundedCarePassLine(summary, CARE_PASS_SUMMARY_MAX_CHARS),
    sections: sections.slice(0, CARE_PASS_MAX_SECTIONS),
  };

  return {
    ...passWithoutMessage,
    message: renderMessage(passWithoutMessage),
  };
}

export function createCarePassArtifact(
  pass: CarePass,
  createdAt: string = new Date().toISOString(),
): CarePassArtifact {
  const safePass = normalizeCarePassForOutput(pass);
  const safeStamp = clean(createdAt).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "");
  const dateStamp = new Date(createdAt).toISOString().slice(0, 10);
  return {
    id: `care_pass_${safePass.audience}_${safeStamp}`,
    kind: "care_pass",
    audience: safePass.audience,
    title: safePass.title,
    generatedAt: safePass.generatedAt,
    createdAt,
    summary: safePass.summary,
    sectionTitles: safePass.sections.map((section) => section.title),
    message: safePass.message,
    printFileName: `${slugify(safePass.title)}-${dateStamp}.html`,
    printHtml: renderCarePassPrintHtml(safePass),
    storageStatus: "local-only",
  };
}
