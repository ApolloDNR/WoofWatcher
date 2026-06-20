import { appendCareAuditEvent, normalizeCareEventType, type CareAuditEvent } from "../../../lib/care-domain/src/index.ts";

export type WalkLifecycle = "in-progress" | "completed";

export interface WalkSessionEntryLike {
  id?: string;
  type?: string;
  title?: string;
  caregiver?: string;
  occurredAt?: string;
  durationMinutes?: number | null;
  dogInteractions?: number | null;
  note?: string;
  details?: Record<string, unknown> | null;
}

export interface WalkSessionStartOptions {
  caregiver: string;
  now: number | string;
  routineId?: string | null;
  routineLabel?: string | null;
}

export interface WalkSessionFinishOptions {
  caregiver: string;
  now: number | string;
  durationMinutes?: number | null;
  routeName?: string | null;
  distanceMiles?: number | null;
  dogInteractions?: number | null;
  socialOutcome?: string | null;
  note?: string | null;
}

export interface WalkSessionPatch {
  title: string;
  durationMinutes: number;
  dogInteractions?: number;
  note?: string;
  details: Record<string, unknown> & { auditTrail?: CareAuditEvent[] };
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function iso(value: string | number): string {
  if (typeof value === "number") return new Date(value).toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function asObject(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function walkStartIso(entry: WalkSessionEntryLike): string {
  const details = asObject(entry.details);
  return clean(details.walkStartedAt) || clean(entry.occurredAt) || new Date().toISOString();
}

function durationMinutes(startIso: string, endIso: string, fallback?: number | null): number {
  if (fallback != null && Number.isFinite(fallback) && fallback >= 0) return Math.round(fallback);
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
}

function isWalk(entry: WalkSessionEntryLike): boolean {
  return normalizeCareEventType(entry.type, entry.details) === "walk";
}

function isOpenWalk(entry: WalkSessionEntryLike): boolean {
  const details = asObject(entry.details);
  return isWalk(entry) && details.householdVisible !== false && details.walkLifecycle === "in-progress";
}

export function buildWalkSessionStartEntry(options: WalkSessionStartOptions): Omit<WalkSessionEntryLike, "id"> {
  const startedAt = iso(options.now);
  const routineLabel = clean(options.routineLabel);
  const routineId = clean(options.routineId);
  return {
    type: "walk",
    title: `${routineLabel || "Walk"} - In progress`,
    caregiver: clean(options.caregiver) || "Care team",
    occurredAt: startedAt,
    details: {
      householdVisible: true,
      walkLifecycle: "in-progress",
      walkStartedAt: startedAt,
      startedBy: clean(options.caregiver) || "Care team",
      ...(routineId ? { routineId } : {}),
      ...(routineLabel ? { routineLabel } : {}),
      logInteraction: "walk-session-start",
    },
  };
}

export function findOpenWalkSession<TEntry extends WalkSessionEntryLike>(entries: TEntry[]): TEntry | null {
  return entries
    .filter(isOpenWalk)
    .sort((a, b) => Date.parse(walkStartIso(b)) - Date.parse(walkStartIso(a)))[0] ?? null;
}

export function buildWalkSessionFinishPatch(entry: WalkSessionEntryLike, options: WalkSessionFinishOptions): WalkSessionPatch {
  const details = asObject(entry.details);
  const endedAt = iso(options.now);
  const startedAt = walkStartIso(entry);
  const duration = durationMinutes(startedAt, endedAt, options.durationMinutes);
  const caregiver = clean(options.caregiver) || "Care team";
  const routeName = clean(options.routeName);
  const socialOutcome = clean(options.socialOutcome);
  const distance = asNumber(options.distanceMiles);
  const interactions = asNumber(options.dogInteractions);
  const roundedInteractions = interactions == null ? undefined : Math.max(0, Math.round(interactions));

  const nextDetails: Record<string, unknown> = {
    ...details,
    householdVisible: details.householdVisible !== false,
    walkLifecycle: "completed",
    walkStartedAt: startedAt,
    walkEndedAt: endedAt,
    endedBy: caregiver,
    durationMinutes: duration,
  };

  if (routeName) nextDetails.routeName = routeName;
  if (distance != null && distance >= 0) nextDetails.distanceMiles = Math.round(distance * 100) / 100;
  if (roundedInteractions != null) nextDetails.dogInteractions = roundedInteractions;
  if (socialOutcome) nextDetails.socialOutcome = socialOutcome;

  return {
    title: `${clean(entry.title).split(" - ")[0] || "Walk"} - Completed`,
    durationMinutes: duration,
    ...(roundedInteractions != null ? { dogInteractions: roundedInteractions } : {}),
    ...(clean(options.note) ? { note: clean(options.note) } : {}),
    details: appendCareAuditEvent(nextDetails, {
      id: `walk_finished_${Date.parse(endedAt) || Date.now()}`,
      action: "updated",
      caregiver,
      occurredAt: endedAt,
      summary: `${caregiver} finished "${clean(entry.title) || "Walk"}" after ${duration} minutes.`,
      changes: ["walkLifecycle", "walkEndedAt", "durationMinutes"],
    }),
  };
}
