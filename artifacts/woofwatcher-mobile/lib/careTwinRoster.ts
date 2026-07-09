import { resolvePetName } from "./petIdentity.ts";

export type CareTwinRosterPetStatus = "live" | "setup-needed" | "provider-gated";

export interface CareTwinRosterWeight {
  current?: number | null;
  unit?: string | null;
}

export interface CareTwinRosterProfile {
  id?: string | null;
  name?: string | null;
  publicLabel?: string | null;
  breed?: string | null;
  careFocus?: string | null;
  weight?: CareTwinRosterWeight | null;
  avatarTemplateId?: string | null;
  status?: CareTwinRosterPetStatus | null;
  createdAt?: string | null;
}

export interface CareTwinRosterDoc {
  activePetId?: string | null;
  profile?: CareTwinRosterProfile | null;
  pets?: readonly CareTwinRosterProfile[] | null;
}

export interface CareTwinRosterPet {
  id: string;
  name: string;
  breed: string;
  weightLabel: string;
  status: CareTwinRosterPetStatus;
  statusLabel: string;
  detail: string;
  isActive: boolean;
  canSwitch: boolean;
  avatarTemplateId?: string;
  createdAt?: string;
}

export interface CareTwinRoster {
  activePet: CareTwinRosterPet;
  pets: CareTwinRosterPet[];
  liveCount: number;
  futureCount: number;
  providerGatedCount: number;
  summary: string;
  nextStep: string;
}

export interface CareTwinRosterDraft {
  id: string;
  name: string;
  breed: string;
  status: "provider-gated";
  createdAt: string;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(value: string): string {
  const slug = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "dog";
}

function safeTimestamp(nowIso: string): number {
  const stamp = Date.parse(nowIso);
  return Number.isFinite(stamp) ? stamp : 0;
}

function weightLabel(weight: CareTwinRosterWeight | null | undefined): string {
  const current = Number(weight?.current);
  if (!Number.isFinite(current) || current <= 0) return "Weight not set";
  const rounded = Number.isInteger(current) ? String(current) : current.toFixed(1);
  return `${rounded} ${clean(weight?.unit) || "lb"}`;
}

function normalizeStatus(status: unknown, isPrimary: boolean): CareTwinRosterPetStatus {
  if (isPrimary) return "live";
  const value = clean(status).toLowerCase();
  if (value === "setup-needed") return "setup-needed";
  return "provider-gated";
}

function statusLabel(status: CareTwinRosterPetStatus): string {
  if (status === "live") return "Live care twin";
  if (status === "setup-needed") return "Needs setup";
  return "Provider-gated";
}

function statusDetail(status: CareTwinRosterPetStatus, name: string): string {
  if (status === "live") return `${name} is the active dog for logs, routines, records, and the room.`;
  if (status === "setup-needed") return "Profile can be staged, but care data is not separated until multi-dog storage is approved.";
  return "Stored as a planned pet slot. Switching and separate logs need provider-backed multi-dog care documents.";
}

function petFromProfile(profile: CareTwinRosterProfile | null | undefined, isPrimary: boolean): CareTwinRosterPet {
  const rawName = clean(profile?.publicLabel) || clean(profile?.name);
  // One shared rule so the roster never says "My Dog" while the rest of the
  // app says "Phoenix"; non-primary rows keep their own name or a placeholder.
  const name = isPrimary ? resolvePetName(rawName) : rawName || "Future dog";
  const status = normalizeStatus(profile?.status, isPrimary);
  return {
    id: isPrimary ? "primary" : clean(profile?.id) || `pet_${slugify(name)}`,
    name,
    breed: clean(profile?.breed) || "Breed not set",
    weightLabel: weightLabel(profile?.weight),
    status,
    statusLabel: statusLabel(status),
    detail: statusDetail(status, name),
    isActive: isPrimary,
    canSwitch: isPrimary,
    avatarTemplateId: clean(profile?.avatarTemplateId) || undefined,
    createdAt: clean(profile?.createdAt) || undefined,
  };
}

export function buildCareTwinRosterDraft(input: {
  name: string;
  breed?: string;
  nowIso?: string;
}): CareTwinRosterDraft {
  const nowIso = clean(input.nowIso) || new Date().toISOString();
  const name = titleCase(clean(input.name) || "Future Dog");
  return {
    id: `pet_${slugify(name)}_${safeTimestamp(nowIso)}`,
    name,
    breed: titleCase(clean(input.breed) || "Breed not set"),
    status: "provider-gated",
    createdAt: nowIso,
  };
}

export function deriveCareTwinRoster(doc: CareTwinRosterDoc): CareTwinRoster {
  const primary = petFromProfile(doc.profile, true);
  const seen = new Set<string>([primary.id.toLowerCase(), primary.name.toLowerCase()]);
  const futurePets = (doc.pets ?? [])
    .map((pet) => petFromProfile(pet, false))
    .filter((pet) => {
      const id = pet.id.toLowerCase();
      const name = pet.name.toLowerCase();
      if (seen.has(id) || seen.has(name)) return false;
      seen.add(id);
      seen.add(name);
      return true;
    });
  const pets = [primary, ...futurePets];
  const liveCount = pets.filter((pet) => pet.status === "live").length;
  const futureCount = pets.length - liveCount;
  const providerGatedCount = pets.filter((pet) => pet.status === "provider-gated").length;
  const summary =
    futureCount > 0
      ? `${primary.name} is the live care twin. ${futureCount} future pet${futureCount === 1 ? "" : "s"} staged for multi-dog care.`
      : `${primary.name} is the live care twin for this household.`;
  const nextStep =
    futureCount > 0
      ? "provider-backed multi-dog care documents are required before switching pets or separating logs."
      : "Add future pets only as planned slots until multi-dog storage is approved.";

  return {
    activePet: primary,
    pets,
    liveCount,
    futureCount,
    providerGatedCount,
    summary,
    nextStep,
  };
}
