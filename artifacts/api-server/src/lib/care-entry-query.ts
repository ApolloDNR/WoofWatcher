type QueryValue = string | number | null | undefined | QueryValue[];

const invalidSinceQuery = "Invalid since query. Use an ISO date-time string.";
const invalidUpdatedSinceQuery = "Invalid updatedSince query. Use an ISO date-time string.";
const invalidHistoryCursor =
  "Invalid care-history cursor. Use one RFC 3339 date-time, canonical UUID, and expected generation.";
const incompatibleHistoryMode =
  "Care-history cursors cannot be combined with since or updatedSince.";

const canonicalUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const rfc3339DateTime =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/;

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

export type ListCareEntryHistoryQuery =
  | {
      ok: true;
      householdId: string;
      limit: number;
      beforeOccurredAt?: Date;
      beforeId?: string;
      expectedGeneration?: number;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

export type OptionalCareEntryHouseholdScope =
  | {
      ok: true;
      householdId?: string;
    }
  | {
      ok: false;
      status: 400;
      error: string;
    };

export type CareEntryHouseholdScope =
  | {
      ok: true;
      householdId: string;
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

function parseStrictRfc3339(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const match = rfc3339DateTime.exec(raw);
  if (!match) return null;
  const [
    ,
    yearRaw,
    monthRaw,
    dayRaw,
    hourRaw,
    minuteRaw,
    secondRaw,
    ,
    zone,
    offsetHourRaw,
    offsetMinuteRaw,
  ] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const offsetHour = offsetHourRaw === undefined ? 0 : Number(offsetHourRaw);
  const offsetMinute =
    offsetMinuteRaw === undefined ? 0 : Number(offsetMinuteRaw);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    (zone !== "Z" && (offsetHour > 23 || offsetMinute > 59))
  ) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseHistoryLimit(value: QueryValue): number | null {
  if (Array.isArray(value)) return null;
  if (value === undefined) return 500;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 500
    ? parsed
    : null;
}

export function normalizeOptionalCareEntryHouseholdScope(query: {
  householdId?: QueryValue;
}): OptionalCareEntryHouseholdScope {
  if (query.householdId === undefined) return { ok: true };
  if (
    typeof query.householdId !== "string" ||
    !canonicalUuid.test(query.householdId)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid care-entry household scope.",
    };
  }
  return {
    ok: true,
    householdId: query.householdId,
  };
}

export function normalizeCareEntryHouseholdScope(query: {
  householdId?: QueryValue;
}): CareEntryHouseholdScope {
  const scope = normalizeOptionalCareEntryHouseholdScope(query);
  if (!scope.ok) return scope;
  if (!scope.householdId) {
    return {
      ok: false,
      status: 400,
      error: "A canonical care-entry household scope is required.",
    };
  }
  return {
    ok: true,
    householdId: scope.householdId,
  };
}

export function normalizeListCareEntryHistoryQuery(query: {
  householdId?: QueryValue;
  beforeOccurredAt?: QueryValue;
  beforeId?: QueryValue;
  expectedGeneration?: QueryValue;
  since?: QueryValue;
  updatedSince?: QueryValue;
  limit?: QueryValue;
}): ListCareEntryHistoryQuery {
  const householdScope = normalizeCareEntryHouseholdScope(query);
  if (!householdScope.ok) {
    return {
      ok: false,
      status: 400,
      error: invalidHistoryCursor,
    };
  }
  if (query.since !== undefined || query.updatedSince !== undefined) {
    return {
      ok: false,
      status: 400,
      error: incompatibleHistoryMode,
    };
  }
  const values = [
    query.beforeOccurredAt,
    query.beforeId,
    query.expectedGeneration,
  ];
  if (values.some(Array.isArray)) {
    return { ok: false, status: 400, error: invalidHistoryCursor };
  }
  const present = values.map((value) => value !== undefined);
  if (present.some(Boolean) && !present.every(Boolean)) {
    return { ok: false, status: 400, error: invalidHistoryCursor };
  }
  const limit = parseHistoryLimit(query.limit);
  if (limit === null) {
    return {
      ok: false,
      status: 400,
      error: "Invalid care-history limit. Use an integer from 1 to 500.",
    };
  }
  if (!present.some(Boolean)) {
    return {
      ok: true,
      householdId: householdScope.householdId,
      limit,
    };
  }

  const beforeOccurredAt = parseStrictRfc3339(query.beforeOccurredAt);
  const beforeId =
    typeof query.beforeId === "string" && canonicalUuid.test(query.beforeId)
      ? query.beforeId
      : null;
  const expectedRaw = query.expectedGeneration;
  const expectedGeneration =
    typeof expectedRaw === "number"
      ? expectedRaw
      : typeof expectedRaw === "string" && /^\d+$/.test(expectedRaw)
        ? Number(expectedRaw)
        : Number.NaN;
  if (
    !beforeOccurredAt ||
    !beforeId ||
    !Number.isSafeInteger(expectedGeneration) ||
    expectedGeneration < 0
  ) {
    return { ok: false, status: 400, error: invalidHistoryCursor };
  }
  return {
    ok: true,
    householdId: householdScope.householdId,
    limit,
    beforeOccurredAt,
    beforeId,
    expectedGeneration,
  };
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
