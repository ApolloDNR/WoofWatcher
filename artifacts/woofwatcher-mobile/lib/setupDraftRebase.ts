import type { SetupWizardDraft } from "./setupWizard.ts";

export type SetupDraftField = keyof SetupWizardDraft;

export interface SetupDraftRebaseResult {
  base: SetupWizardDraft;
  draft: SetupWizardDraft;
  dirtyFields: SetupDraftField[];
  conflicts: SetupDraftField[];
}

export function rebaseSetupDraft({
  base,
  draft,
  dirtyFields,
  latest,
}: {
  base: SetupWizardDraft;
  draft: SetupWizardDraft;
  dirtyFields: readonly SetupDraftField[];
  latest: SetupWizardDraft;
}): SetupDraftRebaseResult {
  const dirty = new Set(dirtyFields);
  const nextDraft = { ...latest };
  const nextDirty: SetupDraftField[] = [];
  const conflicts: SetupDraftField[] = [];

  for (const field of dirtyFields) {
    if (latest[field] === draft[field]) continue;
    nextDraft[field] = draft[field] as never;
    nextDirty.push(field);
    if (latest[field] !== base[field]) conflicts.push(field);
  }

  // Ignore duplicate/unknown intent entries while retaining the declaration
  // order of SetupWizardDraft for deterministic owner-facing conflict copy.
  for (const field of Object.keys(draft) as SetupDraftField[]) {
    if (!dirty.has(field) || nextDirty.includes(field)) continue;
    if (latest[field] === draft[field]) continue;
    nextDraft[field] = draft[field] as never;
    nextDirty.push(field);
    if (latest[field] !== base[field]) conflicts.push(field);
  }

  return {
    base: { ...latest },
    draft: nextDraft,
    dirtyFields: nextDirty,
    conflicts,
  };
}

function canonicalizeCareSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeCareSource);
  if (!value || typeof value !== "object") return value;

  const canonical = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (key === "entries" || key === "updatedAt") continue;
    const child = (value as Record<string, unknown>)[key];
    if (child === undefined) continue;
    canonical[key] = canonicalizeCareSource(child);
  }
  return canonical;
}

function serializeCareSource(value: unknown): string {
  return JSON.stringify(canonicalizeCareSource(value));
}

export function createSetupCareDocumentFingerprint(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return serializeCareSource(value);
  }
  const { version: _version, ...doc } = value as Record<string, unknown>;
  return serializeCareSource(doc);
}

export function createSetupCareSourceFingerprint(value: unknown): string {
  return serializeCareSource(value);
}
