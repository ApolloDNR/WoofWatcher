import { resolvePetName } from "./pet-identity.ts";
import { type RoutineBoardEntry, type RoutineBoardItem, type RoutineBoardRoutine, deriveRoutineBoard } from "./routine-board.ts";

export type HouseholdResponsibilityStatus =
  | "needs-setup"
  | "needs-assignment"
  | "needs-care"
  | "balanced"
  | "steady";

export type HouseholdResponsibilityActionKind =
  | "add-caregiver"
  | "create-routine"
  | "assign-routine"
  | "log-routine"
  | "confirm-routine"
  | "review-next";

export interface HouseholdResponsibilityCaregiver {
  name: string;
  role: string;
  assigned: number;
  done: number;
  open: number;
  overdue: number;
  due: number;
  upcoming: number;
  todayLogs: number;
  completionPercent: number;
  latestLogTitle: string | null;
  latestLogAt: string | null;
  nextRoutine: {
    id: string;
    label: string;
    time: string;
    status: RoutineBoardItem["status"];
  } | null;
}

export interface HouseholdResponsibilityNextAction {
  kind: HouseholdResponsibilityActionKind;
  label: string;
  routineId?: string;
  routineLabel?: string;
  owner?: string;
}

export interface HouseholdResponsibilityCaregiverInput {
  name: string;
  role?: string | null;
}

export interface HouseholdResponsibilityInput {
  routines: readonly RoutineBoardRoutine[];
  entries: readonly RoutineBoardEntry[];
  caregivers?: readonly HouseholdResponsibilityCaregiverInput[];
  now?: number;
  /** Display name for owner-facing copy; resolved via resolvePetName so renamed dogs never read "Phoenix". */
  petName?: string | null;
}

export interface HouseholdResponsibility {
  status: HouseholdResponsibilityStatus;
  title: string;
  summary: string;
  nextStep: string;
  totalMembers: number;
  totalRoutines: number;
  assignedRoutines: number;
  unassignedRoutines: number;
  doneRoutines: number;
  openRoutines: number;
  overdueRoutines: number;
  dueRoutines: number;
  members: HouseholdResponsibilityCaregiver[];
  unassignedItems: RoutineBoardItem[];
  nextAction: HouseholdResponsibilityNextAction | null;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function isVisible(entry: RoutineBoardEntry): boolean {
  return entry.details?.householdVisible !== false;
}

function completionPercent(done: number, assigned: number): number {
  if (assigned <= 0) return 0;
  return Math.round((done / assigned) * 100);
}

function visibleTodayEntries(entries: readonly RoutineBoardEntry[], now: number): RoutineBoardEntry[] {
  return entries.filter((entry) => isVisible(entry) && isSameLocalDay(entry.occurredAt, now));
}

function routineAction(kind: HouseholdResponsibilityActionKind, item: RoutineBoardItem): HouseholdResponsibilityNextAction {
  const owner = clean(item.owner);
  return {
    kind,
    label: item.label,
    routineId: item.id,
    routineLabel: item.label,
    ...(owner ? { owner } : {}),
  };
}

function nextOpenForOwner(items: RoutineBoardItem[]): RoutineBoardItem | null {
  return (
    items.find((item) => item.status === "overdue") ??
    items.find((item) => item.status === "due") ??
    items.find((item) => item.status === "upcoming") ??
    null
  );
}

function buildMembers(input: {
  caregivers: readonly HouseholdResponsibilityCaregiverInput[];
  items: readonly RoutineBoardItem[];
  entries: readonly RoutineBoardEntry[];
}): HouseholdResponsibilityCaregiver[] {
  const roleByName = new Map<string, string>();
  const names: string[] = [];
  const addName = (name: string, role?: string | null) => {
    const cleaned = clean(name);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (!names.some((existing) => existing.toLowerCase() === key)) names.push(cleaned);
    if (role && !roleByName.has(key)) roleByName.set(key, clean(role));
  };

  input.caregivers.forEach((caregiver) => addName(caregiver.name, caregiver.role));
  input.items.forEach((item) => addName(item.owner, "Caregiver"));
  input.entries.forEach((entry) => addName(entry.caregiver ?? "", "Caregiver"));

  return names.map((name) => {
    const assignedItems = input.items.filter((item) => item.owner.toLowerCase() === name.toLowerCase());
    const done = assignedItems.filter((item) => item.status === "done").length;
    const openItems = assignedItems.filter((item) => item.status !== "done");
    const caregiverEntries = input.entries
      .filter((entry) => clean(entry.caregiver).toLowerCase() === name.toLowerCase())
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    const latest = caregiverEntries[0] ?? null;
    const next = nextOpenForOwner(openItems);

    return {
      name,
      role: roleByName.get(name.toLowerCase()) || "Caregiver",
      assigned: assignedItems.length,
      done,
      open: openItems.length,
      overdue: assignedItems.filter((item) => item.status === "overdue").length,
      due: assignedItems.filter((item) => item.status === "due").length,
      upcoming: assignedItems.filter((item) => item.status === "upcoming").length,
      todayLogs: caregiverEntries.length,
      completionPercent: completionPercent(done, assignedItems.length),
      latestLogTitle: latest?.title ? clean(latest.title) : null,
      latestLogAt: latest?.occurredAt ?? null,
      nextRoutine: next
        ? {
            id: next.id,
            label: next.label,
            time: next.time,
            status: next.status,
          }
        : null,
    };
  });
}

export function deriveHouseholdResponsibility(input: HouseholdResponsibilityInput): HouseholdResponsibility {
  const now = input.now ?? Date.now();
  const petName = resolvePetName(input.petName);
  const board = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    caregivers: input.caregivers?.map((caregiver) => ({ name: caregiver.name, role: caregiver.role ?? undefined })),
    now,
  });
  const todayEntries = visibleTodayEntries(input.entries, now);
  const members = buildMembers({
    caregivers: input.caregivers ?? [],
    items: board.items,
    entries: todayEntries,
  });
  const unassignedItems = board.items.filter((item) => !clean(item.owner));
  const openUnassigned = unassignedItems.filter((item) => item.status !== "done");
  const overdueItems = board.items.filter((item) => item.status === "overdue");
  const dueItems = board.items.filter((item) => item.status === "due");
  const upcomingItems = board.items.filter((item) => item.status === "upcoming");
  const totalRoutines = board.items.length;

  if (members.length === 0) {
    return {
      status: "needs-setup",
      title: "Build the care team",
      summary: "No household caregivers are set up yet.",
      nextStep: `Add the first caregiver so ${petName}'s routines have clear ownership.`,
      totalMembers: 0,
      totalRoutines,
      assignedRoutines: totalRoutines - unassignedItems.length,
      unassignedRoutines: unassignedItems.length,
      doneRoutines: board.doneCount,
      openRoutines: board.openCount,
      overdueRoutines: overdueItems.length,
      dueRoutines: dueItems.length,
      members,
      unassignedItems,
      nextAction: { kind: "add-caregiver", label: "Add caregiver" },
    };
  }

  if (totalRoutines === 0) {
    return {
      status: "needs-setup",
      title: "Create shared routines",
      summary: `${members.length} caregiver${members.length === 1 ? "" : "s"} ready, but no routines are scheduled.`,
      nextStep: "Create the first shared routine so logs can satisfy the household plan.",
      totalMembers: members.length,
      totalRoutines,
      assignedRoutines: 0,
      unassignedRoutines: 0,
      doneRoutines: 0,
      openRoutines: 0,
      overdueRoutines: 0,
      dueRoutines: 0,
      members,
      unassignedItems,
      nextAction: { kind: "create-routine", label: "Create routine" },
    };
  }

  const base = {
    totalMembers: members.length,
    totalRoutines,
    assignedRoutines: totalRoutines - unassignedItems.length,
    unassignedRoutines: unassignedItems.length,
    doneRoutines: board.doneCount,
    openRoutines: board.openCount,
    overdueRoutines: overdueItems.length,
    dueRoutines: dueItems.length,
    members,
    unassignedItems,
  };
  const summary = `${board.doneCount}/${totalRoutines} routines handled today. ${board.openCount} open, ${overdueItems.length} overdue, ${unassignedItems.length} unassigned.`;

  if (overdueItems.length > 0) {
    const item = overdueItems[0];
    const owner = clean(item.owner) || "the household";
    return {
      ...base,
      status: "needs-care",
      title: "Care needs attention",
      summary,
      nextStep: `${item.label} is overdue for ${owner}. Log it, reassign it, or add a note so nobody assumes it was handled.`,
      nextAction: routineAction("log-routine", item),
    };
  }

  if (openUnassigned.length > 0) {
    const item = openUnassigned[0];
    return {
      ...base,
      status: "needs-assignment",
      title: "Assign routine owners",
      summary,
      nextStep: `Assign ${item.label} before it becomes due so the household knows who owns it.`,
      nextAction: routineAction("assign-routine", item),
    };
  }

  if (dueItems.length > 0) {
    const item = dueItems[0];
    const owner = clean(item.owner) || "the household";
    return {
      ...base,
      status: "needs-care",
      title: "Care is due now",
      summary,
      nextStep: `Confirm ${item.label} with ${owner} or log what happened.`,
      nextAction: routineAction("confirm-routine", item),
    };
  }

  if (board.openCount === 0) {
    return {
      ...base,
      status: "steady",
      title: "Household care is handled",
      summary,
      nextStep: "Every routine is handled today. Keep logging visible care so the whole household stays aligned.",
      nextAction: null,
    };
  }

  const next = upcomingItems[0] ?? board.next;
  return {
    ...base,
    status: "balanced",
    title: "Household rhythm is clear",
    summary,
    nextStep: next
      ? `Next up: ${next.label} at ${next.time}${next.owner ? ` with ${next.owner}` : ""}.`
      : "Keep the shared routine board current as care happens.",
    nextAction: next ? routineAction("review-next", next) : null,
  };
}
