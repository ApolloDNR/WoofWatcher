import {
  buildCareRoomTransfer,
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

export const PRODUCT_NAVIGATION = [
  { id: "phoenix", label: "Phoenix" },
  { id: "log", label: "Log" },
  { id: "plans", label: "Plans" },
  { id: "health", label: "Health" },
  { id: "more", label: "More" }
];

export const QUICK_LOG_ACTIONS = [
  { type: "meal", label: "Meal", detailLevel: "optional" },
  { type: "treat", label: "Treat", detailLevel: "optional" },
  { type: "walk", label: "Walk", detailLevel: "optional" },
  { type: "potty", label: "Potty", detailLevel: "quick" },
  { type: "poop", label: "Poop", detailLevel: "quick" },
  { type: "pee", label: "Pee", detailLevel: "quick" },
  { type: "play", label: "Play", detailLevel: "quick" },
  { type: "training", label: "Training win", detailLevel: "optional" },
  { type: "social", label: "Social", detailLevel: "optional" },
  { type: "mood", label: "Mood", detailLevel: "optional" },
  { type: "alone", label: "Alone time", detailLevel: "optional" },
  { type: "vomit", label: "Bile note", detailLevel: "important" },
  { type: "medication", label: "Medication", detailLevel: "important" },
  { type: "weight", label: "Weight", detailLevel: "important" },
  { type: "note", label: "Note", detailLevel: "quick" }
];

const EVENT_DETAIL_FIELDS = {
  meal: ["food", "portionOffered", "portionEaten", "appetite", "mood", "note"],
  treat: ["treatType", "reason", "reaction", "amount", "note"],
  training: ["skill", "outcome", "moodBefore", "moodAfter", "durationMinutes", "note"],
  alone: ["durationMinutes", "moodBefore", "moodAfter", "aloneOutcome", "endedAt", "note"],
  vomit: ["severity", "appetite", "mood", "note"],
  weight: ["amount", "note"],
  medication: ["amount", "reaction", "note"],
  social: ["dogInteractions", "moodBefore", "moodAfter", "outcome", "note"],
  mood: ["moodBefore", "moodAfter", "reason", "note"]
};

export function buildProductViewModel(input = getDefaultState(), now = new Date().toISOString()) {
  const state = normalizeState(input, now);
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

  return {
    appName: "WoofWatcher",
    generatedAt: now,
    storageKey: "woofwatcher.v1.state",
    navigation: PRODUCT_NAVIGATION,
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
      boundary: "This is pattern support, not a diagnosis. Use it to decide what to track, what to share, and when Phoenix needs a veterinarian."
    },
    more: {
      dietProfile: state.dietProfile,
      caregivers: state.caregivers || [],
      handoff,
      records: state.records || [],
      calendar,
      trainingProgress,
      carePass,
      reportText,
      woofGuide: {
        status: "local-first",
        localAnswer: assistantContext.localAnswer,
        boundary: "WoofGuide can organize Phoenix's logs and caregiver notes. It does not diagnose, replace a veterinarian, or decide urgent care."
      }
    },
    uiGuidance: {
      visualStatus: "functional-placeholder",
      redesignInstruction:
        "Use this view model as the data contract. Replace the current CSS/HTML look freely, but keep localStorage, non-diagnostic health language, five-tab navigation, and Phoenix privacy boundaries intact.",
      preferredDirection: "premium playful storybook utility",
      avoid: ["publicly exposing private Phoenix details without consent", "diagnostic health claims", "removing backup/import/export"]
    }
  };
}

function buildCaregiverOptions(state) {
  const names = (state.caregivers || []).map((caregiver) => caregiver.name).filter(Boolean);
  return [...new Set([...names, "Both", "Unassigned"])];
}
