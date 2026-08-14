export type FileAvailability = "exists" | "missing" | "unknown";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relocateField<T extends UnknownRecord>(
  value: T,
  field: string,
  resolveUri: (uri: string) => string,
): T {
  const current = value[field];
  if (typeof current !== "string") return value;
  const resolved = resolveUri(current);
  return resolved === current ? value : ({ ...value, [field]: resolved } as T);
}

function relocateArrayField(
  owner: UnknownRecord,
  field: string,
  uriField: string,
  resolveUri: (uri: string) => string,
): UnknownRecord {
  const current = owner[field];
  if (!Array.isArray(current)) return owner;
  let next: unknown[] | null = null;
  for (let index = 0; index < current.length; index += 1) {
    const item = current[index];
    if (!isRecord(item)) continue;
    const relocated = relocateField(item, uriField, resolveUri);
    if (relocated !== item) {
      if (!next) next = [...current];
      next[index] = relocated;
    }
  }
  return next ? { ...owner, [field]: next } : owner;
}

export function relocateCareAppOwnedFileReferences<
  TDoc,
  TEntry,
>(input: {
  doc: TDoc;
  entries: readonly TEntry[];
  resolveUri(uri: string): string;
}): { doc: TDoc; entries: TEntry[]; changed: boolean } {
  let nextDoc: unknown = input.doc;
  if (isRecord(input.doc)) {
    let docRecord: UnknownRecord = input.doc;
    docRecord = relocateArrayField(
      docRecord,
      "records",
      "attachmentUri",
      input.resolveUri,
    );
    docRecord = relocateArrayField(
      docRecord,
      "adventureMemories",
      "photoUri",
      input.resolveUri,
    );
    nextDoc = docRecord;
  }

  let nextEntries: TEntry[] | null = null;
  for (let index = 0; index < input.entries.length; index += 1) {
    const entry = input.entries[index];
    if (!isRecord(entry) || !isRecord(entry.details)) continue;
    const details = relocateField(
      entry.details,
      "photoProofAttachmentUri",
      input.resolveUri,
    );
    if (details !== entry.details) {
      if (!nextEntries) nextEntries = [...input.entries];
      nextEntries[index] = { ...entry, details } as TEntry;
    }
  }

  const docChanged = nextDoc !== input.doc;
  return {
    doc: nextDoc as TDoc,
    entries: nextEntries ?? (input.entries as TEntry[]),
    changed: docChanged || nextEntries !== null,
  };
}

export async function verifyAvatarFileReferences<TMood extends string>(input: {
  set: Partial<Record<TMood, string>>;
  resolveUri(uri: string): string;
  inspect(uri: string): Promise<FileAvailability>;
}): Promise<{ set: Partial<Record<TMood, string>>; changed: boolean }> {
  let next: Partial<Record<TMood, string>> | null = null;

  for (const mood of Object.keys(input.set) as TMood[]) {
    const current = input.set[mood];
    if (typeof current !== "string") continue;
    const resolved = input.resolveUri(current);
    const availability = await input.inspect(resolved);
    if (availability === "missing") {
      if (!next) next = { ...input.set };
      delete next[mood];
    } else if (resolved !== current) {
      if (!next) next = { ...input.set };
      next[mood] = resolved;
    }
  }

  return next
    ? { set: next, changed: true }
    : { set: input.set, changed: false };
}
