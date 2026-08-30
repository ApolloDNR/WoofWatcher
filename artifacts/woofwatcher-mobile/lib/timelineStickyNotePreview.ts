export interface TimelineStickyNotePreview<T> {
  visibleNotes: T[];
  hiddenCount: number;
}

/**
 * Keeps dense timeline rows bounded while preserving every note for the
 * entry-detail view. Sticky notes are appended oldest-to-newest, so the
 * timeline keeps the most recent notes in their original relative order.
 */
export function getTimelineStickyNotePreview<T>(
  notes: readonly T[],
  visibleLimit: number,
): TimelineStickyNotePreview<T> {
  const startIndex = Math.max(0, notes.length - visibleLimit);

  return {
    visibleNotes: notes.slice(startIndex),
    hiddenCount: startIndex,
  };
}
