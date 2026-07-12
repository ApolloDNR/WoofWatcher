type QueryValue = string | number | null | undefined | QueryValue[];

const invalidSinceQuery = "Invalid since query. Use an ISO date-time string.";
const invalidUpdatedSinceQuery = "Invalid updatedSince query. Use an ISO date-time string.";

export type ListCareEntriesQuery =
  | {
      ok: true;
      limit: number;
      since?: Date;
      updatedSince?: Date;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

export type ListCareEntryTombstonesQuery =
  | {
      ok: true;
      limit: number;
      updatedSince?: Date;
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

function parseDateQuery(raw: string | number | null | undefined, message: string): Date | string {
  if (raw === undefined) return "";
  if (typeof raw !== "string" || raw.trim() === "") {
    return message;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return message;
  }
  return parsed;
}

export function normalizeListCareEntriesQuery(query: {
  since?: QueryValue;
  updatedSince?: QueryValue;
  limit?: QueryValue;
}): ListCareEntriesQuery {
  const sinceRaw = firstQueryValue(query.since);
  const updatedSinceRaw = firstQueryValue(query.updatedSince);

  if (sinceRaw !== undefined && updatedSinceRaw !== undefined) {
    return {
      ok: false,
      status: 400,
      error: "Use either since or updatedSince for care-entry sync, not both.",
    };
  }

  if (sinceRaw !== undefined) {
    const since = parseDateQuery(sinceRaw, invalidSinceQuery);
    if (typeof since === "string") {
      return {
        ok: false,
        status: 400,
        error: since,
      };
    }

    return {
      ok: true,
      since,
      limit: parseLimit(query.limit),
    };
  }

  if (updatedSinceRaw !== undefined) {
    const updatedSince = parseDateQuery(updatedSinceRaw, invalidUpdatedSinceQuery);
    if (typeof updatedSince === "string") {
      return {
        ok: false,
        status: 400,
        error: updatedSince,
      };
    }

    return {
      ok: true,
      updatedSince,
      limit: parseLimit(query.limit),
    };
  }

  return {
    ok: true,
    limit: parseLimit(query.limit),
  };
}

export function normalizeListCareEntryTombstonesQuery(query: {
  updatedSince?: QueryValue;
  limit?: QueryValue;
}): ListCareEntryTombstonesQuery {
  const updatedSinceRaw = firstQueryValue(query.updatedSince);

  if (updatedSinceRaw !== undefined) {
    const updatedSince = parseDateQuery(updatedSinceRaw, invalidUpdatedSinceQuery);
    if (typeof updatedSince === "string") {
      return {
        ok: false,
        status: 400,
        error: updatedSince,
      };
    }

    return {
      ok: true,
      updatedSince,
      limit: parseLimit(query.limit),
    };
  }

  return {
    ok: true,
    limit: parseLimit(query.limit),
  };
}
