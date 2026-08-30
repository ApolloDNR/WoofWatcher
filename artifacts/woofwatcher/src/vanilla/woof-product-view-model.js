import {
  buildCareRoomTransfer,
  buildHomeIdentityCopy,
  buildReportText,
  getAssistantContext,
  getAvatarState,
  getBileWatch,
  getCareCalendar,
  getCaregiverHandoff,
  getDefaultState,
  getGoalReview,
  getHealthWatch,
  getHouseholdPulse,
  getMonthlySummary,
  getNotificationCenter,
  getReminderCenter,
  getTodayPlan,
  getTrainingProgress,
  normalizeState
} from "./woof-core.js";
import {
  buildCaregiverAccessModel,
  buildCloudSyncPlan,
  buildScopedCarePass,
  CARE_PASS_VARIANTS
} from "./woof-privacy-cloud.js";
import {
  buildHostedNudgePlan,
  buildReportArtifact,
  buildTalkToLogDraft,
  createAuditEvent
} from "./woof-operations.js";
import {
  buildBackendSchemaPlan,
  buildBackendSeedDraft
} from "./woof-backend-schema.js";

export const PRODUCT_NAVIGATION = [
  { id: "phoenix", label: "Home" },
  { id: "log", label: "Log" },
  { id: "plans", label: "Plans" },
  { id: "health", label: "Health" },
  { id: "more", label: "More" }
];

export const DESKTOP_NAVIGATION_GROUPS = [
  {
    label: "Care & Wellbeing",
    items: ["Phoenix Home", "Quick Log", "Household Pulse", "Plans", "Health Watch", "Bile Watch", "Diet & Treats"]
  },
  {
    label: "More Tools",
    items: ["Care Pass", "WoofGuide", "Avatar Studio"]
  },
  {
    label: "Records",
    items: ["Timeline", "Records", "Reports", "Achievements"]
  },
  {
    label: "System",
    items: ["Settings"]
  }
];

export const QUICK_LOG_ACTIONS = [
  { key: "meal", group: "Care", type: "meal", label: "Meal", detailLevel: "lifecycle" },
  { key: "treat", group: "Care", type: "treat", label: "Treat", detailLevel: "optional" },
  { key: "walk", group: "Care", type: "walk", label: "Walk", detailLevel: "optional" },
  { key: "potty", group: "Care", type: "potty", label: "Potty", detailLevel: "outcome-flow" },
  { key: "happy", group: "Mood & Behavior", type: "mood", label: "Happy", detailLevel: "quick" },
  { key: "anxious", group: "Mood & Behavior", type: "mood", label: "Anxious", detailLevel: "optional" },
  { key: "play", group: "Mood & Behavior", type: "play", label: "Play", detailLevel: "quick" },
  { key: "training-win", group: "Mood & Behavior", type: "training", label: "Training win", detailLevel: "optional" },
  { key: "vomit", group: "Health", type: "vomit", label: "Vomit", detailLevel: "important" },
  { key: "medication", group: "Health", type: "medication", label: "Medication", detailLevel: "important" },
  { key: "appetite", group: "Health", type: "health", label: "Appetite", detailLevel: "optional" },
  { key: "weight", group: "Health", type: "weight", label: "Weight", detailLevel: "important" },
  { key: "leaving-home", group: "Household", type: "alone", label: "Leaving Home", detailLevel: "important" },
  { key: "im-home", group: "Household", type: "alone", label: "I'm Home", detailLevel: "important" },
  { key: "note", group: "Household", type: "note", label: "Note", detailLevel: "quick" }
];

const EVENT_DETAIL_FIELDS = {
  meal: [
    "mealType",
    "servedAt",
    "servedBy",
    "food",
    "portionOffered",
    "outcome",
    "portionEaten",
    "outcomeAt",
    "outcomeBy",
    "appetite",
    "mood",
    "note",
    "photo",
    "trustState",
    "visibility"
  ],
  treat: ["treatType", "reason", "reaction", "amount", "note"],
  potty: ["pottyLocation", "pottyOutcome", "note", "photo", "trustState", "visibility"],
  training: ["skill", "outcome", "moodBefore", "moodAfter", "durationMinutes", "note"],
  alone: ["durationMinutes", "moodBefore", "moodAfter", "aloneOutcome", "endedAt", "note"],
  vomit: ["severity", "appetite", "mood", "note"],
  weight: ["amount", "note"],
  medication: ["amount", "reaction", "note"],
  social: ["dogInteractions", "moodBefore", "moodAfter", "outcome", "note"],
  mood: ["moodBefore", "moodAfter", "reason", "note"]
};

export function buildProductViewModel(input = getDefaultState(), now = new Date().toISOString()) {
  const normalizedState = normalizeState(input, now);
  const petName = buildHomeIdentityCopy(normalizedState).petName;
  const state = {
    ...normalizedState,
    profile: {
      ...normalizedState.profile,
      name: petName,
      publicLabel: petName
    }
  };
  const summary = getMonthlySummary(state, now);
  const plan = getTodayPlan(state, now);
  const reminders = getReminderCenter(state, now);
  const handoff = getCaregiverHandoff(state, now);
  const pulse = getHouseholdPulse(state, now);
  const avatar = getAvatarState(state, now);
  const health = getHealthWatch(state, now);
  const bileWatch = getBileWatch(state, now);
  const calendar = getCareCalendar(state, now);
  const goalReview = getGoalReview(state, now);
  const trainingProgress = getTrainingProgress(state, now);
  const assistantContext = getAssistantContext(state, "", now);
  const carePass = buildCareRoomTransfer(state, now);
  const reportText = buildReportText(state, now);
  const access = buildCaregiverAccessModel(state, now);
  const cloud = buildCloudSyncPlan(state, {}, now);
  const reportArtifact = buildReportArtifact(state, { format: "text" }, now);
  const hostedNudges = buildHostedNudgePlan(state, {}, now);
  const backendSchema = buildBackendSchemaPlan({}, now);
  const backendSeedDraft = buildBackendSeedDraft(state, {}, now);

  return {
    appName: "WoofWatcher",
    generatedAt: now,
    storageKey: "woofwatcher.v1.state",
    navigation: PRODUCT_NAVIGATION,
    desktopNavigationGroups: DESKTOP_NAVIGATION_GROUPS,
    phoenix: {
      profile: state.profile,
      avatar,
      pulse,
      summary,
      recentTimeline: (state.entries || []).slice(0, 8)
    },
    log: {
      title: "Effortless Log",
      quickActions: QUICK_LOG_ACTIONS,
      detailFieldsByType: EVENT_DETAIL_FIELDS,
      caregiverOptions: buildCaregiverOptions(state),
      recentEntries: (state.entries || []).slice(0, 20)
    },
    plans: {
      today: plan,
      reminders,
      routines: state.routines || [],
      goals: goalReview,
      notificationCenter: getNotificationCenter(state, now, {
        supported: false,
        permission: "unsupported"
      })
    },
    health: {
      watch: health,
      bileWatch,
      boundary: `This is pattern support, not a diagnosis. Use it to decide what to track, what to share, and when ${petName} needs a veterinarian.`
    },
    more: {
      dietProfile: state.dietProfile,
      caregivers: state.caregivers || [],
      handoff,
      records: state.records || [],
      calendar,
      trainingProgress,
      carePass,
      scopedCarePasses: {
        vet: buildScopedCarePass(state, { audience: "vet" }, now),
        sitter: buildScopedCarePass(state, { audience: "sitter" }, now),
        trainer: buildScopedCarePass(state, { audience: "trainer" }, now),
        emergency: buildScopedCarePass(state, { audience: "emergency" }, now),
        weekend: buildScopedCarePass(state, { audience: "weekend" }, now)
      },
      carePassVariants: CARE_PASS_VARIANTS,
      reportText,
      woofGuide: {
        status: "local-first",
        localAnswer: assistantContext.localAnswer,
        boundary: `WoofGuide can organize ${petName}'s logs and caregiver notes. It does not diagnose, replace a veterinarian, or decide urgent care.`
      }
    },
    access,
    cloud,
    operations: {
      reportArtifact,
      hostedNudges,
      talkToLogDraft: buildTalkToLogDraft("", { source: "product_contract", petName }, now),
      auditTrail: [
        createAuditEvent(
          {
            action: "sync_plan",
            resourceType: "household",
            resourceId: cloud.householdId || "local_only",
            actor: "system",
            summary: "Built WoofWatcher cloud sync readiness plan",
            privacyLevel: "system_private",
            metadata: {
              status: cloud.status,
              blockerCount: cloud.blockers.length
            }
          },
          now
        )
      ]
    },
    backend: {
      schema: backendSchema,
      seedDraft: backendSeedDraft,
      boundary:
        "Backend schema and seed drafts are planning contracts only until Apollo chooses auth, database, deployment, and privacy settings."
    },
    uiGuidance: {
      visualStatus: "v1.5-shell-in-progress",
      redesignInstruction:
        "Use this view model as the data contract. Replace the current CSS/HTML look freely, but keep localStorage, non-diagnostic health language, five-tab navigation, and Phoenix privacy boundaries intact.",
      preferredDirection: "Premium Neo-Retro Pixel Care",
      coreLine: "Real care. Pixel heart.",
      tagline: "Your dog's day, brought to life.",
      avoid: ["publicly exposing private Phoenix details without consent", "diagnostic health claims", "removing backup/import/export", "top-level pee/poop quick actions"]
    }
  };
}

function buildCaregiverOptions(state) {
  const names = (state.caregivers || []).map((caregiver) => caregiver.name).filter(Boolean);
  return [...new Set([...names, "Both", "Unassigned"])];
}
