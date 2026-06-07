export type StickyNoteColor = "sage" | "sun" | "copper" | "sky" | "rose";

export interface StickyNote {
  id: string;
  text: string;
  caregiver: string;
  createdAt: string;
  color: StickyNoteColor;
}

export interface StickyNoteInput {
  id?: string;
  text: string;
  caregiver?: string;
  createdAt?: string;
  color?: StickyNoteColor | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanColor(value: unknown): StickyNoteColor {
  return value === "sun" || value === "copper" || value === "sky" || value === "rose" || value === "sage"
    ? value
    : "sage";
}

function cleanNote(value: unknown): StickyNote | null {
  if (!isRecord(value)) return null;
  const text = typeof value.text === "string" ? value.text.trim() : "";
  if (!text) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `note_${Date.now()}`;
  const caregiver = typeof value.caregiver === "string" && value.caregiver.trim() ? value.caregiver.trim() : "Care team";
  const createdAt = typeof value.createdAt === "string" && value.createdAt.trim() ? value.createdAt.trim() : new Date().toISOString();
  return {
    id,
    text,
    caregiver,
    createdAt,
    color: cleanColor(value.color),
  };
}

export function getStickyNotes(details: unknown): StickyNote[] {
  if (!isRecord(details) || !Array.isArray(details.stickyNotes)) return [];
  return details.stickyNotes.flatMap((note) => {
    const cleaned = cleanNote(note);
    return cleaned ? [cleaned] : [];
  });
}

export function appendStickyNote<T extends Record<string, unknown>>(
  details: T | null | undefined,
  note: StickyNoteInput,
): T & { stickyNotes?: StickyNote[] } {
  const text = note.text.trim();
  if (!text) return (details ?? {}) as T & { stickyNotes?: StickyNote[] };

  const nextNote = cleanNote({
    id: note.id,
    text,
    caregiver: note.caregiver,
    createdAt: note.createdAt,
    color: note.color,
  });

  if (!nextNote) return (details ?? {}) as T & { stickyNotes?: StickyNote[] };
  return {
    ...(details ?? ({} as T)),
    stickyNotes: [...getStickyNotes(details), nextNote],
  };
}
