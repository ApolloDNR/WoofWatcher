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

export interface PetCredentialProfile {
  name?: string;
  breed?: string;
  careFocus?: string;
  vetBoundary?: string;
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
  microchip: string;
  insurance: string;
  vaccines: string;
  generatedAt: string;
  message: string;
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
  const microchip = recordValue(records.find((record) => recordKind(record.type) === "microchip"));
  const insurance = recordValue(records.find((record) => recordKind(record.type) === "insurance"));
  const vaccines =
    records
      .filter((record) => recordKind(record.type) === "vaccine")
      .slice(0, 4)
      .map((record) => recordValue(record))
      .join("; ") || "Not on file";
  const careFocus = clean(profile.careFocus) || "Routine care";
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
    microchip,
    insurance,
    vaccines,
    generatedAt,
    message,
  };
}
