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
  /** Only device-local planned slots can be removed from this surface. */
  canRemove: boolean;
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

export type FutureCareTwinRosterNameValidation =
  | { valid: true; name: string }
  | { valid: false; message: string };

export type FutureCareTwinRosterAppendResult =
  | { valid: true; draft: CareTwinRosterDraft }
  | { valid: false; message: string };

export interface FutureCareTwinRosterRemoveResult<T> {
  pets: T[];
  removed: boolean;
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
  return "Coming soon";
}

function statusDetail(status: CareTwinRosterPetStatus, name: string): string {
  if (status === "live") return `${name} is the active dog for logs, routines, records, and the room.`;
  if (status === "setup-needed") return "Profile can be saved now; separate care data for this dog is coming soon.";
  return "Saved as a planned pet slot. Switching and separate logs are coming soon - everything stays on this device for now.";
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
    canRemove: !isPrimary && status === "provider-gated",
    avatarTemplateId: clean(profile?.avatarTemplateId) || undefined,
    createdAt: clean(profile?.createdAt) || undefined,
  };
}

export function buildCareTwinRosterDraft(input: {
  name: string;
  breed?: string;
  nowIso?: string;
  existingIds?: readonly string[];
}): CareTwinRosterDraft {
  const nowIso = clean(input.nowIso) || new Date().toISOString();
  const name = titleCase(clean(input.name) || "Future Dog");
  const baseId = `pet_${slugify(name)}_${safeTimestamp(nowIso)}`;
  const existingIds = new Set(
    (input.existingIds ?? []).map((id) => clean(id)).filter(Boolean),
  );
  let id = baseId;
  let collision = 2;
  while (existingIds.has(id)) {
    id = `${baseId}_${collision}`;
    collision += 1;
  }
  return {
    id,
    name,
    breed: titleCase(clean(input.breed) || "Breed not set"),
    status: "provider-gated",
    createdAt: nowIso,
  };
}

/**
 * Planned slots are local-only until care data can be isolated per dog. Keep
 * removal equally narrow: it can only remove a staged row, never the live
 * profile or its routines, logs, records, or avatar.
 */
export function removeFutureCareTwinRosterDraft<
  T extends { id?: string | null; status?: string | null },
>(pets: readonly T[], id: string): T[] {
  return removeFutureCareTwinRosterDraftResult(pets, id).pets;
}

/**
 * Keep the removal result explicit for an owner-confirmed action. A stale
 * confirmation must not imply success when the target became a protected row
 * or disappeared before the write reached the current care document.
 */
export function removeFutureCareTwinRosterDraftResult<
  T extends { id?: string | null; status?: string | null },
>(pets: readonly T[], id: string): FutureCareTwinRosterRemoveResult<T> {
  const targetId = clean(id);
  if (!targetId) return { pets: [...pets], removed: false };
  let removed = false;
  const nextPets = pets.filter((pet) => {
    const canRemove =
      !removed &&
      clean(pet.id) === targetId &&
      clean(pet.status).toLowerCase() === "provider-gated";
    if (canRemove) removed = true;
    return !canRemove;
  });
  return { pets: nextPets, removed };
}

export function validateFutureCareTwinRosterName(
  value: string,
  roster: CareTwinRoster,
): FutureCareTwinRosterNameValidation {
  const name = titleCase(clean(value));
  if (!name) {
    return { valid: false, message: "Add a name for the planned dog." };
  }

  const matchingPet = roster.pets.find(
    (pet) => pet.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (!matchingPet) return { valid: true, name };

  return {
    valid: false,
    message: matchingPet.isActive
      ? `${matchingPet.name} is already the live care twin.`
      : `${matchingPet.name} is already saved as a planned dog.`,
  };
}

/**
 * Validate and append a planned slot from the current document in one shared
 * step. Editors can outlive a roster update, so validating against a render
 * snapshot alone could otherwise store a duplicate planned dog.
 */
export function appendFutureCareTwinRosterDraft(input: {
  doc: CareTwinRosterDoc;
  name: string;
  breed?: string;
  nowIso?: string;
}): FutureCareTwinRosterAppendResult {
  const validation = validateFutureCareTwinRosterName(
    input.name,
    deriveCareTwinRoster(input.doc),
  );
  if (!validation.valid) return validation;

  const pets = [...(input.doc.pets ?? [])];
  const draft = buildCareTwinRosterDraft({
    name: validation.name,
    breed: input.breed,
    nowIso: input.nowIso,
    existingIds: pets.map((pet) => pet.id ?? ""),
  });
  return { valid: true, draft };
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
      ? `${primary.name} is the live care twin. ${futureCount} future pet${futureCount === 1 ? " saved as a planned slot" : "s saved as planned slots"}.`
      : `${primary.name} is the live care twin for this household.`;
  const nextStep =
    futureCount > 0
      ? "Multi-dog care is coming soon - planned pets stay as slots on this device for now."
      : "Add future pets only as planned slots for now - multi-dog care is coming soon.";

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
