import {
  CARE_EVENT_DEFINITIONS,
  normalizeCareEventType,
  type CareEventDetails,
  type CareEventType,
} from "./events.ts";

export interface CareLogSearchEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  note?: string | null;
  details?: CareEventDetails;
}

export interface CareLogSearchInput<TEntry extends CareLogSearchEntry = CareLogSearchEntry> {
  entries: readonly TEntry[];
  query?: string | null;
  type?: string | null;
  limit?: number;
}

export interface CareLogSearchResult<TEntry extends CareLogSearchEntry = CareLogSearchEntry> {
  entries: TEntry[];
  total: number;
  query: string;
  type: CareEventType | null;
  hasActiveFilters: boolean;
  summary: string;
  emptyTitle: string;
  emptyMessage: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function occurredAtTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function collectSearchText(value: unknown, output: string[]): void {
  if (value == null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    output.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSearchText(item, output);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectSearchText(item, output);
    }
  }
}

function buildSearchHaystack(entry: CareLogSearchEntry): string {
  const normalizedType = normalizeCareEventType(entry.type, entry.details);
  const values = [
    entry.title,
    entry.type,
    normalizedType,
    CARE_EVENT_DEFINITIONS[normalizedType].label,
    CARE_EVENT_DEFINITIONS[normalizedType].shortLabel,
    entry.caregiver,
    entry.note,
    entry.occurredAt,
  ].flatMap((value) => (value == null ? [] : [String(value)]));
  collectSearchText(entry.details, values);
  return values.join(" ").toLowerCase();
}

export function deriveCareLogSearch<TEntry extends CareLogSearchEntry>(
  input: CareLogSearchInput<TEntry>,
): CareLogSearchResult<TEntry> {
  const query = clean(input.query).toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const type = input.type ? normalizeCareEventType(input.type) : null;
  const sorted = [...input.entries].sort((a, b) => occurredAtTime(b.occurredAt) - occurredAtTime(a.occurredAt));
  const typeFiltered = type
    ? sorted.filter((entry) => normalizeCareEventType(entry.type, entry.details) === type)
    : sorted;
  const filtered = terms.length
    ? typeFiltered.filter((entry) => {
        const haystack = buildSearchHaystack(entry);
        return terms.every((term) => haystack.includes(term));
      })
    : typeFiltered;
  const total = filtered.length;
  const limit = typeof input.limit === "number" && Number.isFinite(input.limit) && input.limit > 0 ? input.limit : null;
  const hasActiveFilters = Boolean(query || type);
  const logNoun = total === 1 ? "log" : "logs";

  return {
    entries: limit ? filtered.slice(0, limit) : filtered,
    total,
    query,
    type,
    hasActiveFilters,
    summary: hasActiveFilters ? (total ? `${total} matching ${logNoun}` : "No matching logs") : `${total} total ${logNoun}`,
    emptyTitle: hasActiveFilters ? "No matching logs" : "No entries yet",
    emptyMessage: hasActiveFilters
      ? "No logs match the current search and filter. Clear search or switch filters to widen the timeline."
      : "No entries logged yet.",
  };
}
