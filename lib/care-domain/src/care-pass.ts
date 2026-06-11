import { normalizeCareEventType } from "./events.ts";
import { deriveCareHandoff, type CareHandoffCaregiver, type CareHandoffRoutine } from "./handoff.ts";
import { deriveHealthWatch, type CareHealthEntry } from "./health.ts";
import { deriveMedicationAdherence, deriveMedicationFollowUps } from "./medication.ts";
import { deriveWaterHydration } from "./water.ts";
import { deriveWalkActivity } from "./walk-activity.ts";

export type CarePassAudience = "caregiver" | "sitter" | "vet" | "trainer";

export interface CarePassProfile {
  name?: string;
  breed?: string;
  careFocus?: string;
  vetBoundary?: string;
  weight?: {
    current?: number;
    unit?: string;
  };
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
}

export interface CarePassInput {
  audience: CarePassAudience;
  profile?: CarePassProfile;
  dietProfile?: CarePassDietProfile;
  entries: readonly CareHealthEntry[];
  routines?: readonly CareHandoffRoutine[];
  caregivers?: readonly CareHandoffCaregiver[];
  records?: readonly CarePassRecord[];
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

export interface CarePassArtifactPrintView {
  fileName: string;
  html: string;
  status: "ready" | "restored";
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

export function getCarePassArtifactPrintView(artifact: CarePassArtifact): CarePassArtifactPrintView {
  const storedHtml = typeof artifact.printHtml === "string" && artifact.printHtml.trim().length > 0;
  return {
    fileName: clean(artifact.printFileName) || `${slugify(artifact.title)}-${printDateStamp(artifact.createdAt)}.html`,
    html: storedHtml ? artifact.printHtml as string : renderLegacyArtifactPrintHtml(artifact),
    status: storedHtml ? "ready" : "restored",
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
    section("Diet", [
      diet.primaryFood ? `Food: ${diet.primaryFood}` : "",
      diet.normalPortion ? `Portion: ${diet.normalPortion}` : "",
      diet.mealSchedule ? `Schedule: ${diet.mealSchedule}` : "",
      diet.bedtimeSnack ? `Bedtime snack: ${diet.bedtimeSnack}` : "",
      diet.avoid ? `Avoid: ${diet.avoid}` : "",
      diet.sensitivities ? `Sensitivities: ${diet.sensitivities}` : "",
      diet.appetiteQuirks ? `Appetite notes: ${diet.appetiteQuirks}` : "",
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
      walkActivity.nextStep,
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
