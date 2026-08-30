export interface RecordsDeepLinkDecisionInput {
  entryId?: string;
  reportId?: string;
  isLoaded: boolean;
  isSyncing: boolean;
  isInitialSyncSettled: boolean;
  entryIds: readonly string[];
  reportIds: readonly string[];
}

export type RecordsDeepLinkDecision =
  | { kind: "none" }
  | { kind: "wait"; id: string; requestKey: string }
  | {
      kind:
        | "open-entry"
        | "open-report"
        | "unavailable-entry"
        | "unavailable-report";
      id: string;
      requestKey: string;
    };

export type RecordsDeepLinkAction = Exclude<
  RecordsDeepLinkDecision,
  { kind: "none" } | { kind: "wait" }
>;

export interface RecordsDeepLinkController {
  next(decision: RecordsDeepLinkDecision): RecordsDeepLinkAction | null;
}

/**
 * Opening consumes a request, while an unavailable notice does not. Keeping
 * those histories separate lets a later successful sync open the same target
 * after one truthful unavailable notice without repeatedly reopening or
 * repeating the dialog on every render.
 */
export function createRecordsDeepLinkController(): RecordsDeepLinkController {
  let openedRequestKey: string | null = null;
  let unavailableNoticeRequestKey: string | null = null;

  return {
    next(decision) {
      if (decision.kind === "none") {
        openedRequestKey = null;
        unavailableNoticeRequestKey = null;
        return null;
      }
      if (decision.kind === "wait") return null;

      if (
        decision.kind === "open-entry" ||
        decision.kind === "open-report"
      ) {
        if (openedRequestKey === decision.requestKey) return null;
        openedRequestKey = decision.requestKey;
        return decision;
      }

      if (unavailableNoticeRequestKey === decision.requestKey) return null;
      unavailableNoticeRequestKey = decision.requestKey;
      return decision;
    },
  };
}

export function recordsDeepLinkRequestKey(
  entryId?: string,
  reportId?: string,
): string | null {
  const normalizedEntryId = entryId?.trim();
  if (normalizedEntryId) return `entry:${normalizedEntryId}`;
  const normalizedReportId = reportId?.trim();
  return normalizedReportId ? `report:${normalizedReportId}` : null;
}

/**
 * Entry links have deterministic priority when malformed/crafted routes carry
 * both identifiers. A missing target is only terminal after hydration and any
 * active provider sync have settled, so late-arriving data remains retryable.
 */
export function decideRecordsDeepLinkRequest({
  entryId,
  reportId,
  isLoaded,
  isSyncing,
  isInitialSyncSettled,
  entryIds,
  reportIds,
}: RecordsDeepLinkDecisionInput): RecordsDeepLinkDecision {
  const requestKey = recordsDeepLinkRequestKey(entryId, reportId);
  const target = requestKey
    ? requestKey.startsWith("entry:")
      ? { kind: "entry" as const, id: requestKey.slice("entry:".length) }
      : { kind: "report" as const, id: requestKey.slice("report:".length) }
    : null;

  if (!target || !requestKey) return { kind: "none" };

  // Never open a cached target before the current identity's authoritative
  // doc + entries refresh has committed. Otherwise a direct account switch
  // could navigate using a stale A target while B is still pending.
  if (!isLoaded || isSyncing || !isInitialSyncSettled) {
    return { kind: "wait", id: target.id, requestKey };
  }

  const targetExists =
    target.kind === "entry"
      ? entryIds.includes(target.id)
      : reportIds.includes(target.id);
  if (targetExists) {
    return {
      kind: target.kind === "entry" ? "open-entry" : "open-report",
      id: target.id,
      requestKey,
    };
  }

  return {
    kind:
      target.kind === "entry"
        ? "unavailable-entry"
        : "unavailable-report",
    id: target.id,
    requestKey,
  };
}
