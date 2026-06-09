export type RecordKind =
  | "vaccine"
  | "vet"
  | "receipt"
  | "insurance"
  | "microchip"
  | "medication"
  | "weight"
  | "document";

export interface CareRecord {
  id?: string;
  type: string;
  title: string;
  due?: string;
  note?: string;
}

export interface RecordVaultSection {
  kind: RecordKind;
  label: string;
  count: number;
  status: "On file" | "Missing";
  latest?: string;
  records: CareRecord[];
}

export interface RecordVaultSummary {
  total: number;
  sections: RecordVaultSection[];
  missingCritical: string[];
  priorityRecords: CareRecord[];
}

export type RecordDueStatusKind = "expired" | "due_soon" | "current" | "reference";
export type RecordReminderKind = "expired" | "due_soon" | "missing";

export interface RecordDueStatus {
  status: RecordDueStatusKind;
  label: string;
  daysUntil?: number;
  date?: string;
}

export interface RecordReminder {
  kind: RecordReminderKind;
  label: string;
  detail: string;
  urgency: "alert" | "watch";
  action: string;
  recordId?: string;
  section?: RecordKind;
  daysUntil?: number;
  dueDate?: string;
}

export interface RecordReminderOptions {
  now?: number;
  dueSoonDays?: number;
}

export interface PetCredentialProfile {
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
    unit?: string;
  };
}

export interface PetCredentialCaregiver {
  name?: string;
  role?: string;
}

export interface PetCredentialInput {
  profile?: PetCredentialProfile;
  caregivers?: readonly PetCredentialCaregiver[];
  records?: readonly CareRecord[];
  generatedAt?: string;
}

export interface PetCredential {
  name: string;
  breed: string;
  weight: string;
  careFocus: string;
  primaryCaregiver: string;
  primaryVet: string;
  emergencyContact: string;
  microchip: string;
  insurance: string;
  vaccines: string;
  generatedAt: string;
  message: string;
}

export interface PetCredentialPrintView {
  fileName: string;
  html: string;
}

const SECTION_DEFS: { kind: RecordKind; label: string; critical?: boolean }[] = [
  { kind: "vaccine", label: "Vaccines", critical: true },
  { kind: "vet", label: "Vet Visits" },
  { kind: "receipt", label: "Receipts" },
  { kind: "insurance", label: "Insurance", critical: true },
  { kind: "microchip", label: "Microchip", critical: true },
  { kind: "medication", label: "Medication" },
  { kind: "weight", label: "Weight" },
  { kind: "document", label: "Documents" },
];

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
    .replace(/^-|-$/g, "") || "dog";
}

function dateStamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "saved";
  return parsed.toISOString().slice(0, 10);
}

function recordKind(type: string): RecordKind {
  const normalized = clean(type).toLowerCase();
  if (normalized.includes("vacc")) return "vaccine";
  if (normalized.includes("visit") || normalized.includes("vet")) return "vet";
  if (normalized.includes("receipt") || normalized.includes("invoice")) return "receipt";
  if (normalized.includes("insurance") || normalized.includes("policy")) return "insurance";
  if (normalized.includes("microchip") || normalized.includes("chip")) return "microchip";
  if (normalized.includes("med")) return "medication";
  if (normalized.includes("weight")) return "weight";
  return "document";
}

function recordValue(record: CareRecord | undefined): string {
  if (!record) return "Not on file";
  const title = clean(record.title);
  const due = clean(record.due);
  const note = clean(record.note);
  return [title, due || note].filter(Boolean).join(" - ") || "On file";
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function parseDueDateMs(value: unknown): number | null {
  const text = clean(value).replace(/^(due|expires?|expiry|renewal)\s*:?\s*/i, "");
  if (!text || !/\d{4}/.test(text)) return null;

  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
  }

  const monthDayYear = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/);
  if (monthDayYear) {
    const [, monthName, day, year] = monthDayYear;
    const month = MONTH_INDEX[monthName.toLowerCase()];
    if (month != null) return Date.UTC(Number(year), month, Number(day));
  }

  const monthYear = text.match(/\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (monthYear) {
    const [, monthName, year] = monthYear;
    const month = MONTH_INDEX[monthName.toLowerCase()];
    if (month != null) return Date.UTC(Number(year), month, 1);
  }

  return null;
}

function formatDueDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function getRecordDueStatus(
  record: CareRecord | Pick<CareRecord, "due">,
  now: number = Date.now(),
  dueSoonDays = 45,
): RecordDueStatus {
  const dueMs = parseDueDateMs(record.due);
  if (dueMs == null) {
    return {
      status: "reference",
      label: "Reference",
    };
  }

  const daysUntil = Math.ceil((dueMs - now) / 86400000);
  if (daysUntil < 0) {
    return {
      status: "expired",
      label: "Expired",
      daysUntil,
      date: formatDueDate(dueMs),
    };
  }
  if (daysUntil <= dueSoonDays) {
    return {
      status: "due_soon",
      label: "Due soon",
      daysUntil,
      date: formatDueDate(dueMs),
    };
  }
  return {
    status: "current",
    label: "Current",
    daysUntil,
    date: formatDueDate(dueMs),
  };
}

export function summarizeRecordVault(records: readonly CareRecord[] = []): RecordVaultSummary {
  const normalized = records.map((record) => ({
    ...record,
    type: recordKind(record.type),
    title: clean(record.title),
    due: clean(record.due),
    note: clean(record.note),
  }));

  const sections = SECTION_DEFS.map((def) => {
    const sectionRecords = normalized.filter((record) => record.type === def.kind);
    const latest = sectionRecords.find((record) => record.due)?.due;
    return {
      kind: def.kind,
      label: def.label,
      count: sectionRecords.length,
      status: sectionRecords.length > 0 ? "On file" as const : "Missing" as const,
      latest,
      records: sectionRecords,
    };
  });

  const missingCritical = sections
    .filter((section) => SECTION_DEFS.find((def) => def.kind === section.kind)?.critical && section.count === 0)
    .map((section) => section.label);

  const priorityKinds: RecordKind[] = ["vaccine", "microchip", "insurance", "vet", "receipt", "document", "medication", "weight"];
  const priorityRecords = [...normalized].sort(
    (a, b) => priorityKinds.indexOf(recordKind(a.type)) - priorityKinds.indexOf(recordKind(b.type)),
  );

  return {
    total: normalized.length,
    sections,
    missingCritical,
    priorityRecords,
  };
}

export function deriveRecordReminders(
  records: readonly CareRecord[] = [],
  options: RecordReminderOptions = {},
): RecordReminder[] {
  const now = options.now ?? Date.now();
  const dueSoonDays = options.dueSoonDays ?? 45;
  const dueReminders = records.flatMap((record): RecordReminder[] => {
    const dueStatus = getRecordDueStatus(record, now, dueSoonDays);
    const kind = recordKind(record.type);
    const title = clean(record.title) || "Record";
    if (dueStatus.status === "expired") {
      return [
        {
          kind: "expired",
          label: `${title} expired`,
          detail: dueStatus.date ? `${title} expired on ${dueStatus.date}.` : `${title} is expired.`,
          urgency: "alert",
          action: "Upload or update the current record before sharing credentials.",
          recordId: record.id,
          section: kind,
          daysUntil: dueStatus.daysUntil,
          dueDate: dueStatus.date,
        },
      ];
    }
    if (dueStatus.status === "due_soon") {
      const days = dueStatus.daysUntil ?? 0;
      return [
        {
          kind: "due_soon",
          label: `${title} due soon`,
          detail: dueStatus.date ? `${title} is due in ${days} days (${dueStatus.date}).` : `${title} is due soon.`,
          urgency: "watch",
          action: "Schedule the renewal or add the updated document when ready.",
          recordId: record.id,
          section: kind,
          daysUntil: dueStatus.daysUntil,
          dueDate: dueStatus.date,
        },
      ];
    }
    return [];
  });

  const vault = summarizeRecordVault(records);
  const missing = vault.missingCritical.map((label): RecordReminder => ({
    kind: "missing",
    label: `Missing ${label}`,
    detail: `Add ${label.toLowerCase()} so the dog ID and care reports are ready to share.`,
    urgency: "watch",
    action: "Add the record or profile fallback details.",
    section: SECTION_DEFS.find((def) => def.label === label)?.kind,
  }));

  const rank: Record<RecordReminderKind, number> = { expired: 0, due_soon: 1, missing: 2 };
  return [...dueReminders, ...missing].sort(
    (a, b) => rank[a.kind] - rank[b.kind] || (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999),
  );
}

export function buildPetCredential(input: PetCredentialInput = {}): PetCredential {
  const profile = input.profile ?? {};
  const records = input.records ?? [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const name = clean(profile.name) || "Dog";
  const breed = clean(profile.breed) || "Breed not set";
  const weight =
    profile.weight?.current != null && profile.weight.current > 0
      ? `${profile.weight.current} ${clean(profile.weight.unit) || "lb"}`
      : "Not on file";
  const primaryCaregiver =
    input.caregivers?.map((caregiver) => clean(caregiver.name)).find(Boolean) ?? "Household";
  const microchipRecord = records.find((record) => recordKind(record.type) === "microchip");
  const insuranceRecord = records.find((record) => recordKind(record.type) === "insurance");
  const microchip = microchipRecord ? recordValue(microchipRecord) : clean(profile.microchipNumber) || "Not on file";
  const insurance =
    insuranceRecord
      ? recordValue(insuranceRecord)
      : [clean(profile.insuranceProvider), clean(profile.insurancePolicy)].filter(Boolean).join(" - ") || "Not on file";
  const vaccines =
    records
      .filter((record) => recordKind(record.type) === "vaccine")
      .slice(0, 4)
      .map((record) => recordValue(record))
      .join("; ") || "Not on file";
  const careFocus = clean(profile.careFocus) || "Routine care";
  const primaryVet = clean(profile.primaryVet) || "Not on file";
  const emergencyContact = clean(profile.emergencyContact) || "Not on file";
  const boundary = clean(profile.vetBoundary);

  const message = [
    `${name} Dog ID`,
    `Generated: ${shortDate(generatedAt)}`,
    "",
    `Name: ${name}`,
    `Breed: ${breed}`,
    `Weight: ${weight}`,
    `Care focus: ${careFocus}`,
    `Primary caregiver: ${primaryCaregiver}`,
    `Primary vet: ${primaryVet}`,
    `Emergency contact: ${emergencyContact}`,
    "",
    `Microchip: ${microchip}`,
    `Insurance: ${insurance}`,
    `Vaccines: ${vaccines}`,
    boundary ? "" : null,
    boundary || null,
  ]
    .filter((line): line is string => line != null)
    .join("\n");

  return {
    name,
    breed,
    weight,
    careFocus,
    primaryCaregiver,
    primaryVet,
    emergencyContact,
    microchip,
    insurance,
    vaccines,
    generatedAt,
    message,
  };
}

export function getPetCredentialPrintView(credential: PetCredential): PetCredentialPrintView {
  const rows = [
    ["Breed", credential.breed],
    ["Weight", credential.weight],
    ["Care focus", credential.careFocus],
    ["Primary caregiver", credential.primaryCaregiver],
    ["Primary vet", credential.primaryVet],
    ["Emergency contact", credential.emergencyContact],
    ["Microchip", credential.microchip],
    ["Insurance", credential.insurance],
    ["Vaccines", credential.vaccines],
  ];

  const rowHtml = rows
    .map(([label, value]) => `
        <div class="field">
          <div class="label">${escapeHtml(label)}</div>
          <div class="value">${escapeHtml(value)}</div>
        </div>`)
    .join("\n");

  return {
    fileName: `${slugify(credential.name)}-dog-id-${dateStamp(credential.generatedAt)}.html`,
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(credential.name)} Dog ID</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #1a2332;
      --muted: #5f6f63;
      --line: #d4cfc4;
      --wash: #f7f5f1;
      --navy: #0f1f33;
      --accent: #2e5846;
      --copper: #c87a3a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--wash);
      color: var(--ink);
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 28px;
    }
    .card {
      overflow: hidden;
      border-radius: 24px;
      background: #ffffff;
      border: 1px solid var(--line);
      box-shadow: 0 18px 50px rgba(26, 35, 50, 0.12);
    }
    header {
      background: var(--navy);
      color: #ffffff;
      padding: 28px;
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
    .generated {
      color: #d4cfc4;
      font-size: 12px;
      margin-top: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      background: var(--line);
    }
    .field {
      min-height: 86px;
      padding: 16px;
      background: #ffffff;
    }
    .label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .value {
      color: var(--ink);
      font-size: 15px;
      font-weight: 650;
    }
    .notes {
      padding: 18px;
      background: #ffffff;
      border-top: 1px solid var(--line);
    }
    pre {
      white-space: pre-wrap;
      margin: 0;
      color: var(--muted);
      font: 12.5px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    footer {
      color: var(--muted);
      font-size: 11.5px;
      padding: 18px 0 0;
    }
    @media print {
      body { background: #ffffff; }
      main { max-width: none; padding: 18px; }
      .card { box-shadow: none; border-radius: 16px; }
      .field { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <header>
        <div class="brand">WoofWatcher Dog ID</div>
        <h1>${escapeHtml(credential.name)} Dog ID</h1>
        <div class="generated">Generated ${escapeHtml(shortDate(credential.generatedAt))}</div>
      </header>
      <section class="grid">
${rowHtml}
      </section>
      <section class="notes">
        <pre>${escapeHtmlBlock(credential.message)}</pre>
      </section>
    </section>
    <footer>
      WoofWatcher organizes owner-reported credential context for handoff and veterinarian review. It does not replace veterinary care or official records.
    </footer>
  </main>
</body>
</html>`,
  };
}
