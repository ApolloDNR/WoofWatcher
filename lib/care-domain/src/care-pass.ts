import { normalizeCareEventType } from "./events.ts";
import { deriveAloneTime, type AloneTimeItem } from "./alone-time.ts";
import { deriveCareTrends, type CareTrendSignal } from "./care-trends.ts";
import { deriveCareHandoff, type CareHandoffCaregiver, type CareHandoffRoutine } from "./handoff.ts";
import { deriveHealthWatch, type CareHealthEntry } from "./health.ts";
import { deriveGroomingCare, type GroomingCareItem } from "./grooming-care.ts";
import { deriveMedicationAdherence, deriveMedicationFollowUps } from "./medication.ts";
import { deriveMoodTrend, type MoodTrendItem } from "./mood-trend.ts";
import { derivePottyHealth } from "./potty-health.ts";
import {
  derivePetCredentialReadiness,
  getPetCredentialPrintView,
  summarizeRecordVault,
  type PetCredential,
} from "./record-vault.ts";
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
  microchipNumber?: string;
  insuranceProvider?: string;
  insurancePolicy?: string;
  primaryVet?: string;
  emergencyContact?: string;
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
  attachmentUri?: string;
  attachmentName?: string;
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
}

export interface ProgressReportSection {
  title: string;
  lines: string[];
}

export interface ProgressReportArtifactInput {
  dogName: string;
  periodDays: number;
  generatedAt: string;
  createdAt?: string;
  summary: string;
  sections: readonly ProgressReportSection[];
}

export interface ProgressReportArtifact {
  id: string;
  kind: "progress_report";
  title: string;
  generatedAt: string;
  createdAt: string;
  summary: string;
  sections?: ProgressReportSection[];
  sectionTitles: string[];
  message: string;
  periodDays: number;
  dogName: string;
  printFileName?: string;
  printHtml?: string;
}

export interface PetCredentialArtifact {
  id: string;
  kind: "pet_credential";
  title: string;
  generatedAt: string;
  createdAt: string;
  summary: string;
  sectionTitles: string[];
  message: string;
  dogName: string;
  printFileName?: string;
  printHtml?: string;
}

export type ReportArtifact = CarePassArtifact | ProgressReportArtifact | PetCredentialArtifact;

export interface ReportArtifactPrintView {
  fileName: string;
  html: string;
  status: "ready" | "restored";
}

export type CarePassArtifactPrintView = ReportArtifactPrintView;

export interface PetCredentialArtifactSummary {
  total: number;
  latest: PetCredentialArtifact | null;
  summary: string;
  latestLine: string;
  action: string;
  boundaryLine: string;
}

export interface ReportArtifactSummary {
  total: number;
  carePassCount: number;
  progressReportCount: number;
  petCredentialCount: number;
  latest: ReportArtifact | null;
  summary: string;
  latestLine: string;
  action: string;
  audienceLine: string;
  reviewLine: string;
  cleanupLine: string;
  boundaryLine: string;
}

export interface ReportArtifactSourceDescription {
  kindLabel: string;
  metadataLine: string;
  fileLine: string;
  lifecycleLine: string;
}

export interface ReportArtifactRemovalCopy {
  title: string;
  body: string;
  confirmLabel: string;
  accessibilityLabel: string;
}

const AUDIENCE_LABEL: Record<CarePassAudience, string> = {
  caregiver: "Caregiver",
  sitter: "Sitter",
  vet: "Vet",
  trainer: "Trainer",
};

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: unknown): string {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlBlock(value: unknown): string {
  return String(value ?? "")
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

function slugify(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "care-pass";
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function printDateStamp(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "saved";
  return parsed.toISOString().slice(0, 10);
}

function entryLabel(entry: CareHealthEntry): string {
  const title = clean(entry.title) || normalizeCareEventType(entry.type, entry.details);
  const caregiver = clean(entry.caregiver);
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

function section(title: string, lines: string[]): CarePassSection | null {
  const cleaned = lines.map(clean).filter(notEmpty);
  return cleaned.length ? { title, lines: cleaned } : null;
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

function moodLatestLine(item: MoodTrendItem | null): string {
  if (!item) return "";
  const energy = item.energyLevel ? `, ${item.energyLevel} energy` : "";
  const context = item.context ? ` - ${item.context}` : "";
  return `Latest: ${item.moodLabel}${energy} by ${item.caregiver}${context}`;
}

function recordAttachmentPrepLines(records: readonly CarePassRecord[]): string[] {
  const vault = summarizeRecordVault(records);
  const summary = vault.localAttachmentSummary;
  if (summary.totalAttachable === 0) return [];
  return [
    `Local files: ${summary.withAttachment}/${summary.totalAttachable} receipts or documents attached.`,
    summary.missingAttachment > 0 && summary.missingAttachmentTitles.length
      ? `Needs local file: ${summary.missingAttachmentTitles.join(", ")}.`
      : "Receipts and documents in this report have local files ready on this device.",
    summary.boundaryLine,
  ];
}

function petCredentialPrepLines(input: {
  profile?: CarePassProfile;
  caregivers?: readonly CareHandoffCaregiver[];
  records?: readonly CarePassRecord[];
}): string[] {
  const readiness = derivePetCredentialReadiness(input);
  if (readiness.readyCount === 0 && readiness.missingLabels.length === readiness.totalCount) {
    return [];
  }
  return [
    `Dog ID fields: ${readiness.readyCount}/${readiness.totalCount} ready.`,
    readiness.availableLabels.length ? `Ready: ${readiness.availableLabels.join(", ")}.` : "",
    readiness.missingLabels.length
      ? `Needs Dog ID ${readiness.missingLabels.length === 1 ? "field" : "fields"}: ${readiness.missingLabels.join(", ")}.`
      : "Dog ID fields are ready for review before sharing.",
    readiness.boundaryLine,
  ];
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
  return parts.join("\n").trim();
}

export function renderCarePassPrintHtml(pass: CarePass): string {
  const sections = pass.sections
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
  <title>${escapeHtml(pass.title)}</title>
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
      <h1>${escapeHtml(pass.title)}</h1>
      <p class="summary">${escapeHtml(pass.summary)}</p>
      <div class="generated">Generated ${escapeHtml(pass.generatedAt)}</div>
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

function progressReportMessage(artifact: {
  title: string;
  summary: string;
  generatedAt: string;
  sections: readonly ProgressReportSection[];
}): string {
  return [
    artifact.title,
    artifact.summary,
    `Generated: ${artifact.generatedAt}`,
    "",
    ...artifact.sections.flatMap((item) => [
      item.title,
      ...item.lines.map((line) => `- ${line}`),
      "",
    ]),
  ].join("\n").trim();
}

export function renderProgressReportPrintHtml(artifact: ProgressReportArtifact): string {
  const sections = (artifact.sections?.length
    ? artifact.sections
    : artifact.sectionTitles.map((title) => ({ title, lines: [] })))
    .map((item) => {
      const escapedTitle = escapeHtml(item.title);
      const escapedLines = item.lines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("\n          ");
      return `
      <section class="section">
        <h2>${escapedTitle}</h2>
        ${escapedLines ? `<ul>\n          ${escapedLines}\n        </ul>` : ""}
      </section>`;
    })
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
      <div class="brand">WoofWatcher Progress Report</div>
      <h1>${escapeHtml(artifact.title)}</h1>
      <p class="summary">${escapeHtml(artifact.summary)}</p>
      <div class="generated">Generated ${escapeHtml(artifact.generatedAt)}</div>
    </header>
${sections}
    <footer>
      WoofWatcher organizes owner-reported care context for household, caregiver, and veterinarian review. It does not diagnose or replace veterinary care.
    </footer>
  </main>
</body>
</html>`;
}

function renderLegacyProgressReportPrintHtml(artifact: ProgressReportArtifact): string {
  const sections = artifact.sectionTitles
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
      <div class="brand">WoofWatcher Progress Report</div>
      <h1>${escapeHtml(artifact.title)}</h1>
      <p class="summary">${escapeHtml(artifact.summary || "Saved progress report.")}</p>
      <div class="generated">Generated ${escapeHtml(artifact.generatedAt)}</div>
    </header>
${sections}
    <section class="section">
      <h2>Saved Report Text</h2>
      <pre>${escapeHtmlBlock(artifact.message)}</pre>
    </section>
    <footer>
      WoofWatcher organizes owner-reported care context for household, caregiver, and veterinarian review. It does not diagnose or replace veterinary care.
    </footer>
  </main>
</body>
</html>`;
}

function renderLegacyPetCredentialPrintHtml(artifact: PetCredentialArtifact): string {
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
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 28px;
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
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">WoofWatcher Dog ID</div>
      <h1>${escapeHtml(artifact.title)}</h1>
      <p class="summary">${escapeHtml(artifact.summary || "Saved Dog ID credential source.")}</p>
    </header>
    <pre>${escapeHtmlBlock(artifact.message)}</pre>
    <footer>
      WoofWatcher organizes owner-reported credential context for handoff and veterinarian review. It does not replace veterinary care or official records.
    </footer>
  </main>
</body>
</html>`;
}

export function getReportArtifactPrintView(artifact: ReportArtifact): ReportArtifactPrintView {
  const storedHtml = typeof artifact.printHtml === "string" && artifact.printHtml.trim().length > 0;
  if (artifact.kind === "progress_report") {
    return {
      fileName: clean(artifact.printFileName) || `${slugify(artifact.title)}-${printDateStamp(artifact.createdAt)}.html`,
      html: storedHtml ? artifact.printHtml as string : renderLegacyProgressReportPrintHtml(artifact),
      status: storedHtml ? "ready" : "restored",
    };
  }
  if (artifact.kind === "pet_credential") {
    return {
      fileName: clean(artifact.printFileName) || `${slugify(artifact.title)}-${printDateStamp(artifact.createdAt)}.html`,
      html: storedHtml ? artifact.printHtml as string : renderLegacyPetCredentialPrintHtml(artifact),
      status: storedHtml ? "ready" : "restored",
    };
  }
  return {
    fileName: clean(artifact.printFileName) || `${slugify(artifact.title)}-${printDateStamp(artifact.createdAt)}.html`,
    html: storedHtml ? artifact.printHtml as string : renderLegacyArtifactPrintHtml(artifact),
    status: storedHtml ? "ready" : "restored",
  };
}

export function getCarePassArtifactPrintView(artifact: CarePassArtifact): CarePassArtifactPrintView {
  return getReportArtifactPrintView(artifact);
}

export function describeReportArtifactSource(artifact: ReportArtifact): ReportArtifactSourceDescription {
  const printable = getReportArtifactPrintView(artifact);
  const sectionCount = Array.isArray(artifact.sectionTitles) ? artifact.sectionTitles.length : 0;
  const kindLabel =
    artifact.kind === "progress_report"
      ? "Progress Report"
      : artifact.kind === "pet_credential"
        ? "Dog ID Credential"
        : "Care Pass";
  const sectionLabel = `${sectionCount} ${sectionCount === 1 ? "section" : "sections"}`;
  const printStatus = printable.status === "ready" ? "Print-ready source" : "Restored printable source";

  return {
    kindLabel,
    metadataLine: `${kindLabel} - ${sectionLabel} - ${printStatus}`,
    fileLine: `Printable source: ${printable.fileName}`,
    lifecycleLine: "Local printable source only; native PDF export, server-backed report storage, cloud sharing, retention, and deletion policy are not enabled.",
  };
}

export function describeReportArtifactRemoval(artifact: ReportArtifact): ReportArtifactRemovalCopy {
  const source = describeReportArtifactSource(artifact);
  return {
    title: `Remove ${source.kindLabel} source?`,
    body: `Remove "${artifact.title}" from local Report History. This only removes the local reusable source on this care document; it does not delete anything from cloud storage, revoke a share, or change provider-backed retention because those lifecycle controls are not enabled yet.`,
    confirmLabel: "Remove local source",
    accessibilityLabel: `Remove local ${source.kindLabel} source for ${artifact.title}`,
  };
}

export function buildCarePass(input: CarePassInput): CarePass {
  const now = input.now ?? Date.now();
  const profile = input.profile ?? {};
  const diet = input.dietProfile ?? {};
  const entries = input.entries ?? [];
  const routines = input.routines ?? [];
  const records = input.records ?? [];
  const name = clean(profile.name) || "Dog";
  const audienceLabel = AUDIENCE_LABEL[input.audience];
  const generatedAt = formatDateTime(now);
  const health = deriveHealthWatch({ entries, routines, now });
  const handoff = deriveCareHandoff({
    entries,
    routines,
    caregivers: input.caregivers ?? [],
    now,
  });
  const medication = deriveMedicationAdherence({ entries, routines, now });
  const medicationFollowUps = deriveMedicationFollowUps({ entries, routines, records, now }).slice(0, 4);
  const hydration = deriveWaterHydration({ entries, now });
  const walkActivity = deriveWalkActivity({ entries, now });
  const walkRouteTemplates = deriveWalkRouteTemplates({ entries, now, limit: 3 });
  const pottyHealth = derivePottyHealth({ entries, now });
  const careTrends = deriveCareTrends({ entries, now, windowDays: 7 });
  const trainingProgress = deriveTrainingProgress({ entries, now, lookbackDays: 30 });
  const aloneTime = deriveAloneTime({ entries, now, lookbackDays: 30 });
  const weightTrend = deriveWeightTrend({ entries, profile, goals: input.goals ?? [], now, lookbackDays: 90 });
  const groomingCare = deriveGroomingCare({ entries, now, lookbackDays: 45 });
  const moodTrend = deriveMoodTrend({ entries, now, lookbackDays: 30, limit: 3 });
  const recordAttachmentPrep = recordAttachmentPrepLines(records);
  const petCredentialPrep = petCredentialPrepLines({
    profile,
    caregivers: input.caregivers ?? [],
    records,
  });

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

  const summary =
    input.audience === "vet"
      ? `${name} health and care context for veterinarian review.`
      : input.audience === "trainer"
        ? `${name} behavior, routine, and activity context for training.`
        : `${name} care handoff for ${audienceLabel.toLowerCase()} support.`;

  const sections = [
    section("Dog", [
      `${name}${profile.breed ? ` - ${profile.breed}` : ""}`,
      profile.weight?.current ? `Weight: ${profile.weight.current} ${profile.weight.unit ?? "lb"}` : "",
      profile.careFocus ? `Care focus: ${profile.careFocus}` : "",
    ]),
    section("Next Care", [
      handoff.next ? `${handoff.next.label} at ${handoff.next.time}${handoff.next.owner ? ` with ${handoff.next.owner}` : ""}` : "No upcoming routine is currently scheduled.",
      handoff.sections.needsAttention.map((item) => `${item.label}: ${item.detail}`).join("; "),
      handoff.message,
    ]),
    section("Handoff Checklist", audienceChecklist(input.audience, name)),
    section("Care Trends", [
      `${careTrends.windowDays}-day trends`,
      careTrends.summary,
      careTrends.current.meals.total
        ? `Meals: ${careTrends.current.meals.complete} complete, ${careTrends.current.meals.partial} partial, ${careTrends.current.meals.skipped} skipped`
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
      diet.bedtimeSnack ? `Bedtime snack: ${diet.bedtimeSnack}` : "",
      diet.avoid ? `Avoid: ${diet.avoid}` : "",
      diet.sensitivities ? `Sensitivities: ${diet.sensitivities}` : "",
      diet.appetiteQuirks ? `Appetite notes: ${diet.appetiteQuirks}` : "",
    ]),
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
    moodTrend.total
      ? section("Mood & Energy", [
          moodTrend.summary,
          `Energy: ${moodTrend.energy.low} low, ${moodTrend.energy.steady} steady, ${moodTrend.energy.high} high`,
          moodTrend.caregivers.length ? `Caregivers: ${moodTrend.caregivers.slice(0, 5).join(", ")}` : "",
          moodLatestLine(moodTrend.latest),
          moodTrend.nextStep,
          "Mood and energy are owner-reported care context for household handoff, training, and veterinarian review, not a diagnosis.",
        ])
      : null,
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
    section("Dog ID Prep", petCredentialPrep),
    section("Records Attachment Prep", recordAttachmentPrep),
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
          `${record.title}${record.due ? ` due ${record.due}` : ""}${record.note ? ` - ${record.note}` : ""}`
        )))
      : null,
  ].filter((item): item is CarePassSection => item !== null);

  const passWithoutMessage = {
    audience: input.audience,
    title: `${name} ${audienceLabel} Care Pass`,
    generatedAt,
    summary,
    sections,
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
  const safeStamp = clean(createdAt).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "");
  const dateStamp = new Date(createdAt).toISOString().slice(0, 10);
  return {
    id: `care_pass_${pass.audience}_${safeStamp}`,
    kind: "care_pass",
    audience: pass.audience,
    title: pass.title,
    generatedAt: pass.generatedAt,
    createdAt,
    summary: pass.summary,
    sectionTitles: pass.sections.map((section) => section.title),
    message: pass.message,
    printFileName: `${slugify(pass.title)}-${dateStamp}.html`,
    printHtml: renderCarePassPrintHtml(pass),
  };
}

export function createProgressReportArtifact(input: ProgressReportArtifactInput): ProgressReportArtifact {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const safeStamp = clean(createdAt).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "");
  const dateStamp = new Date(createdAt).toISOString().slice(0, 10);
  const periodDays = Math.max(1, Math.floor(input.periodDays));
  const dogName = clean(input.dogName) || "Dog";
  const title = `${dogName} ${periodDays}-day Progress Report`;
  const sections = input.sections
    .map((item) => section(item.title, item.lines))
    .filter((item): item is CarePassSection => item !== null);
  const message = progressReportMessage({
    title,
    summary: input.summary,
    generatedAt: input.generatedAt,
    sections,
  });
  const artifact: ProgressReportArtifact = {
    id: `progress_report_${periodDays}d_${safeStamp}`,
    kind: "progress_report",
    title,
    generatedAt: input.generatedAt,
    createdAt,
    summary: clean(input.summary),
    sections,
    sectionTitles: sections.map((item) => item.title),
    message,
    periodDays,
    dogName,
    printFileName: `${slugify(title)}-${dateStamp}.html`,
  };

  return {
    ...artifact,
    printHtml: renderProgressReportPrintHtml(artifact),
  };
}

export function createPetCredentialArtifact(
  credential: PetCredential,
  createdAt: string = new Date().toISOString(),
): PetCredentialArtifact {
  const safeStamp = clean(createdAt).replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "");
  const title = `${credential.name} Dog ID`;
  const printable = getPetCredentialPrintView(credential);
  return {
    id: `pet_credential_${safeStamp}`,
    kind: "pet_credential",
    title,
    generatedAt: credential.generatedAt,
    createdAt,
    summary: "Local Dog ID credential source for caregiver and veterinarian review.",
    sectionTitles: ["Dog ID"],
    message: credential.message,
    dogName: credential.name,
    printFileName: printable.fileName,
    printHtml: printable.html,
  };
}

export function summarizePetCredentialArtifacts(
  artifacts: readonly ReportArtifact[] = [],
): PetCredentialArtifactSummary {
  const credentials = artifacts
    .filter((artifact): artifact is PetCredentialArtifact => artifact.kind === "pet_credential")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = credentials[0] ?? null;
  const total = credentials.length;
  const fallback: PetCredentialArtifactSummary = {
    total,
    latest,
    summary: "No local Dog ID credential source has been saved yet.",
    latestLine: "",
    action: "Share the Dog ID card or printable source from Records to save a local credential source in Report History.",
    boundaryLine: "Dog ID credentials remain local printable sources until provider-backed credential storage, native PDF/image export, and cloud sharing are approved.",
  };
  if (!latest) return fallback;

  const created = new Date(latest.createdAt).getTime();
  const latestDate = Number.isNaN(created) ? clean(latest.generatedAt) || "saved locally" : formatDate(created);
  return {
    total,
    latest,
    summary: `${total} local Dog ID credential ${total === 1 ? "source" : "sources"} saved for resend or printable-source sharing.`,
    latestLine: `Latest Dog ID Credential saved ${latestDate}${latest.printFileName ? ` as ${latest.printFileName}` : ""}.`,
    action: "Open Records Report History to resend the Dog ID text or share the printable source before handing it to a sitter, trainer, caregiver, or vet.",
    boundaryLine: "Saved Dog ID artifacts are local credential sources; provider-backed credential storage, native PDF/image export, cloud sharing, retention, and deletion policy are not enabled.",
  };
}

export function summarizeReportArtifacts(
  artifacts: readonly ReportArtifact[] = [],
): ReportArtifactSummary {
  const saved = artifacts
    .filter((artifact): artifact is ReportArtifact => Boolean(artifact?.id && artifact.kind))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = saved[0] ?? null;
  const carePassCount = saved.filter((artifact) => artifact.kind === "care_pass").length;
  const progressReportCount = saved.filter((artifact) => artifact.kind === "progress_report").length;
  const petCredentialCount = saved.filter((artifact) => artifact.kind === "pet_credential").length;
  const total = saved.length;

  const fallback: ReportArtifactSummary = {
    total,
    carePassCount,
    progressReportCount,
    petCredentialCount,
    latest,
    summary: "No local report source has been saved yet.",
    latestLine: "",
    action: "Share a Care Pass, Progress Report, or Dog ID from Records to save a reusable local source here.",
    audienceLine: "Audience prep appears after local report sources are saved.",
    reviewLine: "Review guidance appears after local report sources are saved.",
    cleanupLine: "Cleanup appears after local report sources are saved; provider-backed lifecycle controls remain gated.",
    boundaryLine: "Report History is local until native PDF export, server-backed report storage, cloud sharing, retention, and deletion policy are approved.",
  };
  if (!latest) return fallback;

  const kindLabel =
    latest.kind === "progress_report"
      ? "Progress Report"
      : latest.kind === "pet_credential"
        ? "Dog ID Credential"
        : "Care Pass";
  const parsed = new Date(latest.createdAt).getTime();
  const latestDate = Number.isNaN(parsed) ? clean(latest.generatedAt) || "saved locally" : formatDate(parsed);
  const mix = [
    carePassCount ? `${carePassCount} Care ${carePassCount === 1 ? "Pass" : "Passes"}` : "",
    progressReportCount ? `${progressReportCount} Progress ${progressReportCount === 1 ? "Report" : "Reports"}` : "",
    petCredentialCount ? `${petCredentialCount} Dog ID ${petCredentialCount === 1 ? "source" : "sources"}` : "",
  ].filter(Boolean);

  return {
    total,
    carePassCount,
    progressReportCount,
    petCredentialCount,
    latest,
    summary: `${total} local report ${total === 1 ? "source" : "sources"} saved for handoff reuse${mix.length ? `: ${mix.join(", ")}.` : "."}`,
    latestLine: `Latest saved source: ${kindLabel} saved ${latestDate}${latest.printFileName ? ` as ${latest.printFileName}` : ""}.`,
    action: "Resend or share printable source from Report History before handing care context to a sitter, trainer, caregiver, or vet.",
    audienceLine: reportAudiencePrepLine({ carePassCount, progressReportCount, petCredentialCount }),
    reviewLine: "Review the latest local source for stale routines, medications, records, and audience before resending.",
    cleanupLine: "Remove obsolete local sources only after review; this updates local Report History and does not revoke shares or change provider retention.",
    boundaryLine: "Saved report artifacts are local reusable sources; native PDF export, server-backed report storage, cloud sharing, retention, and deletion policy are not enabled.",
  };
}

function reportAudiencePrepLine(input: {
  carePassCount: number;
  progressReportCount: number;
  petCredentialCount: number;
}): string {
  const parts = [
    input.carePassCount ? "Care Passes fit sitter, caregiver, trainer, or vet handoffs" : "",
    input.progressReportCount ? "Progress Reports fit longer owner-review check-ins" : "",
    input.petCredentialCount ? "Dog ID sources fit quick identity, emergency-contact, and credential review" : "",
  ].filter(Boolean);

  return parts.length
    ? `Match the source to the audience before resending: ${parts.join("; ")}.`
    : "Match the source to the audience before resending.";
}
