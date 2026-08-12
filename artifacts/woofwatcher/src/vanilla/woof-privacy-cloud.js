import {
  buildReportText,
  getBileWatch,
  getCaregiverHandoff,
  getGoalReview,
  getHealthWatch,
  getHouseholdPulse,
  getMonthlySummary,
  getReminderCenter,
  getTodayPlan,
  getTrainingProgress,
  normalizeState
} from "./woof-core.js";

export const ACCESS_SCOPES = [
  "profile_read",
  "routine_read",
  "routine_write",
  "entry_read",
  "entry_create",
  "entry_write",
  "health_read",
  "records_read",
  "records_write",
  "care_pass_read",
  "care_pass_create",
  "settings_write"
];

const ACCEPTED_CLOUD_SYNC_PROOF_MIME_TYPES = new Set([
  "application/json",
  "text/markdown",
  "text/plain"
]);

export const CLOUD_SYNC_PROVIDER_PROOF_REQUIREMENTS = [
  "Supabase project id",
  "migration/backfill policy",
  "active-household RLS policy",
  "retention/export/deletion policy",
  "dependency-complete build proof",
  "mobile full-refresh sign-off",
  "Apollo approval"
];

export const CAREGIVER_ROLES = [
  {
    id: "owner",
    label: "Owner",
    description: "Full control of Phoenix's local state, privacy choices, exports, records, and future cloud sync.",
    scopes: ACCESS_SCOPES
  },
  {
    id: "caregiver",
    label: "Caregiver",
    description: "Can coordinate daily care, create logs, review plans, and read health pattern context.",
    scopes: ["profile_read", "routine_read", "routine_write", "entry_read", "entry_create", "entry_write", "health_read", "care_pass_read"]
  },
  {
    id: "sitter",
    label: "Sitter",
    description: "Can see routines, diet guidance, sitter Care Pass context, and add care proof.",
    scopes: ["profile_read", "routine_read", "entry_create", "care_pass_read"]
  },
  {
    id: "vet",
    label: "Veterinarian",
    description: "Can review scoped health, diet, records, and report context. Cannot write household care logs by default.",
    scopes: ["profile_read", "health_read", "records_read", "care_pass_read"]
  },
  {
    id: "trainer",
    label: "Trainer",
    description: "Can review behavior, training, social exposure, and scoped care history.",
    scopes: ["profile_read", "routine_read", "entry_read", "care_pass_read"]
  }
];

export const CARE_PASS_VARIANTS = [
  { id: "vet", label: "Vet Care Pass" },
  { id: "sitter", label: "Sitter Care Pass" },
  { id: "trainer", label: "Trainer Care Pass" },
  { id: "emergency", label: "Emergency Care Pass" },
  { id: "weekend", label: "Weekend Care Pass" }
];

export function buildScopedCarePass(input = {}, options = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const petName = resolvePetName(state.profile.name);
  const profile = {
    ...state.profile,
    name: petName,
    publicLabel: petName
  };
  const audience = normalizeVariant(options.audience || options.variant || "sitter");
  const common = {
    packageType: "woofwatcher.care-pass",
    version: 1,
    audience,
    label: CARE_PASS_VARIANTS.find((variant) => variant.id === audience)?.label || "Care Pass",
    createdAt: now,
    petName,
    profile,
    dietProfile: state.dietProfile,
    householdPulse: getHouseholdPulse(state, now),
    boundary: "This Care Pass is pattern tracking and caregiver context. It is not a diagnosis or veterinary advice.",
    privacy: {
      includesFullState: false,
      importableAsBackup: false,
      privateData: "Scoped Phoenix care context only. Do not publish without household consent."
    }
  };

  if (audience === "vet") {
    return compactObject({
      ...common,
      sections: ["profile", "dietProfile", "healthWatch", "bileWatch", "records", "monthlySummary", "monthlyReport", "recentHealthTimeline"],
      healthWatch: getHealthWatch(state, now),
      bileWatch: getBileWatch(state, now),
      records: state.records || [],
      monthlySummary: getMonthlySummary(state, now),
      monthlyReport: buildReportText(state, now),
      recentHealthTimeline: recentEntries(state, ["vomit", "health", "vet", "weight", "medication"], 12)
    });
  }

  if (audience === "trainer") {
    return compactObject({
      ...common,
      sections: ["profile", "dietProfile", "trainingProgress", "trainingGoals", "recentTrainingTimeline"],
      trainingProgress: getTrainingProgress(state, now),
      trainingGoals: getGoalReview(state, now).goals.filter((goal) => ["training", "anxiety", "social"].includes(goal.category)),
      recentTrainingTimeline: recentEntries(state, ["training", "social", "park", "mood", "play"], 16)
    });
  }

  if (audience === "emergency") {
    return compactObject({
      ...common,
      sections: ["profile", "dietProfile", "routines", "healthWatch", "bileWatch", "keyRecords", "latestTimeline"],
      routines: state.routines || [],
      healthWatch: getHealthWatch(state, now),
      bileWatch: getBileWatch(state, now),
      keyRecords: (state.records || []).filter((record) => ["vet", "vaccine", "medication", "microchip", "instruction"].includes(record.type)),
      latestTimeline: recentEntries(state, null, 10)
    });
  }

  const plan = getTodayPlan(state, now);
  return compactObject({
    ...common,
    sections: ["profile", "dietProfile", "routines", "todayPlan", "reminders", "caregiverHandoff", "recentCareTimeline"],
    routines: state.routines || [],
    todayPlan: plan,
    reminders: getReminderCenter(state, now),
    caregiverHandoff: getCaregiverHandoff(state, now),
    recentCareTimeline: recentEntries(state, null, audience === "weekend" ? 18 : 10)
  });
}

export function createCaregiverInviteDraft(input = {}, now = new Date().toISOString()) {
  const role = normalizeRole(input.role || "caregiver");
  const roleDefinition = CAREGIVER_ROLES.find((item) => item.id === role) || CAREGIVER_ROLES[1];
  const requestedScopes = Array.isArray(input.scopes) ? input.scopes.map(cleanText).filter(Boolean) : roleDefinition.scopes;
  const scopes = requestedScopes.filter((scope) => roleDefinition.scopes.includes(scope));

  return {
    packageType: "woofwatcher.invite-draft",
    version: 1,
    createdAt: now,
    expiresAt: validDateString(input.expiresAt) || addDays(now, 7),
    status: "draft_not_sent",
    delivery: "manual_until_backend_exists",
    recipientName: cleanText(input.recipientName) || "Invited caregiver",
    recipientEmail: cleanText(input.recipientEmail),
    role,
    roleLabel: roleDefinition.label,
    scopes,
    privacyNotice: "This invite would grant access to private Phoenix care context. Send only to trusted people after the household privacy decision is made.",
    backendBoundary: "No auth token, magic link, or account credential is generated by this local draft."
  };
}

export function buildCaregiverAccessModel(input = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const petName = resolvePetName(state.profile.name);
  return {
    generatedAt: now,
    household: {
      status: "local_only",
      petName,
      recommendedNextStep: "Choose private local-only, protected preview, or account-backed cloud sync before inviting external caregivers."
    },
    roles: CAREGIVER_ROLES,
    scopeCatalog: ACCESS_SCOPES,
    members: (state.caregivers || []).map((caregiver, index) => ({
      name: caregiver.name,
      role: index === 0 || /apollo/i.test(caregiver.name) ? "owner" : "caregiver",
      roleLabel: index === 0 || /apollo/i.test(caregiver.name) ? "Owner" : "Caregiver",
      source: "local_care_team"
    })),
    inviteDrafts: [
      createCaregiverInviteDraft({ recipientName: "Weekend sitter", role: "sitter" }, now),
      createCaregiverInviteDraft({ recipientName: "Veterinarian", role: "vet" }, now),
      createCaregiverInviteDraft({ recipientName: "Trainer", role: "trainer" }, now)
    ],
    privacyBoundary: "WoofWatcher cloud access should be invite-only. Phoenix care, health, diet, and household notes are private by default."
  };
}

export function buildCloudSyncPlan(input = {}, options = {}, now = new Date().toISOString()) {
  const state = normalizeState(input, now);
  const petName = resolvePetName(state.profile.name);
  const householdId = cleanText(options.householdId);
  const backendConfigured = Boolean(options.backendConfigured || cleanText(options.backendUrl));
  const providerEvidence = options.providerEvidence || options.cloudSyncProviderEvidence || null;
  const providerProofReady = backendConfigured && isCloudSyncProviderProofReady(providerEvidence);
  const blockers = [];
  if (!backendConfigured) blockers.push("Choose and configure a backend before enabling cross-device sync.");
  if (backendConfigured && !providerProofReady) {
    blockers.push(
      "Attach structured cloud sync provider proof covering Supabase project id, migration/backfill, active-household RLS, retention/export/deletion, dependency build, mobile full-refresh sign-off, and Apollo approval before enabling cross-device sync.",
    );
  }
  if (!householdId) blockers.push("Create a household id before writing shared Phoenix data.");

  return {
    generatedAt: now,
    status: !backendConfigured || !householdId ? "local_only" : providerProofReady ? "ready_to_connect" : "provider_proof_pending",
    householdId,
    backend: {
      provider: cleanText(options.provider) || "undecided",
      configured: backendConfigured,
      urlConfigured: Boolean(cleanText(options.backendUrl)),
      proofReady: providerProofReady,
      proofRequirements: CLOUD_SYNC_PROVIDER_PROOF_REQUIREMENTS
    },
    localStateFingerprint: stableFingerprint({
      updatedAt: state.updatedAt,
      profile: petName,
      routines: state.routines?.length || 0,
      entries: state.entries?.length || 0,
      records: state.records?.length || 0,
      goals: state.goals?.length || 0
    }),
    pendingLocalCounts: {
      entries: state.entries?.length || 0,
      routines: state.routines?.length || 0,
      goals: state.goals?.length || 0,
      records: state.records?.length || 0,
      caregivers: state.caregivers?.length || 0
    },
    resources: [
      syncResource("households", "Household account and privacy settings", true),
      syncResource("members", "Invited humans and roles", true),
      syncResource("pets", "Phoenix profile and non-secret care focus", true),
      syncResource("care_entries", "Meals, walks, training, vomit, health, notes", true),
      syncResource("routines", "Plans, meals, walks, bedtime snack, reminders", true),
      syncResource("records", "Vet, vaccine, medication, microchip, instructions", true),
      syncResource("goals", "Training, weight, anxiety, health milestones", true),
      syncResource("care_passes", "Scoped share packages", true),
      syncResource("audit_events", "Append-only sync/change proof", false)
    ],
    conflictPolicy: "Default conflict policy: newest edit wins for profile/routines/settings; append-only for logs, records, care passes, and audit events.",
    privacyChecklist: [
      "Keep repository private until demo/private split is decided.",
      "Do not store OpenAI keys in client JavaScript.",
      "Use invite-only access before sharing Phoenix data.",
      "Keep Care Pass scoped unless this is same-household device transfer.",
      "Log destructive changes in audit_events."
    ],
    providerBoundary:
      "Backend configuration is only staged until structured cloud sync provider proof covers Supabase project id, migration/backfill, active-household RLS, retention/export/deletion, dependency build, mobile full-refresh sign-off, and Apollo approval.",
    blockers
  };
}

export function isCloudSyncProviderProofReady(evidence = {}) {
  return Boolean(
    cleanText(evidence?.proofLocator) &&
      ACCEPTED_CLOUD_SYNC_PROOF_MIME_TYPES.has(cleanText(evidence?.proofMimeType).toLowerCase()) &&
      Number(evidence?.proofByteSize) > 0 &&
      cleanText(evidence?.supabaseProjectId) &&
      cleanText(evidence?.migrationBackfillPolicy) &&
      cleanText(evidence?.activeHouseholdRlsPolicy) &&
      cleanText(evidence?.retentionPolicy) &&
      cleanText(evidence?.exportPolicy) &&
      cleanText(evidence?.deletionPolicy) &&
      cleanText(evidence?.dependencyBuildProof) &&
      cleanText(evidence?.mobileFullRefreshProof) &&
      evidence?.supabaseProjectApproved === true &&
      evidence?.migrationBackfillApproved === true &&
      evidence?.rlsApproved === true &&
      evidence?.retentionExportDeletionApproved === true &&
      evidence?.dependencyBuildApproved === true &&
      evidence?.mobileSignoffApproved === true &&
      evidence?.apolloApproved === true,
  );
}

function syncResource(name, description, containsPrivateData) {
  return { name, description, containsPrivateData, localFirst: true };
}

function recentEntries(state, types = null, limit = 10) {
  const entries = [...(state.entries || [])].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const filtered = types ? entries.filter((entry) => types.includes(entry.type)) : entries;
  return filtered.slice(0, limit);
}

function normalizeVariant(value) {
  const cleaned = cleanText(value).toLowerCase();
  return CARE_PASS_VARIANTS.some((variant) => variant.id === cleaned) ? cleaned : "sitter";
}

function normalizeRole(value) {
  const cleaned = cleanText(value).toLowerCase();
  return CAREGIVER_ROLES.some((role) => role.id === cleaned) ? cleaned : "caregiver";
}

function validDateString(value) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function addDays(value, days) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function stableFingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ww-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function resolvePetName(value) {
  const cleaned = cleanText(value);
  return !cleaned || cleaned.toLowerCase() === "my dog" ? "Phoenix" : cleaned;
}
