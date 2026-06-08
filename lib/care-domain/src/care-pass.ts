import { normalizeCareEventType } from "./events.ts";
import { deriveCareHandoff, type CareHandoffCaregiver, type CareHandoffRoutine } from "./handoff.ts";
import { deriveHealthWatch, type CareHealthEntry } from "./health.ts";

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
    section("Diet", [
      diet.primaryFood ? `Food: ${diet.primaryFood}` : "",
      diet.normalPortion ? `Portion: ${diet.normalPortion}` : "",
      diet.mealSchedule ? `Schedule: ${diet.mealSchedule}` : "",
      diet.bedtimeSnack ? `Bedtime snack: ${diet.bedtimeSnack}` : "",
      diet.avoid ? `Avoid: ${diet.avoid}` : "",
      diet.sensitivities ? `Sensitivities: ${diet.sensitivities}` : "",
      diet.appetiteQuirks ? `Appetite notes: ${diet.appetiteQuirks}` : "",
    ]),
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
  };
}
