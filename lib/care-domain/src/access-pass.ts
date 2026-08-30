import { isRoutineBoardScheduledItem, type RoutineBoardEntry, type RoutineBoardItem, type RoutineBoardRoutine, deriveRoutineBoard } from "./routine-board.ts";
import { resolvePetName } from "./pet-identity.ts";

export type AccessPassKind = "sitter" | "trainer" | "vet" | "emergency" | "temporary-helper";
export type AccessPassStatus = "draft" | "upcoming" | "active" | "expired" | "revoked";
export type AccessPassPlanStatus = "none" | "draft" | "upcoming" | "active" | "expired";
export type AccessPassStorageStatus = "local-draft" | "provider-ready" | "provider-shared";
export type MyCareTodayStatus = "empty" | "steady" | "needs-care" | "complete" | "needs-correction";

export interface AccessPass {
  id: string;
  holderName: string;
  role: string;
  kind: AccessPassKind;
  startsAt: string;
  endsAt: string;
  status?: AccessPassStatus;
  petName?: string;
  permissions?: readonly string[];
  blockedPermissions?: readonly string[];
  responsibilities?: readonly string[];
  notes?: string;
  storageStatus?: AccessPassStorageStatus;
  providerShareEnabled?: boolean;
}

export interface AccessPassDraftInput {
  holderName: string;
  kind?: AccessPassKind | null;
  petName?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  nowIso?: string;
}

export interface AccessPassInput {
  passes?: readonly AccessPass[] | null;
  petName?: string | null;
  now?: number;
}

export interface AccessPassView extends AccessPass {
  status: AccessPassStatus;
  petName: string;
  permissions: string[];
  blockedPermissions: string[];
  responsibilities: string[];
  storageStatus: AccessPassStorageStatus;
  providerShareEnabled: boolean;
  timeLabel: string;
  attention: string | null;
}

export interface AccessPassPlan {
  status: AccessPassPlanStatus;
  title: string;
  summary: string;
  nextStep: string;
  permissionBoundary: string;
  activeCount: number;
  upcomingCount: number;
  draftCount: number;
  expiredCount: number;
  passes: AccessPassView[];
}

export interface MyCareTodayInput {
  personName?: string | null;
  petName?: string | null;
  routines: readonly RoutineBoardRoutine[];
  entries: readonly RoutineBoardEntry[];
  now?: number;
}

export interface MyCareTodayItem {
  id: string;
  label: string;
  type: string;
  time: string;
  status: RoutineBoardItem["status"];
  completionLabel: string | null;
  completedAt: string | null;
  minutesFromNow: number | null;
}

export interface MyCareToday {
  status: MyCareTodayStatus;
  title: string;
  summary: string;
  nextStep: string;
  personName: string;
  petName: string;
  assignedCount: number;
  correctionCount: number;
  doneCount: number;
  openCount: number;
  overdueCount: number;
  dueCount: number;
  upcomingCount: number;
  items: MyCareTodayItem[];
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function addHours(iso: string, hours: number): string {
  const time = Date.parse(iso);
  const base = Number.isNaN(time) ? Date.now() : time;
  return new Date(base + hours * 60 * 60 * 1000).toISOString();
}

function kindLabel(kind: AccessPassKind): string {
  switch (kind) {
    case "sitter":
      return "Sitter";
    case "trainer":
      return "Trainer";
    case "vet":
      return "Vet viewer";
    case "emergency":
      return "Emergency helper";
    default:
      return "Temporary helper";
  }
}

function permissionsFor(kind: AccessPassKind): string[] {
  switch (kind) {
    case "sitter":
      return ["View routine", "Log meals", "Log walks", "Log potty", "View emergency info", "Add notes"];
    case "trainer":
      return ["View routine", "View behavior notes", "Log training", "Add training notes", "Preview trainer Care Pass"];
    case "vet":
      return ["View health summary", "View medications", "View records", "View recent concerns", "Preview Vet Care Pass"];
    case "emergency":
      return ["View emergency info", "View medications", "Log urgent care", "View routine", "Call emergency contacts"];
    default:
      return ["View routine", "Log assigned care", "Add notes"];
  }
}

function blockedPermissionsFor(kind: AccessPassKind): string[] {
  const base = ["Edit records", "Invite people", "Change diet", "Export full health report"];
  if (kind === "vet") return ["Invite people", "Change household roles", "Edit routine", "Delete logs"];
  if (kind === "emergency") return ["Invite people", "Change diet", "Delete logs", "Change records"];
  return base;
}

function statusFor(pass: AccessPass, now: number): AccessPassStatus {
  if (pass.status === "revoked") return "revoked";
  if (pass.status === "draft") return "draft";
  const start = Date.parse(pass.startsAt);
  const end = Date.parse(pass.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return "draft";
  if (now < start) return "upcoming";
  if (now > end) return "expired";
  return "active";
}

function timeLabel(pass: AccessPassView): string {
  if (pass.status === "draft") return "Draft access";
  const start = new Date(pass.startsAt);
  const end = new Date(pass.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Timing needs review";
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return startLabel === endLabel ? `${startLabel}, temporary` : `${startLabel} - ${endLabel}`;
}

function comparePasses(a: AccessPassView, b: AccessPassView): number {
  const rank: Record<AccessPassStatus, number> = { active: 0, upcoming: 1, draft: 2, expired: 3, revoked: 4 };
  const rankDiff = rank[a.status] - rank[b.status];
  if (rankDiff !== 0) return rankDiff;
  return Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

export function buildAccessPassDraft(input: AccessPassDraftInput): AccessPass {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const holderName = clean(input.holderName) || "Temporary helper";
  const kind = input.kind ?? "sitter";
  const startsAt = clean(input.startsAt) || nowIso;
  const endsAt = clean(input.endsAt) || addHours(startsAt, kind === "emergency" ? 72 : 24);
  const role = kindLabel(kind);

  return {
    id: `access_${slug(holderName) || "helper"}_${Date.parse(nowIso) || Date.now()}`,
    holderName,
    role,
    kind,
    startsAt,
    endsAt,
    status: "draft",
    petName: resolvePetName(clean(input.petName)),
    permissions: permissionsFor(kind),
    blockedPermissions: blockedPermissionsFor(kind),
    responsibilities: [],
    notes: "Local draft. Provider-backed sharing is required before this becomes a live remote permission.",
    storageStatus: "local-draft",
    providerShareEnabled: false,
  };
}

export function deriveAccessPassPlan(input: AccessPassInput): AccessPassPlan {
  const now = input.now ?? Date.now();
  const petName = resolvePetName(clean(input.petName));
  const passes = (input.passes ?? [])
    .map((pass): AccessPassView => {
      const kind = pass.kind ?? "sitter";
      const status = statusFor(pass, now);
      const view: AccessPassView = {
        ...pass,
        role: clean(pass.role) || kindLabel(kind),
        kind,
        holderName: clean(pass.holderName) || "Temporary helper",
        petName: resolvePetName(clean(pass.petName), petName),
        status,
        permissions: [...(pass.permissions?.length ? pass.permissions : permissionsFor(kind))],
        blockedPermissions: [...(pass.blockedPermissions?.length ? pass.blockedPermissions : blockedPermissionsFor(kind))],
        responsibilities: [...(pass.responsibilities ?? [])],
        storageStatus: pass.storageStatus ?? (pass.providerShareEnabled ? "provider-ready" : "local-draft"),
        providerShareEnabled: pass.providerShareEnabled ?? false,
        timeLabel: "",
        attention: null,
      };
      view.timeLabel = timeLabel(view);
      view.attention =
        view.status === "active"
          ? "Temporary access is active. Review responsibilities and revoke when care is finished."
          : view.status === "draft"
            ? "Local draft only. No remote helper has access yet."
            : view.status === "expired"
              ? "Expired pass. Keep for history or archive later."
              : null;
      return view;
    })
    .sort(comparePasses);

  const active = passes.filter((pass) => pass.status === "active");
  const upcoming = passes.filter((pass) => pass.status === "upcoming");
  const draft = passes.filter((pass) => pass.status === "draft");
  const expired = passes.filter((pass) => pass.status === "expired" || pass.status === "revoked");
  const first = active[0] ?? upcoming[0] ?? draft[0] ?? expired[0] ?? null;
  const status: AccessPassPlanStatus =
    active.length > 0 ? "active" : upcoming.length > 0 ? "upcoming" : draft.length > 0 ? "draft" : expired.length > 0 ? "expired" : "none";

  return {
    status,
    title:
      status === "active"
        ? "Access Pass is active"
        : status === "upcoming"
          ? "Access Pass is scheduled"
          : status === "draft"
            ? "Access Pass draft ready"
            : "No Access Passes yet",
    summary: first
      ? `${first.holderName} has ${first.status} ${first.role.toLowerCase()} access for ${first.petName}. ${active.length} active, ${upcoming.length} upcoming.`
      : `Create a temporary Access Pass before a sitter, trainer, vet viewer, or emergency helper cares for ${petName}.`,
    nextStep:
      status === "active" && first
        ? `Review ${first.holderName}'s responsibilities, keep proof requirements clear, and revoke access when care is finished.`
        : status === "upcoming" && first
          ? `${first.holderName}'s access is scheduled. Confirm responsibilities before the start time.`
          : status === "draft" && first
            ? `Finish ${first.holderName}'s draft only after provider-backed sharing rules are ready.`
            : "Create a local draft now; provider-backed sharing remains required before remote access is live.",
    permissionBoundary: "Access Pass is permission to help; Care Pass is the shareable report.",
    activeCount: active.length,
    upcomingCount: upcoming.length,
    draftCount: draft.length,
    expiredCount: expired.length,
    passes,
  };
}

function careStatus(items: readonly RoutineBoardItem[], correctionCount: number): MyCareTodayStatus {
  if (items.length === 0) return "empty";
  if (items.some((item) => item.status === "overdue" || item.status === "due")) return "needs-care";
  if (correctionCount > 0) return "needs-correction";
  if (items.every((item) => item.status === "done")) return "complete";
  return "steady";
}

function nextOpen(items: readonly RoutineBoardItem[]): RoutineBoardItem | null {
  return (
    items.find((item) => item.status === "overdue") ??
    items.find((item) => item.status === "due") ??
    items.find((item) => item.status === "upcoming") ??
    null
  );
}

export function deriveMyCareToday(input: MyCareTodayInput): MyCareToday {
  const now = input.now ?? Date.now();
  const namedPerson = clean(input.personName);
  const personName = namedPerson || "You";
  const personObject = namedPerson || "you";
  const petName = resolvePetName(clean(input.petName));
  const board = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    caregivers: [{ name: personName }],
    now,
  });
  const assigned = board.items.filter((item) => item.owner.toLowerCase() === personName.toLowerCase());
  const scheduledAssigned = assigned.filter(isRoutineBoardScheduledItem);
  const correctionCount = assigned.length - scheduledAssigned.length;
  const status = scheduledAssigned.length === 0 && correctionCount > 0
    ? "needs-correction"
    : careStatus(scheduledAssigned, correctionCount);
  const next = nextOpen(scheduledAssigned);
  const doneCount = scheduledAssigned.filter((item) => item.status === "done").length;
  const overdueCount = scheduledAssigned.filter((item) => item.status === "overdue").length;
  const dueCount = scheduledAssigned.filter((item) => item.status === "due").length;
  const upcomingCount = scheduledAssigned.filter((item) => item.status === "upcoming").length;
  const correctionSummary = `${correctionCount} routine${correctionCount === 1 ? "" : "s"} ${correctionCount === 1 ? "needs" : "need"} correction.`;

  return {
    status,
    title: namedPerson ? `${personName}'s care today` : "Your care today",
    summary:
      assigned.length === 0
        ? `No routines are assigned to ${personObject} today.`
        : scheduledAssigned.length === 0
          ? `0 schedulable routines assigned to ${personObject}. ${correctionSummary}`
          : `${doneCount}/${scheduledAssigned.length} assigned routines handled for ${petName}. ${scheduledAssigned.length - doneCount} open.${correctionCount ? ` ${correctionSummary}` : ""}`,
    nextStep:
      assigned.length === 0
        ? "Assign routines by owner so each human sees their own care list."
        : next
          ? `${next.label} is ${next.status} for ${personObject}. Log it, update it, or reassign it if plans changed.`
          : correctionCount > 0
            ? `Correct ${assigned.find((item) => item.status === "needs-correction")?.label ?? "the routine"}'s saved time before it can be scheduled for ${personObject}.`
          : `Everything assigned to ${personObject} is handled today.`,
    personName,
    petName,
    assignedCount: scheduledAssigned.length,
    correctionCount,
    doneCount,
    openCount: scheduledAssigned.length - doneCount,
    overdueCount,
    dueCount,
    upcomingCount,
    items: assigned.map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      time: item.time,
      status: item.status,
      completionLabel: item.completionLabel,
      completedAt: item.completedAt,
      minutesFromNow: item.minutesFromNow,
    })),
  };
}
