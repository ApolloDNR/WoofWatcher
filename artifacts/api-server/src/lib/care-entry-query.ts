type QueryValue = string | number | null | undefined | QueryValue[];

export type ListCareEntriesQuery =
  | {
      ok: true;
      limit: number;
      since?: Date;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

function firstQueryValue(value: QueryValue): string | number | null | undefined {
  return Array.isArray(value) ? firstQueryValue(value[0]) : value;
}

function parseLimit(value: QueryValue): number {
  const raw = firstQueryValue(value);
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : Number.NaN;
  const fallback = Number.isFinite(parsed) ? parsed : 250;
  return Math.min(500, Math.max(1, fallback));
}

export function normalizeListCareEntriesQuery(query: {
  since?: QueryValue;
  limit?: QueryValue;
}): ListCareEntriesQuery {
  const sinceRaw = firstQueryValue(query.since);

  if (sinceRaw !== undefined) {
    if (typeof sinceRaw !== "string" || sinceRaw.trim() === "") {
      return {
        ok: false,
        status: 400,
        error: "Invalid since query. Use an ISO date-time string.",
      };
    }

    const since = new Date(sinceRaw);
    if (Number.isNaN(since.getTime())) {
      return {
        ok: false,
        status: 400,
        error: "Invalid since query. Use an ISO date-time string.",
      };
    }

    return {
      ok: true,
      since,
      limit: parseLimit(query.limit),
    };
  }

  return {
    ok: true,
    limit: parseLimit(query.limit),
  };
}
