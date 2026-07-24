export type HouseholdAccessStatus = "needs-household" | "needs-invites" | "needs-roles" | "ready";
export type HouseholdAccessSource = "account" | "care-doc" | "routine-owner";

export interface HouseholdAccessHousehold {
  name?: string | null;
}

export interface HouseholdAccessMember {
  id?: string | null;
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface HouseholdAccessCaregiver {
  name?: string | null;
  role?: string | null;
}

export interface HouseholdAccessRoutine {
  label?: string | null;
  owner?: string | null;
}

export interface HouseholdAccessInput {
  household?: HouseholdAccessHousehold | null;
  canManageInvitations?: boolean;
  members?: readonly HouseholdAccessMember[] | null;
  caregivers?: readonly HouseholdAccessCaregiver[] | null;
  routines?: readonly HouseholdAccessRoutine[] | null;
}

export interface HouseholdAccessPerson {
  id: string;
  name: string;
  email: string;
  role: string;
  source: HouseholdAccessSource;
  needsInvite: boolean;
  routineCount: number;
  routineLabels: string[];
  permissions: string[];
  attention: string | null;
}

export interface HouseholdAccessPlan {
  status: HouseholdAccessStatus;
  householdName: string;
  canShareInvite: boolean;
  syncedMembers: number;
  localOnlyCaregivers: number;
  routineOnlyOwners: number;
  people: HouseholdAccessPerson[];
  summary: string;
  nextStep: string;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function keyFor(value: unknown): string {
  return clean(value).toLowerCase();
}

function nameFromMember(member: HouseholdAccessMember): string {
  const display = clean(member.displayName);
  if (display) return display;
  const email = clean(member.email);
  return email ? email.split("@")[0] || "Member" : "Member";
}

function roleLabel(role: unknown, fallback = "Caregiver"): string {
  const cleaned = clean(role);
  if (!cleaned) return fallback;
  const lower = cleaned.toLowerCase();
  if (lower === "owner" || lower === "admin") return "Owner";
  if (lower === "member") return "Caregiver";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function permissionsFor(role: string): string[] {
  const lower = role.toLowerCase();
  if (lower.includes("owner")) return ["Manage household", "Edit care plan", "Log care", "View reports"];
  if (lower.includes("walker")) return ["Log walks", "View assigned routines", "Add walk notes"];
  if (lower.includes("sitter")) return ["Log care", "View routines", "Preview handoffs"];
  if (lower.includes("trainer")) return ["Log training", "View behavior notes", "Preview trainer reports"];
  return ["Log care", "View routines", "View reports"];
}

function idFor(source: HouseholdAccessSource, name: string): string {
  const slug = keyFor(name).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${source}_${slug || "member"}`;
}

function addRoutine(person: HouseholdAccessPerson, label: string): void {
  person.routineCount += 1;
  if (label && !person.routineLabels.includes(label)) person.routineLabels.push(label);
}

function summaryFor(input: {
  syncedMembers: number;
  localOnlyCaregivers: number;
  routineOnlyOwners: number;
  canShareInvite: boolean;
}): string {
  const parts = [
    `${input.syncedMembers} synced`,
    `${input.localOnlyCaregivers} pending invite${input.localOnlyCaregivers === 1 ? "" : "s"}`,
    `${input.routineOnlyOwners} routine-only owner${input.routineOnlyOwners === 1 ? "" : "s"}`,
  ];
  // The actionable next-step line already explains the pre-household state;
  // an "invite unavailable" clause here just reads like an error.
  return `${parts.join(", ")}.`;
}

function nextStepFor(plan: {
  status: HouseholdAccessStatus;
  pendingNames: string[];
  routineOnlyOwners: number;
  canShareInvite: boolean;
}): string {
  if (plan.status === "needs-household") {
    return "Create or join a household before creating expiring invitations or assigning synced roles.";
  }
  if (plan.status === "needs-invites") {
    const names = plan.pendingNames.slice(0, 2).join(" and ");
    const suffix = plan.pendingNames.length > 2 ? ` plus ${plan.pendingNames.length - 2} more` : "";
    return plan.canShareInvite
      ? `Invite ${names}${suffix} so every routine owner can sync care from their own account.`
      : "Connect household invite sharing so local caregivers can join the synced care team.";
  }
  if (plan.status === "needs-roles") {
    return "Review routine-only owners and assign them to real household caregivers.";
  }
  return "Keep roles current whenever routines, sitters, walkers, or care ownership changes.";
}

export function deriveHouseholdAccessPlan(input: HouseholdAccessInput): HouseholdAccessPlan {
  const householdName = clean(input.household?.name) || "Your household";
  const canShareInvite = Boolean(
    input.household && input.canManageInvitations,
  );
  const people = new Map<string, HouseholdAccessPerson>();

  const upsert = (name: string, role: string, source: HouseholdAccessSource, email = ""): HouseholdAccessPerson => {
    const key = keyFor(name);
    const existing = people.get(key);
    if (existing) {
      if (source === "account") {
        existing.source = "account";
        existing.needsInvite = false;
        existing.email = email || existing.email;
      }
      if (role && existing.role !== "Owner" && (source !== "routine-owner" || existing.source === "routine-owner")) {
        existing.role = role;
        existing.permissions = permissionsFor(role);
      }
      return existing;
    }
    const person: HouseholdAccessPerson = {
      id: idFor(source, name),
      name,
      email,
      role,
      source,
      needsInvite: source !== "account",
      routineCount: 0,
      routineLabels: [],
      permissions: permissionsFor(role),
      attention: null,
    };
    people.set(key, person);
    return person;
  };

  for (const member of input.members ?? []) {
    const name = nameFromMember(member);
    upsert(name, roleLabel(member.role), "account", clean(member.email));
  }

  for (const caregiver of input.caregivers ?? []) {
    const name = clean(caregiver.name);
    if (!name) continue;
    upsert(name, roleLabel(caregiver.role), "care-doc");
  }

  for (const routine of input.routines ?? []) {
    const owner = clean(routine.owner);
    if (!owner) continue;
    const person = upsert(owner, "Routine owner", "routine-owner");
    addRoutine(person, clean(routine.label));
  }

  const ordered = [...people.values()].map((person) => ({
    ...person,
    attention: person.needsInvite
      ? person.source === "routine-owner"
        ? "Assigned to routines but not in the care team yet."
        : "Saved locally; invite needed for synced household access."
      : null,
  }));
  const syncedMembers = (input.members ?? []).filter((member) => clean(member.displayName) || clean(member.email)).length;
  const localOnlyCaregivers = ordered.filter((person) => person.needsInvite).length;
  const routineOnlyOwners = ordered.filter((person) => person.source === "routine-owner").length;
  const pendingNames = ordered.filter((person) => person.needsInvite).map((person) => person.name);
  const status: HouseholdAccessStatus =
    !input.household
      ? "needs-household"
      : localOnlyCaregivers > 0
        ? "needs-invites"
        : routineOnlyOwners > 0
          ? "needs-roles"
          : "ready";

  return {
    status,
    householdName,
    canShareInvite,
    syncedMembers,
    localOnlyCaregivers,
    routineOnlyOwners,
    people: ordered,
    summary: summaryFor({ syncedMembers, localOnlyCaregivers, routineOnlyOwners, canShareInvite }),
    nextStep: nextStepFor({ status, pendingNames, routineOnlyOwners, canShareInvite }),
  };
}
