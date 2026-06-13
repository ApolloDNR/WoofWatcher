import {
  buildCareRoomTransfer,
  buildReportText,
  createEntry,
  getAchievementReview,
  getBileWatch,
  getCareCalendar,
  getCaregiverHandoff,
  getAssistantContext,
  getAvatarState,
  getDefaultState,
  getGoalReview,
  getHealthWatch,
  getHouseholdPulse,
  getMonthlySummary,
  getNotificationCenter,
  getReminderCenter,
  getTrainingProgress,
  getTodayPlan,
  normalizeDietProfileInput,
  normalizeState,
  removeCaregiverProfile,
  removeGoal,
  removeRecord,
  removeRoutine,
  upsertCaregiverProfile,
  upsertGoal,
  upsertRecord,
  upsertRoutine
} from "./woof-core.js";
import {
  buildCloudSyncPlan,
  buildScopedCarePass,
  CARE_PASS_VARIANTS
} from "./woof-privacy-cloud.js";

import phoenixHappy from "../assets/phoenix/phoenix-happy.png";
import phoenixExcited from "../assets/phoenix/phoenix-excited.png";
import phoenixCalm from "../assets/phoenix/phoenix-calm.png";
import phoenixAnxious from "../assets/phoenix/phoenix-anxious.png";
import phoenixUnwell from "../assets/phoenix/phoenix-unwell.png";

const PHOENIX_ART = {
  happy: phoenixHappy,
  excited: phoenixExcited,
  calm: phoenixCalm,
  anxious: phoenixAnxious,
  unwell: phoenixUnwell,
};

function phoenixArt(mood) {
  if (["settled", "calm"].includes(mood)) return PHOENIX_ART.calm;
  if (["tummy-watch", "hungry-watch", "unwell", "sick"].includes(mood)) return PHOENIX_ART.unwell;
  if (["home-alone", "bored", "anxious", "nervous"].includes(mood)) return PHOENIX_ART.anxious;
  if (["excited", "playful", "zoomies"].includes(mood)) return PHOENIX_ART.excited;
  return PHOENIX_ART.happy;
}

const STORAGE_KEY = "woofwatcher.v1.state";
const NOTIFICATION_SENT_KEY = "woofwatcher.v1.lastNotificationKey";
const THEME_KEY = "woofwatcher.v1.theme";
const ENTRY_SELECT_OPTIONS = [
  "meal",
  "treat",
  "walk",
  "park",
  "potty",
  "play",
  "training",
  "social",
  "mood",
  "alone",
  "vomit",
  "health",
  "vet",
  "weight",
  "medication",
  "note"
];
const RECORD_TYPE_OPTIONS = ["vet", "vaccine", "weight", "instruction", "medication", "microchip"];
const PRIMARY_TABS = new Set([
  "phoenix",
  "log",
  "plans",
  "health",
  "more",
  "household-pulse",
  "diet-treats",
  "woofguide",
  "timeline",
  "records",
  "reports",
  "care-pass",
  "avatar-studio",
  "achievements",
  "settings"
]);
const TAB_ALIASES = {
  today: "phoenix",
  dashboard: "phoenix",
  home: "phoenix",
  reminders: "plans",
  schedule: "plans",
  goals: "plans",
  calendar: "more",
  progress: "more",
  team: "more",
  records: "records",
  report: "reports",
  reports: "reports",
  assistant: "woofguide",
  woofguide: "woofguide",
  guide: "woofguide",
  household: "household-pulse",
  pulse: "household-pulse",
  diet: "diet-treats",
  treats: "diet-treats",
  "diet-treats": "diet-treats",
  carepass: "care-pass",
  "care-pass": "care-pass",
  avatar: "avatar-studio",
  "avatar-studio": "avatar-studio",
  achievements: "achievements",
  settings: "settings",
  timeline: "timeline",
  bile: "health",
  "bile-watch": "health"
};

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  plans: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  log: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  health: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.9 14.3A8.6 8.6 0 0 1 9.7 3.1 8.6 8.6 0 1 0 20.9 14.3Z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  backup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  meal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h14a7 7 0 0 1-14 0Z"/><line x1="12" y1="4" x2="12" y2="7"/></svg>`,
  walk: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="14.5" r="3.4"/><circle cx="6.6" cy="10" r="1.5"/><circle cx="10" cy="7" r="1.5"/><circle cx="14" cy="7" r="1.5"/><circle cx="17.4" cy="10" r="1.5"/></svg>`,
  potty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z"/></svg>`,
  training: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14.5 8 22l4-2 4 2-1-7.5"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4Z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
};

const DESKTOP_NAV_GROUPS = [
  {
    label: "Care & Wellbeing",
    items: [
      { tab: "phoenix", label: "Phoenix Home", icon: ICONS.dashboard },
      { tab: "log", label: "Quick Log", icon: ICONS.log },
      { tab: "household-pulse", label: "Household Pulse", icon: ICONS.walk, secondary: true },
      { tab: "plans", label: "Plans", icon: ICONS.plans },
      { tab: "health", label: "Health Watch", icon: ICONS.health },
      { tab: "bile-watch", label: "Bile Watch", icon: ICONS.potty, secondary: true },
      { tab: "diet-treats", label: "Diet & Treats", icon: ICONS.meal, secondary: true }
    ]
  },
  {
    label: "More Tools",
    items: [
      { tab: "care-pass", label: "Care Pass", icon: ICONS.backup, secondary: true },
      { tab: "woofguide", label: "WoofGuide", icon: ICONS.spark, secondary: true },
      { tab: "avatar-studio", label: "Avatar Studio", icon: ICONS.dashboard, secondary: true }
    ]
  },
  {
    label: "Records",
    items: [
      { tab: "timeline", label: "Timeline", icon: ICONS.calendar, secondary: true },
      { tab: "records", label: "Records", icon: ICONS.health, secondary: true },
      { tab: "reports", label: "Reports", icon: ICONS.backup, secondary: true },
      { tab: "achievements", label: "Achievements", icon: ICONS.training, secondary: true }
    ]
  },
  {
    label: "System",
    items: [
      { tab: "settings", label: "Settings", icon: ICONS.more, secondary: true }
    ]
  }
];

const QUICK_LOG_GROUPS = [
  {
    label: "Care",
    actions: [
      { type: "meal", title: "Meal", glyph: "M" },
      { type: "treat", title: "Treat", glyph: "T" },
      { type: "walk", title: "Walk", glyph: "W" },
      { type: "potty", title: "Potty", glyph: "P" }
    ]
  },
  {
    label: "Mood & Behavior",
    actions: [
      { type: "mood", title: "Happy", glyph: "H" },
      { type: "mood", title: "Anxious", glyph: "A" },
      { type: "play", title: "Play", glyph: "Y" },
      { type: "training", title: "Training win", glyph: "T" }
    ]
  },
  {
    label: "Health",
    actions: [
      { type: "vomit", title: "Vomit", glyph: "V" },
      { type: "medication", title: "Medication", glyph: "Rx" },
      { type: "health", title: "Appetite", glyph: "Ap" },
      { type: "weight", title: "Weight", glyph: "Lb" }
    ]
  },
  {
    label: "Household",
    actions: [
      { type: "alone", title: "Leaving Home", glyph: "Out" },
      { type: "alone", title: "I'm Home", glyph: "In" },
      { type: "note", title: "Note", glyph: "N" }
    ]
  }
];
const SCOPED_CARE_PASS_AUDIENCES = ["vet", "sitter", "trainer", "emergency"];
const WOOFGUIDE_ACTIONS = [
  {
    id: "meal-draft",
    label: "Review meal log",
    detail: "Open the structured Meal flow so a human can confirm served and eaten amounts.",
    action: "woofguide-log-meal",
    cta: "Open meal draft"
  },
  {
    id: "care-pass",
    label: "Prepare Care Pass",
    detail: "Open report context for sitter, vet, trainer, or emergency sharing.",
    action: "woofguide-open-care-pass",
    cta: "Open Care Pass"
  },
  {
    id: "records",
    label: "Review records",
    detail: "Jump to vaccines, visits, insurance, microchip, and document readiness.",
    action: "woofguide-open-records",
    cta: "Open records"
  },
  {
    id: "vet-note",
    label: "Draft vet note",
    detail: "Create an owner-reviewed note from Phoenix's current pattern context.",
    action: "woofguide-draft-vet-note",
    cta: "Draft note"
  }
];
const AVATAR_STATES = [
  { id: "happy", label: "Happy", mood: "happy", motion: "happy tail wag", use: "Normal cheerful care state." },
  { id: "calm", label: "Calm", mood: "calm", motion: "soft idle", use: "Settled household baseline." },
  { id: "excited", label: "Excited", mood: "excited", motion: "excited bounce", use: "Play, greeting, and adventure moments." },
  { id: "sleepy", label: "Sleepy", mood: "settled", motion: "sleepy zzz", use: "Quiet hours and rest." },
  { id: "anxious", label: "Anxious", mood: "anxious", motion: "ears and glance", use: "Watchful or nervous context." },
  { id: "bored", label: "Bored", mood: "bored", motion: "attention nudge", use: "Needs enrichment or activity." },
  { id: "hungry", label: "Hungry", mood: "hungry-watch", motion: "bowl look", use: "Food gap or meal routine coming up." },
  { id: "proud", label: "Proud", mood: "playful", motion: "proud sparkle", use: "Training wins and progress moments." },
  { id: "home-alone", label: "Home Alone", mood: "home-alone", motion: "waiting idle", use: "Manual alone-time timer active." },
  { id: "not-feeling-well", label: "Not Feeling Well", mood: "sick", motion: "low posture", use: "Health Watch or Bile Watch review context." }
];
const ACHIEVEMENT_ROUTE_IDS = [
  "routine_streak",
  "training_consistency",
  "happy_tummy_week",
  "bedtime_snack_proof",
  "calm_alone_time",
  "records_complete"
];

let app;
let state;
let activeTab;
let theme = "light";
let logSearchQuery = "";
let activeQuickFlow = "";
let selectedCalendarDate;
let assistantAnswer = "";
let assistantBusy = false;
let assistantStatus = { checked: false, configured: false, mode: "local", model: "" };
let notificationPermission;

export function initApp(container) {
  app = container;
  state = loadState();
  theme = loadTheme();
  applyTheme(theme);
  const initialParams = new URLSearchParams(window.location.search);
  activeTab = normalizeTab(initialParams.get("tab"));
  logSearchQuery = String(initialParams.get("q") || "").trim();
  selectedCalendarDate = initialParams.get("date") || "";
  notificationPermission = getBrowserNotificationPermission();

  render();
  registerServiceWorker();
  checkAssistantStatus();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return getDefaultState();
  }
}

function saveState(nextState = state) {
  state = { ...nextState, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    return "light";
  }
  return "light";
}

function saveTheme(nextTheme) {
  theme = nextTheme === "dark" ? "dark" : "light";
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme persistence is optional; visual state still updates in memory.
  }
  applyTheme(theme);
}

function applyTheme(nextTheme) {
  const resolved = nextTheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.body.dataset.theme = resolved;
  if (app) app.dataset.theme = resolved;
}

function normalizeTab(tab) {
  const normalized = String(tab || "").trim().toLowerCase();
  if (PRIMARY_TABS.has(normalized)) return normalized;
  return TAB_ALIASES[normalized] || "phoenix";
}

function render() {
  const now = new Date().toISOString();
  const summary = getMonthlySummary(state);
  const plan = getTodayPlan(state);
  const handoff = getCaregiverHandoff(state);
  const pulse = getHouseholdPulse(state, now);
  const avatar = getAvatarState(state, now);
  const goalReview = getGoalReview(state);
  const achievementReview = getAchievementReview(state, now);
  const calendar = getCareCalendar(state);
  const trainingProgress = getTrainingProgress(state);
  const health = getHealthWatch(state);
  const bileWatch = getBileWatch(state, now);
  const reminders = getReminderCenter(state, now);
  const notifications = getNotificationCenter(state, now, {
    supported: isBrowserNotificationSupported(),
    permission: notificationPermission
  });

  const caregiverName = (state.caregivers && state.caregivers[0] && state.caregivers[0].name) || "there";
  const presenceLabel = getPresenceLabel(pulse, avatar, caregiverName);
  const clock = new Date();
  const hour = clock.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greetIcon = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";
  const dateLabel = clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  app.dataset.loading = "false";
  app.dataset.theme = theme;
  app.innerHTML = `
    <div class="app-layout">
      ${renderDesktopSidebar(caregiverName, presenceLabel)}

      <div class="main-area">
        <header class="dash-topbar">
          <div class="greeting-block">
            <h1 class="greeting">${greeting}, ${escapeHtml(caregiverName)}! <span>${greetIcon}</span></h1>
            <p class="greeting-sub">${escapeHtml(state.profile.name)} is ready for an adventure.</p>
          </div>
          <div class="top-right">
            <form class="top-search" data-form="top-search" role="search">
              <input name="q" value="${escapeAttribute(logSearchQuery)}" placeholder="Search logs, notes, care..." aria-label="Search care logs" />
              <button type="submit" aria-label="Search care logs">${ICONS.search}</button>
            </form>
            <button class="top-icon-btn" data-tab="plans" aria-label="Open reminders">
              ${ICONS.bell}
              ${reminders.dueCount || reminders.overdueCount ? `<span class="top-dot">${reminders.overdueCount + reminders.dueCount}</span>` : ""}
            </button>
            <button class="date-pill" data-tab="plans">${ICONS.calendar}${escapeHtml(dateLabel)}</button>
            <button class="top-icon-btn" data-action="toggle-theme" aria-label="Switch to ${theme === "dark" ? "light" : "dark"} mode" title="Switch theme">${theme === "dark" ? ICONS.sun : ICONS.moon}</button>
            <button class="profile-pill" data-tab="settings" aria-label="Open profile and settings">
              <span>${escapeHtml(caregiverName.charAt(0).toUpperCase())}</span>
              <strong>${escapeHtml(caregiverName)}</strong>
            </button>
          </div>
        </header>
        <main class="workspace">
          ${renderActiveTab(activeTab, { summary, plan, reminders, notifications, health, bileWatch, handoff, pulse, avatar, goalReview, achievementReview, calendar, trainingProgress })}
        </main>
      </div>
    </div>

    <nav class="bottom-nav" aria-label="WoofWatcher sections">
      ${renderNavButton("phoenix", "Home")}
      ${renderNavButton("log", "Log")}
      ${renderNavButton("plans", "Plans")}
      ${renderNavButton("health", "Health")}
      ${renderNavButton("more", "More")}
    </nav>
    <input class="visually-hidden" data-input="import-json" type="file" accept="application/json,.json" />
    <input class="visually-hidden" data-input="avatar-photo" type="file" accept="image/*" />
  `;

  bindEvents();
  maybeSendDueNotification(notifications);
}

function renderProfileCard(health, avatar) {
  return `
    <section class="panel profile-card">
      <div class="profile-heading">
        <div>
          <p class="micro">Care profile</p>
          <h2>${escapeHtml(state.profile.name)}</h2>
          <p>${escapeHtml(state.profile.breed)}</p>
        </div>
        <span class="status-chip ${health.status}">${escapeHtml(health.label)}</span>
      </div>
      ${renderPhoenixAvatar(avatar, "rail")}
      <p class="avatar-caption">${escapeHtml(avatar.speech)}</p>
      <p class="profile-note">${escapeHtml(state.profile.background)}</p>
      <dl class="mini-grid">
        <div>
          <dt>Current</dt>
          <dd>${state.profile.weight.current} ${escapeHtml(state.profile.weight.unit)}</dd>
        </div>
        <div>
          <dt>Goal</dt>
          <dd>${escapeHtml(state.profile.weight.goal)}</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderPhoenixAvatar(avatar, size = "hero") {
  const evidence = (avatar.evidence || []).slice(0, 2);
  return `
    <div class="phoenix-avatar-stage ${escapeAttribute(size)} mood-${escapeAttribute(avatar.mood)} urgency-${escapeAttribute(avatar.urgency)}" aria-label="Phoenix avatar state: ${escapeAttribute(avatar.mood)}">
      <div class="avatar-sky" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="phoenix-avatar" aria-hidden="true">
        <div class="avatar-ear left"></div>
        <div class="avatar-ear right"></div>
        <div class="avatar-head">
          <div class="avatar-brow left"></div>
          <div class="avatar-brow right"></div>
          <div class="avatar-eye left"></div>
          <div class="avatar-eye right"></div>
          <div class="avatar-muzzle">
            <span></span>
          </div>
          <div class="avatar-smile"></div>
        </div>
        <div class="avatar-bandana"></div>
      </div>
      ${
        size === "hero"
          ? `<div class="avatar-bubble">
              <strong>${escapeHtml(avatar.suggestedAction)}</strong>
              <p>${escapeHtml(avatar.speech)}</p>
              ${evidence.length ? `<small>${evidence.map(escapeHtml).join(" | ")}</small>` : ""}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderCareStats(summary) {
  return `
    <section class="panel stat-card">
      <p class="micro">${escapeHtml(summary.monthLabel)}</p>
      <div class="stat-row">
        ${renderStat("Meals", summary.meals)}
        ${renderStat("Walks", summary.walks)}
        ${renderStat("Training", summary.trainingSessions)}
      </div>
      <div class="stat-row">
        ${renderStat("Vomit", summary.vomitIncidents)}
        ${renderStat("Social", summary.socialSessions)}
        ${renderStat("Follow-ups", summary.followUps)}
      </div>
    </section>
  `;
}

function renderPulseRail(pulse, handoff) {
  return `
    <section class="panel handoff-card">
      <div class="section-heading">
        <div>
          <p class="micro">Household Pulse</p>
          <h3>${handoff.completedCount}/${handoff.totalCount} routines logged</h3>
        </div>
        <button class="button ghost" data-action="copy-handoff">Copy</button>
      </div>
      <p>${escapeHtml(pulse.summary)}</p>
      <article class="next-action-mini">
        <span>${escapeHtml(pulse.nextAction.time || "Today")}</span>
        <strong>${escapeHtml(pulse.nextAction.label)}</strong>
        <small>${escapeHtml(pulse.nextAction.owner || "Phoenix's humans")}</small>
      </article>
      <div class="button-row">
        <button class="button ghost" data-action="export-transfer">Care Pass</button>
      </div>
      <div class="handoff-list">
        ${handoff.caregiverLoad.map(renderCaregiverLoad).join("")}
      </div>
    </section>
  `;
}

function renderHouseholdPulseTab(context) {
  const activeAlone = getActiveAloneEntry();
  const status = getHouseholdPresenceStatus(activeAlone);
  return `
    <div class="dashboard-grid household-pulse-screen">
      <section class="panel span-2 household-status-panel">
        <div class="section-heading">
          <div>
            <p class="micro">Household Pulse</p>
            <h3>${escapeHtml(status.label)}</h3>
            <p>${escapeHtml(status.detail)}</p>
          </div>
          <span class="status-chip ${status.className}">${escapeHtml(status.statusLabel)}</span>
        </div>
        <div class="household-status-grid">
          ${renderStatusAnswer("Phoenix status", status.statusLabel)}
          ${renderStatusAnswer("Supervised by", status.supervisedBy)}
          ${renderStatusAnswer("Since", status.sinceLabel)}
          ${renderStatusAnswer("Timer", status.timerLabel)}
        </div>
        <div class="household-action-row">
          <button class="button primary" data-action="quick-leaving-home">Leaving Home</button>
          <button class="button ghost" data-action="focus-return-home">I'm Home</button>
        </div>
      </section>

      <section class="panel">
        <p class="micro">Manual state</p>
        <h3>Leaving Home</h3>
        <form class="household-flow-form" data-form="leaving-home">
          <label>
            <span>Who is leaving?</span>
            <select name="caregiver">${renderCaregiverOptionList()}</select>
          </label>
          <label>
            <span>Setup note</span>
            <input name="note" placeholder="Puzzle toy, water checked, lights on" />
          </label>
          <button class="button primary" type="submit" ${activeAlone ? "disabled" : ""}>Start alone timer</button>
        </form>
      </section>

      <section class="panel return-home-panel" id="return-home">
        <p class="micro">Return outcomes</p>
        <h3>I'm Home</h3>
        ${renderReturnHomeForm(activeAlone)}
      </section>

      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">People</p>
            <h3>Household visibility</h3>
          </div>
          <span class="status-chip steady">${context.pulse.humans.length} profiles</span>
        </div>
        <div class="pulse-human-list">
          ${context.pulse.humans.map(renderPulseHuman).join("")}
        </div>
      </section>

      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Recent household activity</p>
            <h3>${escapeHtml(context.pulse.nextAction.label)}</h3>
          </div>
          <span class="status-chip steady">${context.pulse.completedCount}/${context.pulse.totalCount} routine proof</span>
        </div>
        <div class="timeline-list compact">
          ${context.pulse.timeline.length ? context.pulse.timeline.map(renderPulseTimelineRow).join("") : `<p class="empty-state">No household activity logged today.</p>`}
        </div>
        <p class="notification-boundary">${escapeHtml(context.pulse.healthBoundary)}</p>
      </section>
    </div>
  `;
}

function renderCaregiverOptionList() {
  return getCaregiverOptions()
    .map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`)
    .join("");
}

function renderReturnHomeForm(activeAlone) {
  if (!activeAlone) {
    return `<p class="quick-flow-empty">No active alone timer. Use Leaving Home when Phoenix is actually home alone.</p>`;
  }
  return `
    <form class="household-flow-form" data-form="return-home">
      <input type="hidden" name="entryId" value="${escapeAttribute(activeAlone.id)}" />
      <label>
        <span>Who returned?</span>
        <select name="caregiver">${renderCaregiverOptionList()}</select>
      </label>
      <label>
        <span>How was Phoenix?</span>
        <select name="aloneOutcome">
          <option>Calm</option>
          <option>Excited</option>
          <option>Anxious</option>
          <option>Barking/whining</option>
          <option>Accident</option>
          <option>Vomit</option>
          <option>Destructive</option>
          <option>Unknown</option>
        </select>
      </label>
      <label>
        <span>Recovery minutes</span>
        <input name="recoveryMinutes" inputmode="numeric" placeholder="0" />
      </label>
      <label class="wide">
        <span>Return note</span>
        <textarea name="note" rows="3" placeholder="What you saw, what helped, and whether Phoenix settled."></textarea>
      </label>
      <button class="button primary wide" type="submit">Save return outcome</button>
    </form>
  `;
}

function renderPulseTimelineRow(item) {
  return `
    <article class="timeline-row compact">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <small>${escapeHtml(formatDateTime(item.occurredAt))}</small>
      </div>
      <p>${escapeHtml(item.detail || item.type)}</p>
    </article>
  `;
}

function getActiveAloneEntry() {
  return (state.entries || [])
    .filter((entry) => entry.type === "alone" && !entry.endedAt)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0] || null;
}

function getHouseholdPresenceStatus(activeAlone) {
  const name = state.profile?.name || "Phoenix";
  if (!activeAlone) {
    const human = (state.entries || []).find((entry) => entry.caregiver && entry.caregiver !== "Unassigned")?.caregiver || getCaregiverOptions()[0] || "household";
    return {
      label: `${name} is with ${human}`,
      detail: "Manual household state says Phoenix is supervised. Use Leaving Home when the last human leaves.",
      statusLabel: "With human",
      className: "steady",
      supervisedBy: human,
      sinceLabel: "Current",
      timerLabel: "No active timer"
    };
  }
  const started = new Date(activeAlone.occurredAt);
  const minutes = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
  const stale = !Number.isFinite(minutes) || minutes > 720;
  if (stale) {
    return {
      label: "Status unknown",
      detail: "The last alone timer is stale or unclear. Confirm who is home before relying on this state.",
      statusLabel: "Unknown",
      className: "review",
      supervisedBy: "Unknown",
      sinceLabel: activeAlone.occurredAt ? formatDateTime(activeAlone.occurredAt) : "Unknown",
      timerLabel: "Needs review"
    };
  }
  return {
    label: `${name} is home alone`,
    detail: `Alone timer started by ${activeAlone.caregiver || "Unassigned"}. Log the return outcome when someone comes home.`,
    statusLabel: "Home alone",
    className: "watch",
    supervisedBy: "Home alone",
    sinceLabel: formatDateTime(activeAlone.occurredAt),
    timerLabel: formatDuration(minutes)
  };
}

function formatDuration(minutes) {
  const whole = Math.max(0, Number(minutes) || 0);
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const remainder = whole % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function renderCaregiverLoad(caregiver) {
  return `
    <article>
      <span>${escapeHtml(caregiver.name)}</span>
      <strong>${caregiver.todayLogs}</strong>
      <small>${escapeHtml(caregiver.latestAction)}</small>
    </article>
  `;
}

function renderStat(label, value) {
  return `
    <div class="stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderGlyph(type) {
  const labels = {
    meal: "M",
    treat: "T",
    walk: "W",
    park: "P",
    potty: "P",
    poop: "P",
    pee: "P",
    play: "Y",
    training: "R",
    social: "S",
    mood: "O",
    alone: "A",
    vomit: "B",
    health: "H",
    vet: "V",
    weight: "L",
    medication: "Rx",
    note: "N"
  };
  return `<span class="care-glyph glyph-${escapeAttribute(type)}" aria-hidden="true">${escapeHtml(labels[type] || "N")}</span>`;
}

function renderTabHeader(tab) {
  const labels = {
    phoenix: ["Phoenix", "A shared care home that turns the next best action into one calm screen."],
    log: ["Effortless Log", "Tap fast, add detail only when it matters, and keep both humans aligned."],
    plans: ["Plans", "Meals, walks, bedtime snack, training, reminders, and goals in one routine lane."],
    health: ["Health Watch", "Pattern support for appetite, bile, weight, medication, and vet review."],
    more: ["More", "Diet Profile, Care Team, Records, Care Pass, and WoofGuide."]
  };
  const [title, body] = labels[tab] || labels.phoenix;
  return `
    <div class="surface-header">
      <div>
        <p class="micro">WoofWatcher</p>
        <h2>${title}</h2>
        <p>${body}</p>
      </div>
      <button class="button primary" data-tab="log">Add log</button>
    </div>
  `;
}

function renderActiveTab(tab, context) {
  if (tab === "log") return renderLogTab();
  if (tab === "plans") return renderPlansTab(context);
  if (tab === "health") return renderHealthTab(context.health, context.bileWatch);
  if (tab === "household-pulse") return renderHouseholdPulseTab(context);
  if (tab === "diet-treats") return renderDietTreatsTab(context);
  if (tab === "woofguide") return renderWoofGuideTab(context);
  if (tab === "timeline") return renderTimelineTab(context);
  if (tab === "records") return renderRecordsTab(context);
  if (tab === "reports") return renderReportsTab(context);
  if (tab === "care-pass") return renderCarePassTab(context);
  if (tab === "avatar-studio") return renderAvatarStudioTab(context);
  if (tab === "achievements") return renderAchievementsTab(context);
  if (tab === "settings") return renderSettingsTab(context);
  if (tab === "more") return renderMoreTab(context);
  return renderPhoenixTab(context);
}

function renderRemindersTab(reminders, notifications) {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">${escapeHtml(reminders.dateLabel)}</p>
            <h3>Reminder Center</h3>
            <p>${escapeHtml(reminders.message)}</p>
          </div>
          <span class="status-chip ${reminders.overdueCount ? "review" : reminders.dueCount ? "watch" : "steady"}">${reminders.overdueCount} overdue | ${reminders.dueCount} due</span>
        </div>
        <div class="reminder-summary-row">
          ${renderStat("Completed", reminders.completedCount)}
          ${renderStat("Due now", reminders.dueCount)}
          ${renderStat("Overdue", reminders.overdueCount)}
          ${renderStat("Upcoming", reminders.upcomingCount)}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">Care proof</p>
        <h3>${escapeHtml(reminders.nextReminder?.label || "Scheduled care covered")}</h3>
        <div class="reminder-list">
          ${reminders.items.map(renderReminderItem).join("")}
        </div>
      </section>
      <section class="panel">
        <p class="micro">Unscheduled</p>
        <h3>${reminders.unscheduledCount} flexible item${reminders.unscheduledCount === 1 ? "" : "s"}</h3>
        <p>Flexible reminders stay visible without being treated as missed care.</p>
      </section>
      <section class="panel">
        <p class="micro">Handoff</p>
        <h3>Log creates proof</h3>
        <p>Completing a reminder adds a normal care log with the routine label, owner, time, and note.</p>
      </section>
      ${renderNotificationPanel(notifications)}
    </div>
  `;
}

function renderNotificationPanel(notifications) {
  return `
    <section class="panel span-2 notification-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Phone alerts</p>
          <h3>Local notification readiness</h3>
          <p>${escapeHtml(notifications.message)}</p>
        </div>
        <span class="status-chip ${notificationStatusClass(notifications.status)}">${escapeHtml(notifications.statusLabel)}</span>
      </div>
      <div class="notification-actions">
        ${
          notifications.canRequestPermission
            ? `<button class="button primary" data-action="enable-notifications">Enable alerts</button>`
            : ""
        }
        ${
          notifications.canSendTest
            ? `<button class="button ghost" data-action="test-notification">Test alert</button>`
            : ""
        }
      </div>
      <p class="notification-boundary">${escapeHtml(notifications.deliveryBoundary)}</p>
    </section>
  `;
}

function renderReminderItem(item) {
  const canComplete = item.status !== "completed";
  const timing = item.completedAt
    ? `Completed by ${item.completedBy || "Unassigned"} at ${formatDateTime(item.completedAt)}`
    : renderReminderTiming(item);
  return `
    <article class="reminder-row ${escapeAttribute(item.status)}">
      <div class="reminder-status-dot" aria-hidden="true">${item.status === "completed" ? "OK" : ""}</div>
      <div>
        <div class="reminder-title-line">
          <h4>${escapeHtml(item.label)}</h4>
          <span class="status-chip ${reminderStatusClass(item.status)}">${escapeHtml(item.statusLabel)}</span>
        </div>
        <p>${escapeHtml(item.time)} | ${escapeHtml(item.owner)}</p>
        <small>${escapeHtml(timing)}</small>
        ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
      </div>
      ${
        canComplete
          ? `<button class="button ghost" data-action="complete-reminder" data-routine-id="${escapeAttribute(item.id)}">Log</button>`
          : ""
      }
    </article>
  `;
}

function renderReminderTiming(item) {
  if (item.status === "unscheduled") return "Flexible timing";
  if (item.minutesUntil === 0) return "Due now";
  if (item.minutesUntil > 0) return `${item.minutesUntil} minutes away`;
  return `${Math.abs(item.minutesUntil)} minutes past`;
}

function reminderStatusClass(status) {
  if (status === "completed" || status === "upcoming") return "steady";
  if (status === "due" || status === "unscheduled") return "watch";
  return "review";
}

function notificationStatusClass(status) {
  if (status === "enabled") return "steady";
  if (status === "ready_to_enable") return "watch";
  return "review";
}

function renderTeamTab(handoff) {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Shared care</p>
            <h3>Care team profiles</h3>
          </div>
          <span class="status-chip steady">${state.caregivers.length} active</span>
        </div>
        <div class="care-team-grid">
          ${state.caregivers.map((caregiver) => renderCaregiverEditor(caregiver, handoff)).join("")}
        </div>
      </section>
      <section class="panel">
        <p class="micro">Add caregiver</p>
        <h3>New care profile</h3>
        ${renderCaregiverForm()}
      </section>
      <section class="panel">
        <p class="micro">Coordination rule</p>
        <h3>Names carry care history</h3>
        <p>Renaming a caregiver updates matching logs and exact routine owners. Removing a caregiver keeps historical logs intact and moves exact routine ownership back to Either caregiver.</p>
      </section>
    </div>
  `;
}

function renderCaregiverEditor(caregiver, handoff) {
  const load = handoff.caregiverLoad.find((item) => item.name === caregiver.name);
  return `
    <article class="caregiver-editor-card">
      <div class="caregiver-card-heading">
        <div>
          <p class="micro">${escapeHtml(caregiver.role)}</p>
          <h4>${escapeHtml(caregiver.name)}</h4>
          <small>${escapeHtml(load?.latestAction || "No logs today")}</small>
        </div>
        <strong>${load?.todayLogs || 0}</strong>
      </div>
      ${renderCaregiverForm(caregiver)}
    </article>
  `;
}

function renderCaregiverForm(caregiver = {}) {
  const isExisting = Boolean(caregiver.name);
  return `
    <form class="caregiver-form" data-form="caregiver">
      <input type="hidden" name="previousName" value="${escapeAttribute(caregiver.name || "")}" />
      <label>
        <span>Name</span>
        <input name="name" value="${escapeAttribute(caregiver.name || "")}" placeholder="Apollo, Maya, sitter" />
      </label>
      <label>
        <span>Role</span>
        <input name="role" value="${escapeAttribute(caregiver.role || "")}" placeholder="Primary caregiver, evening caregiver" />
      </label>
      <div class="routine-form-actions wide">
        <button class="button primary" type="submit">${isExisting ? "Save caregiver" : "Add caregiver"}</button>
        ${
          isExisting
            ? `<button class="button ghost" type="button" data-action="remove-caregiver" data-caregiver-name="${escapeAttribute(caregiver.name)}">Remove</button>`
            : ""
        }
      </div>
    </form>
  `;
}

function renderGoalsTab(goalReview) {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Goal review</p>
            <h3>${goalReview.activeGoals}/${goalReview.totalGoals} active goals</h3>
          </div>
          <span class="status-chip steady">Milestones</span>
        </div>
        <div class="goal-highlight-grid">
          ${goalReview.highlights.map((highlight) => `<p>${escapeHtml(highlight)}</p>`).join("")}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">Phoenix goals</p>
        <h3>Weight, training, social, anxiety, health</h3>
        <div class="goal-list">
          ${goalReview.goals.map(renderGoalEditor).join("")}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">Add goal</p>
        <h3>New milestone</h3>
        ${renderGoalForm()}
      </section>
    </div>
  `;
}

function renderGoalEditor(goal) {
  return `
    <article class="goal-card">
      ${renderGoalForm(goal)}
    </article>
  `;
}

function renderGoalForm(goal = {}) {
  const categories = ["weight", "training", "anxiety", "social", "health", "custom"];
  const statuses = ["active", "paused", "done"];
  const categoryOptions = categories.map((category) => `<option value="${category}" ${goal.category === category ? "selected" : ""}>${titleCase(category)}</option>`).join("");
  const statusOptions = statuses.map((status) => `<option value="${status}" ${goal.status === status ? "selected" : ""}>${titleCase(status)}</option>`).join("");
  const isExisting = Boolean(goal.id);

  return `
    <form class="goal-form" data-form="goal">
      <input type="hidden" name="id" value="${escapeAttribute(goal.id || "")}" />
      <label>
        <span>Goal</span>
        <input name="title" value="${escapeAttribute(goal.title || "")}" placeholder="Steady weight gain, calm greetings" />
      </label>
      <label>
        <span>Category</span>
        <select name="category">${categoryOptions}</select>
      </label>
      <label>
        <span>Status</span>
        <select name="status">${statusOptions}</select>
      </label>
      <label>
        <span>Due</span>
        <input name="due" value="${escapeAttribute(goal.due || "")}" placeholder="Weekly, monthly, 2026-07-01" />
      </label>
      <label class="wide">
        <span>Target</span>
        <input name="target" value="${escapeAttribute(goal.target || "")}" placeholder="What progress should look like" />
      </label>
      <label class="wide">
        <span>Notes</span>
        <textarea name="note" rows="3" placeholder="What helped, what needs work, and what to watch.">${escapeHtml(goal.note || "")}</textarea>
      </label>
      <div class="routine-form-actions wide">
        <button class="button primary" type="submit">${isExisting ? "Save goal" : "Add goal"}</button>
        ${
          isExisting
            ? `<button class="button ghost" type="button" data-action="remove-goal" data-goal-id="${escapeAttribute(goal.id)}">Remove</button>`
            : ""
        }
      </div>
    </form>
  `;
}

function renderCalendarTab(calendar) {
  const selectedDay = getSelectedCalendarDay(calendar);
  const leadingBlanks = Array.from({ length: calendar.firstWeekday }, (_, index) => `<span class="calendar-blank" aria-hidden="true" data-blank="${index}"></span>`);
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Care calendar</p>
            <h3>${escapeHtml(calendar.monthLabel)}</h3>
          </div>
          <span class="status-chip ${calendar.reviewDays ? "watch" : "steady"}">${calendar.reviewDays} review days</span>
        </div>
        <div class="calendar-summary-row">
          ${renderStat("Logged days", calendar.activeDays)}
          ${renderStat("Total logs", calendar.monthTotals.totalEntries)}
          ${renderStat("Vomit days", calendar.vomitDays)}
        </div>
        <div class="care-calendar-grid" aria-label="${escapeAttribute(calendar.monthLabel)} care calendar">
          ${calendar.weekdays.map((day) => `<span class="calendar-weekday">${escapeHtml(day)}</span>`).join("")}
          ${leadingBlanks.join("")}
          ${calendar.days.map((day) => renderCalendarDay(day, selectedDay?.dateKey)).join("")}
        </div>
      </section>
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Selected day</p>
            <h3>${escapeHtml(selectedDay ? formatLongDate(selectedDay.dateKey) : "No day selected")}</h3>
          </div>
          <span class="status-chip ${selectedDay?.status === "review" ? "review" : selectedDay?.status === "active" ? "steady" : "watch"}">${escapeHtml(selectedDay?.summary || "No logs")}</span>
        </div>
        ${selectedDay ? renderSelectedDay(selectedDay) : `<p class="empty">Choose a day on the calendar.</p>`}
      </section>
    </div>
  `;
}

function renderProgressTab(progress) {
  const statusClass = progress.status === "Steady" ? "steady" : progress.status === "Building" ? "watch" : "review";
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Training progress</p>
            <h3>${escapeHtml(progress.monthLabel)}</h3>
          </div>
          <span class="status-chip ${statusClass}">${escapeHtml(progress.status)}</span>
        </div>
        <div class="stat-row">
          ${renderStat("Sessions", progress.training.sessions)}
          ${renderStat("Minutes", progress.training.minutes)}
          ${renderStat("Social sessions", progress.social.sessions)}
          ${renderStat("Dog interactions", progress.social.dogInteractions)}
        </div>
        <div class="progress-signal-grid">
          <article>
            <span>Calm signals</span>
            <strong>${progress.calmSignals}</strong>
            <p>Settled, neutral, engaged, relaxed, or confident moments.</p>
          </article>
          <article>
            <span>Struggle signals</span>
            <strong>${progress.struggleSignals}</strong>
            <p>Anxiety, barking, pulling, tension, reactivity, or overwhelm.</p>
          </article>
        </div>
      </section>
      <section class="panel">
        <p class="micro">Wins</p>
        <h3>What improved</h3>
        <div class="signal-list">
          ${progress.wins.map((win) => `<p>${escapeHtml(win)}</p>`).join("")}
        </div>
      </section>
      <section class="panel">
        <p class="micro">Focus</p>
        <h3>What to keep working on</h3>
        <div class="signal-list">
          ${progress.focusAreas.map((focus) => `<p>${escapeHtml(focus)}</p>`).join("")}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">Evidence</p>
        <h3>Recent training and social logs</h3>
        ${renderTimeline(progress.recentEntries)}
      </section>
    </div>
  `;
}

function renderCalendarDay(day, selectedDateKey) {
  const classes = ["calendar-day-cell", day.status];
  if (day.isToday) classes.push("today");
  if (day.dateKey === selectedDateKey) classes.push("selected");
  return `
    <button class="${classes.join(" ")}" data-calendar-date="${escapeAttribute(day.dateKey)}" title="${escapeAttribute(day.summary)}">
      <span class="calendar-day-number">${day.day}</span>
      <strong>${day.totalEntries || ""}</strong>
      ${renderCalendarMarkers(day.counts)}
    </button>
  `;
}

function renderCalendarMarkers(counts) {
  const markers = [
    counts.meals ? ["meal", "M"] : null,
    counts.walks ? ["walk", "W"] : null,
    counts.training ? ["training", "T"] : null,
    counts.parkVisits || counts.social ? ["social", "S"] : null,
    counts.vomit ? ["vomit", "V"] : null,
    counts.health || counts.vet || counts.medication || counts.weight ? ["health", "H"] : null
  ].filter(Boolean);
  if (!markers.length) return `<span class="calendar-markers empty-markers"></span>`;
  return `<span class="calendar-markers">${markers.map(([type, label]) => `<i class="${type}">${label}</i>`).join("")}</span>`;
}

function renderSelectedDay(day) {
  return `
    <div class="selected-day-grid">
      <div class="calendar-summary-row">
        ${renderStat("Meals", day.counts.meals)}
        ${renderStat("Walks", day.counts.walks)}
        ${renderStat("Training", day.counts.training)}
      </div>
      <div class="calendar-summary-row">
        ${renderStat("Social", day.counts.parkVisits + day.counts.social)}
        ${renderStat("Vomit", day.counts.vomit)}
        ${renderStat("Follow-ups", day.counts.followUps)}
      </div>
      ${renderTimeline(day.entries)}
    </div>
  `;
}

function renderScheduleTab() {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Care planner</p>
            <h3>Editable daily routine</h3>
          </div>
          <span class="status-chip steady">${state.routines.length} items</span>
        </div>
        <div class="routine-editor-list">
          ${state.routines.map(renderRoutineEditor).join("")}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">Add routine</p>
        <h3>New care item</h3>
        ${renderRoutineForm()}
      </section>
    </div>
  `;
}

function renderRoutineEditor(routine) {
  return `
    <article class="routine-editor-card">
      ${renderRoutineForm(routine)}
    </article>
  `;
}

function renderRoutineForm(routine = {}) {
  const typeOptions = [...ENTRY_SELECT_OPTIONS]
    .map((type) => `<option value="${type}" ${routine.type === type ? "selected" : ""}>${titleCase(type)}</option>`)
    .join("");
  const isExisting = Boolean(routine.id);

  return `
    <form class="routine-form" data-form="routine">
      <input type="hidden" name="id" value="${escapeAttribute(routine.id || "")}" />
      <label>
        <span>Routine</span>
        <input name="label" value="${escapeAttribute(routine.label || "")}" placeholder="Breakfast, medication, bedtime snack" />
      </label>
      <label>
        <span>Type</span>
        <select name="type">${typeOptions}</select>
      </label>
      <label>
        <span>Time</span>
        <input name="time" value="${escapeAttribute(routine.time || "")}" placeholder="7:30 AM" />
      </label>
      <label>
        <span>Owner</span>
        <input name="owner" value="${escapeAttribute(routine.owner || "")}" placeholder="Apollo, Girlfriend, Either caregiver" />
      </label>
      <label class="wide">
        <span>Care note</span>
        <textarea name="note" rows="3" placeholder="What the other caregiver should know.">${escapeHtml(routine.note || "")}</textarea>
      </label>
      <div class="routine-form-actions wide">
        <button class="button primary" type="submit">${isExisting ? "Save routine" : "Add routine"}</button>
        ${
          isExisting
            ? `<button class="button ghost" type="button" data-action="remove-routine" data-routine-id="${escapeAttribute(routine.id)}">Remove</button>`
            : ""
        }
      </div>
    </form>
  `;
}

function renderPhoenixTab(context) {
  const { avatar, pulse, summary, health, bileWatch, reminders } = context;
  const nextReminder = reminders.nextReminder || pulse.nextAction || {};
  const mood = moodInfo(avatar.mood);
  const energy = energyPct(health.status);
  const recent = (state.entries || []).slice(0, 4);
  const caregiverName = (state.caregivers && state.caregivers[0] && state.caregivers[0].name) || "friend";
  const presenceLabel = getPresenceLabel(pulse, avatar, caregiverName);
  const openMeal = getOpenMealOutcomeTask();
  const roomCopy = buildPhoenixRoomCopy({ avatar, pulse, health, bileWatch, openMeal });

  return `
    <div class="dash">
      <div class="dash-col">
        <section class="card hero">
          <div class="dog-scene ${dogMoodClass(avatar.mood)}">
            ${renderDogScene(avatar.mood)}
            <span class="hero-name">${escapeHtml(state.profile.name)}</span>
            <span class="hero-speech">${escapeHtml(roomCopy.speech)}</span>
            <span class="hero-mood">${mood.emoji} ${escapeHtml(mood.label)}</span>
          </div>
          <div class="hero-body">
            <div class="energy">
              <div class="energy-top"><span>Energy</span><strong>${energy}%</strong></div>
              <div class="energy-track"><i style="width:${energy}%"></i></div>
            </div>
            <p class="hero-quote">${escapeHtml(roomCopy.detail)}</p>
          </div>
          <div class="hero-next">
            <div>
              <span>Next up</span>
              <strong>${escapeHtml(nextReminder.label || "Routine covered")} · ${escapeHtml(nextReminder.time || "Today")}</strong>
            </div>
            <button class="button" data-tab="plans">View</button>
          </div>
        </section>

        ${renderPhoenixStatusCard({ presenceLabel, mood, nextReminder, avatar, openMeal })}

        <section class="card">
          <div class="card-head"><h3>Quick Log</h3></div>
          <div class="quick-grid">
            ${renderQuickButton("meal", "Meal", "M")}
            ${renderQuickButton("walk", "Walk", "W")}
            ${renderQuickButton("potty", "Potty", "P")}
            ${renderQuickButton("medication", "Meds", "Rx")}
            ${renderQuickButton("vomit", "Symptoms", "V")}
            ${renderQuickButton("training", "Training", "T")}
          </div>
        </section>
      </div>

      <div class="dash-col">
        <section class="card">
          <div class="card-head"><h3>Today's Care</h3><button class="card-link" data-tab="plans">View full day</button></div>
          <div class="care-grid">
            ${renderCareTile("Meals", summary.meals, ICONS.meal)}
            ${renderCareTile("Walks", summary.walks, ICONS.walk)}
            ${renderCareTile("Potty", summary.potty, ICONS.potty)}
            ${renderCareTile("Training", summary.trainingSessions, ICONS.training)}
            ${renderCareTile("Logs", summary.totalEntries, ICONS.log)}
            ${renderCareTile("Health", health.label, ICONS.health)}
          </div>
        </section>

        ${renderHomeHouseholdPulseCard({ pulse, avatar, presenceLabel })}

        <section class="card">
          <div class="card-head"><h3>Handoff Timeline</h3><button class="card-link" data-tab="more">View all</button></div>
          <ul class="timeline-feed">
            ${recent.length ? recent.map(renderHandoffRow).join("") : `<li class="timeline-empty">No care logged yet today.</li>`}
          </ul>
        </section>
      </div>

      <div class="dash-col">
        <section class="card assistant-card">
          <div class="assist-head">${ICONS.spark}<h3>Woof Assistant</h3></div>
          <p class="assist-msg">You're doing great, ${escapeHtml(caregiverName)}! ${escapeHtml(state.profile.name)} is one lucky pup.</p>
          <div class="assist-suggestions">
            ${renderAssistChip("Try a puzzle toy", "For mental stimulation")}
            ${renderAssistChip("Hydration check", "Fresh water top-up")}
            ${renderAssistChip("Evening fun", "Keep the routine going")}
          </div>
          <button class="assist-ask" data-tab="assistant"><span>Ask Woof Assistant</span>${ICONS.send}</button>
        </section>

        ${renderHomeHealthBileSnapshot({ health, bileWatch, summary, energy })}
      </div>
    </div>
  `;
}

function buildPhoenixRoomCopy({ avatar, pulse, health, bileWatch, openMeal }) {
  if (openMeal) {
    return {
      speech: `${openMeal.title} is waiting for an outcome.`,
      detail: "A meal was served. Confirm whether Phoenix ate all, ate some, refused, or is still grazing so the household record stays accurate."
    };
  }

  if (avatar.mood === "home-alone") {
    return {
      speech: "Phoenix is home alone. Timer is active.",
      detail: "The room is in watch mode until someone returns and logs how Phoenix did."
    };
  }

  if (health.status === "review" || bileWatch.status === "review") {
    return {
      speech: "Pattern noticed. Review calmly.",
      detail: "Health Watch or Bile Watch has enough evidence to review timing, appetite, energy, and notes before deciding what to share with a veterinarian."
    };
  }

  if (pulse.completedCount < pulse.totalCount) {
    return {
      speech: `${pulse.nextAction.label || "Next care"} is next.`,
      detail: `Phoenix has ${pulse.completedCount}/${pulse.totalCount} routine items covered. Keep the next step simple and log what actually happens.`
    };
  }

  return {
    speech: avatar.suggestedAction || "Care rhythm looks steady.",
    detail: avatar.speech || "Phoenix's day is covered. Keep using quick logs for meals, walks, potty, mood, and notes."
  };
}

function renderPhoenixStatusCard({ presenceLabel, mood, nextReminder, avatar, openMeal }) {
  return `
    <section class="card phoenix-status-card">
      <div class="card-head">
        <h3>Phoenix Status</h3>
        <span class="pill ${escapeAttribute(avatar.urgency || "steady")}">${escapeHtml(mood.label)}</span>
      </div>
      <div class="status-answer-grid">
        ${renderStatusAnswer("Where", presenceLabel)}
        ${renderStatusAnswer("Alone", avatar.mood === "home-alone" ? "Yes - timer active" : "No")}
        ${renderStatusAnswer("Feels", mood.label)}
        ${renderStatusAnswer("Next", `${nextReminder.label || "Routine covered"} | ${nextReminder.time || "Today"}`)}
      </div>
      ${
        openMeal
          ? renderOpenMealTask(openMeal)
          : `<p class="status-steady-note">No open meal outcomes. Care proof is current.</p>`
      }
    </section>
  `;
}

function renderHomeHouseholdPulseCard({ pulse, avatar, presenceLabel }) {
  const activeHuman = (pulse.humans || []).find((human) => human.todayLogs > 0);
  const status = avatar.mood === "home-alone" ? "home-alone" : activeHuman ? "with-human" : "unknown";
  const supervisedBy = avatar.mood === "home-alone" ? "Home alone" : activeHuman?.name || "Confirm status";
  return `
    <section class="card home-pulse-card">
      <div class="card-head">
        <h3>Where Phoenix is</h3>
        <span class="pill ${status === "home-alone" ? "watch" : status === "with-human" ? "good" : "neutral"}">${escapeHtml(status.replace("-", " "))}</span>
      </div>
      <p class="home-card-copy">${escapeHtml(presenceLabel)}</p>
      <div class="home-pulse-grid">
        ${renderStatusAnswer("Supervised by", supervisedBy)}
        ${renderStatusAnswer("Since", pulse.timeline[0] ? formatDateTime(pulse.timeline[0].occurredAt) : "Needs log")}
        ${renderStatusAnswer("Routine proof", `${pulse.completedCount}/${pulse.totalCount}`)}
        ${renderStatusAnswer("Next", pulse.nextAction?.label || "Routine covered")}
      </div>
      <button class="button ghost" data-tab="household-pulse">Open Household Pulse</button>
    </section>
  `;
}

function renderHomeHealthBileSnapshot({ health, bileWatch, summary, energy }) {
  const vomiting = summary.vomitIncidents > 0 ? String(summary.vomitIncidents) : "None";
  const weight = `${state.profile.weight.current} ${state.profile.weight.unit}`;
  return `
    <section class="card home-health-snapshot">
      <div class="card-head">
        <h3>Health/Bile snapshot</h3>
        <button class="card-link" data-tab="health">Review</button>
      </div>
      <div class="home-snapshot-status">
        <span class="pill ${escapeAttribute(health.status)}">Health ${escapeHtml(health.label)}</span>
        <span class="pill ${escapeAttribute(bileWatch.status)}">Bile ${escapeHtml(bileWatch.label)}</span>
      </div>
      <div class="health-list">
        ${renderHealthRow("Appetite", health.status === "review" ? "Watch" : "Good", health.status === "review" ? "watch" : "good")}
        ${renderHealthRow("Food gap", bileWatch.hoursSinceLastFood === null ? "No logs" : `${bileWatch.hoursSinceLastFood}h`, bileWatch.emptyStomachWindow ? "watch" : "good")}
        ${renderHealthRow("Bed snack", bileWatch.bedtimeSnackLogged ? "Logged" : "Missing", bileWatch.bedtimeSnackLogged ? "good" : "watch")}
        ${renderHealthRow("Vomiting", vomiting, summary.vomitIncidents > 0 ? "watch" : "good")}
        ${renderHealthRow("Energy", energy >= 70 ? "Good" : energy >= 50 ? "Fair" : "Low", energy >= 70 ? "good" : "watch")}
        ${renderHealthRow("Weight", weight, "neutral")}
      </div>
      <p class="notification-boundary">${escapeHtml(health.signals[0])} ${escapeHtml(bileWatch.vetBoundary)}</p>
    </section>
  `;
}

function renderStatusAnswer(label, value) {
  return `
    <article class="status-answer">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderOpenMealTask(meal) {
  return `
    <article class="open-meal-task">
      <div>
        <span>Open task</span>
        <strong>${escapeHtml(meal.title)} served. Outcome pending.</strong>
        <p>${escapeHtml(meal.detail)}</p>
      </div>
      <div class="open-meal-actions">
        <button class="button ghost" data-action="meal-outcome" data-entry-id="${escapeAttribute(meal.id)}" data-outcome="Ate all">Ate all</button>
        <button class="button ghost" data-action="meal-outcome" data-entry-id="${escapeAttribute(meal.id)}" data-outcome="Ate some">Ate some</button>
        <button class="button ghost" data-tab="log">Details</button>
      </div>
    </article>
  `;
}

function getOpenMealOutcomeTask() {
  const meals = (state.entries || [])
    .filter((entry) => entry.type === "meal")
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  return meals.find((entry) => {
    const outcome = String(entry.outcome || "").toLowerCase();
    const eaten = String(entry.portionEaten || "").trim();
    return outcome === "pending" || outcome === "still grazing" || (!outcome && !eaten);
  });
}

function renderDesktopSidebar(caregiverName, presenceLabel) {
  return `
    <aside class="sidebar">
      <div class="side-brand">
        <img src="/app-icon.svg" alt="" class="side-logo" />
        <span class="side-brand-text"><span class="woof">Woof</span> <span class="watcher">Watcher</span></span>
      </div>
      <nav class="side-nav" aria-label="WoofWatcher sections">
        ${DESKTOP_NAV_GROUPS.map(renderSideGroup).join("")}
      </nav>
      <div class="side-foot">
        <div class="side-user">
          <div class="side-user-avatar">${escapeHtml(caregiverName.charAt(0).toUpperCase())}</div>
          <div class="side-user-meta">
            <strong>${escapeHtml(caregiverName)}</strong>
            <span>Primary Caregiver</span>
          </div>
        </div>
        <p class="side-presence">${escapeHtml(presenceLabel)}</p>
        <button class="side-backup" data-action="export-json">${ICONS.backup}<span>Backup data</span></button>
      </div>
    </aside>
  `;
}

function renderSideGroup(group) {
  return `
    <section class="side-section">
      <p class="side-section-label">${escapeHtml(group.label)}</p>
      <div class="side-section-links">
        ${group.items.map(renderSideNav).join("")}
      </div>
    </section>
  `;
}

function renderSideNav(item) {
  const tab = item.tab;
  const normalized = normalizeTab(tab);
  const isActive = !item.secondary && activeTab === normalized;
  return `<button class="side-link ${item.secondary ? "secondary" : ""} ${isActive ? "active" : ""}"${isActive ? ' aria-current="page"' : ""} data-tab="${escapeAttribute(tab)}">${item.icon}<span>${escapeHtml(item.label)}</span></button>`;
}

function getPresenceLabel(pulse, avatar, caregiverName) {
  if (avatar?.mood === "home-alone") return `${state.profile.name} is home alone`;
  const activeHuman = (pulse?.humans || []).find((human) => human.todayLogs > 0);
  if (activeHuman?.name) return `${state.profile.name} is with ${activeHuman.name}`;
  if (caregiverName) return `${state.profile.name} is with ${caregiverName}`;
  return `${state.profile.name} status unknown`;
}

function dogMoodClass(mood) {
  if (["settled", "calm"].includes(mood)) return "m-calm";
  if (["tummy-watch", "hungry-watch"].includes(mood)) return "m-watch";
  if (["home-alone", "bored", "anxious"].includes(mood)) return "m-down";
  return "m-happy";
}

function renderDogScene(mood) {
  return `
    <img class="dog-art" src="${phoenixArt(mood)}" alt="Painted portrait of ${escapeAttribute(state.profile.name)} reflecting their current mood" />
  `;
}

function moodInfo(mood) {
  switch (mood) {
    case "settled": return { emoji: "😌", label: "Settled" };
    case "anxious": return { emoji: "😟", label: "Anxious" };
    case "tummy-watch": return { emoji: "🩺", label: "Tummy-Watch" };
    case "home-alone": return { emoji: "🏠", label: "Home Alone" };
    default: return { emoji: "😊", label: "Joyful" };
  }
}

function energyPct(status) {
  return status === "steady" ? 78 : status === "watch" ? 58 : 44;
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "Today";
  }
}

function renderCareTile(label, value, icon) {
  return `
    <article class="care-tile">
      <span class="care-ic">${icon}</span>
      <strong>${escapeHtml(value)}</strong>
      <span class="care-lbl">${escapeHtml(label)}</span>
    </article>
  `;
}

function renderHandoffRow(entry) {
  const who = entry.caregiver || "Caregiver";
  const time = entry.occurredAt ? fmtTime(entry.occurredAt) : "Today";
  const detail = entry.note ? `${entry.title || "Logged care"} · ${entry.note}` : (entry.title || "Logged care");
  return `
    <li class="tl-row">
      <span class="tl-avatar">${escapeHtml(who.charAt(0).toUpperCase())}</span>
      <div class="tl-body">
        <div class="tl-top"><strong>${escapeHtml(who)}</strong><span>${escapeHtml(time)}</span></div>
        <p>${escapeHtml(detail)}</p>
      </div>
    </li>
  `;
}

function renderAssistChip(title, sub) {
  return `
    <button class="assist-chip" data-tab="assistant">
      <span class="ac-dot"></span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></div>
    </button>
  `;
}

function renderHealthRow(label, value, tone) {
  return `
    <div class="health-row">
      <span>${escapeHtml(label)}</span>
      <strong class="tone-${escapeAttribute(tone)}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderPulseHuman(human) {
  return `
    <article>
      <span>${escapeHtml(human.name)}</span>
      <strong>${human.todayLogs}</strong>
      <small>${escapeHtml(human.latestAction)}</small>
    </article>
  `;
}

function renderMetricTile(label, value, glyphLabel) {
  return `
    <article class="panel" style="padding: 16px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
      <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--sage); color: var(--forest); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">${escapeHtml(glyphLabel)}</div>
      <strong style="font-size: 1.25rem;">${escapeHtml(value)}</strong>
      <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(label)}</span>
    </article>
  `;
}

function renderRoutine(routine, completed) {
  return `
    <article class="routine-row ${completed ? "complete" : ""}">
      <div class="check-dot" aria-hidden="true">${completed ? "OK" : ""}</div>
      <div>
        <h4>${escapeHtml(routine.label)}</h4>
        <p>${escapeHtml(routine.time)} | ${escapeHtml(routine.owner)}</p>
        <small>${escapeHtml(routine.note)}</small>
      </div>
      <button class="icon-button" title="Log ${escapeHtml(routine.label)}" data-quick-type="${escapeHtml(routine.type)}" data-quick-title="${escapeHtml(routine.label)}">+</button>
    </article>
  `;
}

function renderQuickButton(type, title, overrideGlyph) {
  const glyph = overrideGlyph || (type.charAt(0).toUpperCase());
  return `
    <button class="quick-btn" data-quick-type="${escapeAttribute(type)}" data-quick-title="${escapeAttribute(title)}">
      <div class="icon">${escapeHtml(glyph)}</div>
      <span>${escapeHtml(title)}</span>
    </button>
  `;
}

function renderQuickLogGroups() {
  return `
    <div class="quick-group-grid">
      ${QUICK_LOG_GROUPS.map((group) => `
        <section class="quick-group" aria-label="${escapeAttribute(group.label)} quick actions">
          <p class="quick-group-label">${escapeHtml(group.label)}</p>
          <div class="quick-group-actions">
            ${group.actions.map((action) => renderQuickButton(action.type, action.title, action.glyph)).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderQuickLogFlowPanel() {
  if (activeQuickFlow === "meal") return renderMealLifecycleFlow();
  if (activeQuickFlow === "potty") return renderPottyOutcomeFlow();
  return `
    <section class="quick-flow-panel idle" aria-live="polite">
      <p class="quick-group-label">Focused flow</p>
      <h4>Select Meal or Potty for guided details</h4>
      <p>Other quick actions still save immediately. Meal and Potty use structured flows so the household record stays clear.</p>
    </section>
  `;
}

function renderMealLifecycleFlow() {
  const caregiverOptions = getCaregiverOptions()
    .map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`)
    .join("");
  const openMeal = getOpenMealOutcomeTask();
  return `
    <section class="quick-flow-panel meal-flow" aria-live="polite">
      <div class="quick-flow-header">
        <div>
          <p class="quick-group-label">Meal lifecycle</p>
          <h4>Serve meal</h4>
        </div>
        <button class="card-link" data-action="clear-quick-flow">Close</button>
      </div>
      <form class="quick-flow-form" data-form="meal-lifecycle">
        <input type="hidden" name="mode" value="serve" />
        <label>
          <span>Meal</span>
          <select name="mealType">
            <option>Breakfast</option>
            <option>Dinner</option>
            <option>Bedtime snack</option>
            <option>Snack</option>
          </select>
        </label>
        <label>
          <span>Served by</span>
          <select name="servedBy">${caregiverOptions}</select>
        </label>
        <label>
          <span>Food</span>
          <input name="food" value="${escapeAttribute(state.dietProfile?.primaryFood || "")}" placeholder="Kibble, topper, snack" />
        </label>
        <label>
          <span>Portion offered</span>
          <input name="portionOffered" value="${escapeAttribute(state.dietProfile?.normalPortion || "")}" placeholder="1 cup" />
        </label>
        <label class="wide">
          <span>Note</span>
          <textarea name="note" rows="2" placeholder="Any appetite context or setup note."></textarea>
        </label>
        <button class="button primary wide" type="submit">Serve meal</button>
      </form>
      <div class="quick-flow-divider"></div>
      <div class="quick-flow-header">
        <div>
          <p class="quick-group-label">Outcome</p>
          <h4>Update open meal</h4>
        </div>
        <span class="status-chip ${openMeal ? "watch" : "steady"}">${openMeal ? "Pending" : "Current"}</span>
      </div>
      ${
        openMeal
          ? `
            <form class="quick-flow-form" data-form="meal-lifecycle">
              <input type="hidden" name="mode" value="update" />
              <input type="hidden" name="entryId" value="${escapeAttribute(openMeal.id)}" />
              <label>
                <span>Outcome</span>
                <select name="outcome">
                  <option>Ate all</option>
                  <option>Ate most</option>
                  <option>Ate some</option>
                  <option>Refused</option>
                  <option>Still grazing</option>
                </select>
              </label>
              <label>
                <span>Eaten amount</span>
                <input name="portionEaten" placeholder="All, half, a few bites" />
              </label>
              <label>
                <span>Updated by</span>
                <select name="outcomeBy">${caregiverOptions}</select>
              </label>
              <label class="wide">
                <span>Note</span>
                <textarea name="note" rows="2" placeholder="Any appetite detail."></textarea>
              </label>
              <button class="button primary wide" type="submit">Update open meal</button>
            </form>
          `
          : `<p class="quick-flow-empty">No meal is waiting for an outcome.</p>`
      }
    </section>
  `;
}

function renderPottyOutcomeFlow() {
  const caregiverOptions = getCaregiverOptions()
    .map((name) => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`)
    .join("");
  return `
    <section class="quick-flow-panel potty-flow" aria-live="polite">
      <div class="quick-flow-header">
        <div>
          <p class="quick-group-label">Potty flow</p>
          <h4>Potty is the parent action</h4>
        </div>
        <button class="card-link" data-action="clear-quick-flow">Close</button>
      </div>
      <form class="quick-flow-form" data-form="potty-outcome">
        <label>
          <span>Where?</span>
          <select name="pottyLocation">
            <option>Outside</option>
            <option>Inside</option>
          </select>
        </label>
        <label>
          <span>What happened?</span>
          <select name="pottyOutcome">
            <option>Pee</option>
            <option>Poop</option>
            <option>Both</option>
            <option>Tried, nothing</option>
            <option>Accident</option>
          </select>
        </label>
        <label>
          <span>Caregiver</span>
          <select name="caregiver">${caregiverOptions}</select>
        </label>
        <label class="wide">
          <span>Notes</span>
          <textarea name="note" rows="3" placeholder="Stool, accident, urgency, or anything the household should know."></textarea>
        </label>
        <button class="button primary wide" type="submit">Save Log</button>
      </form>
    </section>
  `;
}

function renderLogTab() {
  const visibleEntries = getVisibleLogEntries();
  const searchNote = logSearchQuery
    ? `<div class="search-result-note"><span>Showing ${visibleEntries.length} result${visibleEntries.length === 1 ? "" : "s"} for "${escapeHtml(logSearchQuery)}"</span><button class="card-link" data-action="clear-log-search">Clear</button></div>`
    : "";
  return `
    <div class="dashboard-grid log-screen">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Effortless Log</p>
            <h3>Quick Log v2</h3>
            <p>Grouped actions keep fast care simple while detailed fields preserve household proof.</p>
          </div>
          <span class="status-chip steady">Local-first</span>
        </div>
        ${renderQuickLogGroups()}
        ${renderQuickLogFlowPanel()}
      </section>
      <section class="panel span-2">
        <p class="micro">New care event</p>
        <h3>Log Phoenix's care</h3>
        ${renderEntryForm()}
      </section>
      <section class="panel span-2">
        <p class="micro">Recent entries</p>
        <h3>Latest household proof</h3>
        ${searchNote}
        ${renderTimeline(visibleEntries)}
      </section>
    </div>
  `;
}

function getVisibleLogEntries() {
  const entries = state.entries || [];
  const query = logSearchQuery.trim().toLowerCase();
  if (!query) return entries.slice(0, 12);
  return entries.filter((entry) => entryMatchesSearch(entry, query)).slice(0, 20);
}

function entryMatchesSearch(entry, query) {
  const values = [
    entry.type,
    entry.title,
    entry.caregiver,
    entry.note,
    entry.food,
    entry.portionOffered,
    entry.portionEaten,
    entry.appetite,
    entry.treatType,
    entry.reason,
    entry.reaction,
    entry.skill,
    entry.outcome,
    entry.moodBefore,
    entry.mood,
    entry.moodAfter,
    entry.aloneOutcome,
    entry.mealType,
    entry.servedBy,
    entry.outcomeBy,
    entry.pottyLocation,
    entry.pottyOutcome,
    entry.trustState,
    entry.visibility
  ];
  return values.join(" ").toLowerCase().includes(query);
}

function getQuickEntryDefaults(type, title, now) {
  if (type === "meal") {
    return {
      mealType: title,
      servedAt: now,
      servedBy: "Unassigned",
      portionOffered: state.dietProfile?.normalPortion || "",
      outcome: "Pending",
      trustState: "Confirmed",
      visibility: "Household",
      note: "Meal served. Outcome pending."
    };
  }
  if (type === "potty") {
    return {
      pottyLocation: "",
      pottyOutcome: "",
      trustState: "Pending",
      visibility: "Household",
      note: "Potty break logged. Add pee/poop outcome when known."
    };
  }
  if (type === "alone") {
    const leaving = /leaving/i.test(title);
    return {
      trustState: leaving ? "Confirmed" : "Pending",
      visibility: "Household",
      note: leaving ? "Phoenix is home alone. Return outcome pending." : "Returned home. Add how Phoenix was."
    };
  }
  return {
    trustState: "Confirmed",
    visibility: "Household"
  };
}

function mergeNote(existing, addition) {
  const current = String(existing || "").trim();
  const next = String(addition || "").trim();
  if (!current) return next;
  if (!next || current.includes(next)) return current;
  return `${current} ${next}`;
}

function renderEntryForm(prefill = {}) {
  const caregiverOptions = getCaregiverOptions()
    .map((name) => `<option value="${escapeAttribute(name)}" ${prefill.caregiver === name ? "selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
  const typeOptions = [...ENTRY_SELECT_OPTIONS]
    .map((type) => `<option value="${type}" ${prefill.type === type ? "selected" : ""}>${titleCase(type)}</option>`)
    .join("");

  return `
    <form class="entry-form" data-form="entry">
      <label>
        <span>Type</span>
        <select name="type">${typeOptions}</select>
      </label>
      <label>
        <span>Title</span>
        <input name="title" value="${escapeAttribute(prefill.title || "")}" placeholder="Breakfast, dog park, yellow bile" />
      </label>
      <label>
        <span>Caregiver</span>
        <select name="caregiver">${caregiverOptions}</select>
      </label>
      <label>
        <span>When</span>
        <input name="occurredAt" type="datetime-local" value="${toDateTimeLocal(prefill.occurredAt || new Date().toISOString())}" />
      </label>
      <label>
        <span>Meal type</span>
        <input name="mealType" placeholder="Breakfast, dinner, bedtime snack" />
      </label>
      <label>
        <span>Served at</span>
        <input name="servedAt" type="datetime-local" />
      </label>
      <label>
        <span>Served by</span>
        <select name="servedBy">
          <option value="">Same as caregiver</option>
          ${caregiverOptions}
        </select>
      </label>
      <label>
        <span>Amount</span>
        <input name="amount" placeholder="1 cup, small snack, 56.2 lb" />
      </label>
      <label>
        <span>Food</span>
        <input name="food" placeholder="Kibble, topper, snack" />
      </label>
      <label>
        <span>Offered</span>
        <input name="portionOffered" placeholder="1 cup, half bowl" />
      </label>
      <label>
        <span>Eaten</span>
        <input name="portionEaten" placeholder="All, half, refused" />
      </label>
      <label>
        <span>Meal outcome</span>
        <select name="outcome">
          <option value="">Select outcome</option>
          <option value="Pending">Pending</option>
          <option value="Ate all">Ate all</option>
          <option value="Ate most">Ate most</option>
          <option value="Ate some">Ate some</option>
          <option value="Refused">Refused</option>
          <option value="Still grazing">Still grazing</option>
        </select>
      </label>
      <label>
        <span>Outcome at</span>
        <input name="outcomeAt" type="datetime-local" />
      </label>
      <label>
        <span>Outcome by</span>
        <select name="outcomeBy">
          <option value="">Same as caregiver</option>
          ${caregiverOptions}
        </select>
      </label>
      <label>
        <span>Appetite</span>
        <input name="appetite" placeholder="eager, picky, refused" />
      </label>
      <label>
        <span>Potty location</span>
        <select name="pottyLocation">
          <option value="">Not potty</option>
          <option value="Outside">Outside</option>
          <option value="Inside">Inside</option>
        </select>
      </label>
      <label>
        <span>Potty outcome</span>
        <select name="pottyOutcome">
          <option value="">Not potty</option>
          <option value="Pee">Pee</option>
          <option value="Poop">Poop</option>
          <option value="Both">Both</option>
          <option value="Tried, nothing">Tried, nothing</option>
          <option value="Accident">Accident</option>
        </select>
      </label>
      <label>
        <span>Minutes</span>
        <input name="durationMinutes" inputmode="numeric" placeholder="20" />
      </label>
      <label>
        <span>Dog interactions</span>
        <input name="dogInteractions" inputmode="numeric" placeholder="0" />
      </label>
      <label>
        <span>Treat details</span>
        <input name="treatType" placeholder="Puzzle toy, chew, training treat" />
      </label>
      <label>
        <span>Reason</span>
        <input name="reason" placeholder="Training, calm time, enrichment" />
      </label>
      <label>
        <span>Reaction</span>
        <input name="reaction" placeholder="calm, excited, anxious, ignored" />
      </label>
      <label>
        <span>Training win</span>
        <input name="skill" placeholder="Place, leash, greeting, recall" />
      </label>
      <label>
        <span>Outcome</span>
        <input name="outcome" placeholder="settled faster, pulled, barked, improved" />
      </label>
      <label>
        <span>Mood/appetite</span>
        <input name="mood" placeholder="settled, anxious, refused" />
      </label>
      <label>
        <span>Mood before</span>
        <input name="moodBefore" placeholder="anxious, excited, sleepy" />
      </label>
      <label>
        <span>Mood after</span>
        <input name="moodAfter" placeholder="calm, proud, tired" />
      </label>
      <label>
        <span>Alone outcome</span>
        <input name="aloneOutcome" placeholder="calm return, barking, damage, settled" />
      </label>
      <label>
        <span>Severity</span>
        <select name="severity">
          <option value="normal">Normal</option>
          <option value="watch">Watch</option>
          <option value="urgent">Urgent</option>
        </select>
      </label>
      <label>
        <span>Trust state</span>
        <select name="trustState">
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Estimated">Estimated</option>
          <option value="Corrected">Corrected</option>
        </select>
      </label>
      <label>
        <span>Visibility</span>
        <select name="visibility">
          <option value="Household">Household</option>
          <option value="Private">Private</option>
          <option value="Vet review">Vet review</option>
        </select>
      </label>
      <label class="wide">
        <span>Notes</span>
        <textarea name="note" rows="4" placeholder="What happened, what helped, and what the next caregiver should know."></textarea>
      </label>
      <button class="button primary wide" type="submit">Save care log</button>
    </form>
  `;
}

function renderPlansTab(context) {
  const { plan, reminders, notifications, goalReview } = context;
  const bedtimeRoutine = (state.routines || []).find((routine) => /bed|snack/i.test(`${routine.label} ${routine.note}`));
  return `
    <div class="dashboard-grid plans-screen">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">${escapeHtml(plan.dateLabel)}</p>
            <h3>Today plan</h3>
          </div>
          <span class="status-chip ${reminders.overdueCount ? "review" : reminders.dueCount ? "watch" : "steady"}">${reminders.completedCount}/${reminders.totalCount} logged</span>
        </div>
        <div class="routine-list">
          ${state.routines.map((routine) => renderRoutine(routine, plan.completedLabels.includes(routine.label))).join("")}
        </div>
      </section>

      <section class="panel">
        <p class="micro">Bedtime snack</p>
        <h3>${escapeHtml(bedtimeRoutine?.label || "Small bedtime snack")}</h3>
        <p>${escapeHtml(bedtimeRoutine?.note || state.dietProfile.bedtimeSnack)}</p>
        <small>${escapeHtml(bedtimeRoutine?.time || "Before sleep")} | ${escapeHtml(bedtimeRoutine?.owner || "Either caregiver")}</small>
      </section>

      <section class="panel">
        <p class="micro">Goals</p>
        <h3>${goalReview.activeGoals}/${goalReview.totalGoals} active milestones</h3>
        <div class="signal-list compact">
          ${goalReview.highlights.slice(0, 3).map((highlight) => `<p>${escapeHtml(highlight)}</p>`).join("")}
        </div>
      </section>

      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Reminder Center</p>
            <h3>${escapeHtml(reminders.message)}</h3>
          </div>
          <span class="status-chip ${reminders.overdueCount ? "review" : reminders.dueCount ? "watch" : "steady"}">${reminders.overdueCount} overdue | ${reminders.dueCount} due</span>
        </div>
        <div class="reminder-list">
          ${reminders.items.map(renderReminderItem).join("")}
        </div>
      </section>

      ${renderNotificationPanel(notifications)}

      <section class="panel span-2">
        <p class="micro">Routine editor</p>
        <h3>Meals, walks, snacks, training</h3>
        <div class="routine-editor-list compact">
          ${state.routines.map(renderRoutineEditor).join("")}
        </div>
        <div class="inline-add-panel">
          <p class="micro">Add routine</p>
          ${renderRoutineForm()}
        </div>
      </section>

      <section class="panel span-2">
        <p class="micro">Phoenix goals</p>
        <h3>Weight, training, social, anxiety, health</h3>
        <div class="goal-list compact">
          ${goalReview.goals.map(renderGoalEditor).join("")}
        </div>
        <div class="inline-add-panel">
          <p class="micro">Add goal</p>
          ${renderGoalForm()}
        </div>
      </section>
    </div>
  `;
}

function renderDietTreatsTab(context) {
  const review = getDietDayReview(context);
  return `
    <div class="dashboard-grid diet-treats-screen">
      <section class="panel span-2 diet-hero-panel">
        <div class="section-heading">
          <div>
            <p class="micro">Diet & Treats</p>
            <h3>Daily food proof for Phoenix</h3>
            <p>Meals, treats, water context, avoid notes, and appetite quirks stay connected to household logs and Care Pass exports.</p>
          </div>
          <span class="status-chip ${review.openMeal ? "watch" : "steady"}">${review.openMeal ? "Outcome pending" : "Care proof current"}</span>
        </div>
        <div class="button-row">
          <button class="button primary" data-action="open-diet-log-meal">Log Meal</button>
          <button class="button ghost" data-action="open-diet-log-treat">Log Treat</button>
          <button class="button ghost" data-action="edit-diet-profile">Edit Diet Profile</button>
        </div>
      </section>

      ${renderDietDailyProgress(review)}
      ${renderMealsTodayPanel(review)}
      ${renderTreatsTodayPanel(review)}
      ${renderHydrationContextPanel(review)}
      ${renderDietAvoidList(review)}
      ${renderDietProfilePanel()}
    </div>
  `;
}

function getDietDayReview(context = {}) {
  const entries = state.entries || [];
  const todayEntries = entries.filter((entry) => isSameLocalDay(entry.occurredAt));
  const meals = todayEntries
    .filter((entry) => entry.type === "meal")
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const treats = todayEntries
    .filter((entry) => entry.type === "treat")
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const water = todayEntries
    .filter((entry) => entry.type === "water" || /water|hydration/i.test(`${entry.title || ""} ${entry.note || ""}`))
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const mealRoutines = (state.routines || []).filter((routine) => {
    const text = `${routine.type || ""} ${routine.label || ""} ${routine.note || ""}`;
    return /meal|breakfast|dinner|snack|food/i.test(text);
  });
  const expectedMeals = Math.max(mealRoutines.length, 2);
  const eatenMeals = meals.filter((entry) => isMealOutcomeComplete(entry));
  const progressPercent = Math.min(100, Math.round((eatenMeals.length / expectedMeals) * 100));
  const openMeal = getOpenMealOutcomeTask();
  const bedtimeSnack = (state.routines || []).find((routine) => /bed|snack/i.test(`${routine.label || ""} ${routine.note || ""}`));
  return {
    profile: state.dietProfile || {},
    meals,
    treats,
    water,
    expectedMeals,
    eatenMeals,
    progressPercent,
    openMeal,
    bedtimeSnack,
    bileStatus: context.bileWatch?.level || context.bileWatch?.status || "Pattern watch",
    lastMeal: meals[0] || null
  };
}

function isMealOutcomeComplete(entry) {
  const text = `${entry.outcome || ""} ${entry.portionEaten || ""} ${entry.note || ""}`.toLowerCase();
  if (/pending|still grazing|refused|skipped|not eat/.test(text)) return false;
  return /ate|all|most|some|half|finished|complete/.test(text) || Boolean(entry.outcomeAt);
}

function isSameLocalDay(value, target = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function renderDietDailyProgress(review) {
  const currentFood = review.profile.primaryFood || "Food not set";
  const dailyTarget = `${review.expectedMeals} meal slot${review.expectedMeals === 1 ? "" : "s"}`;
  return `
    <section class="panel diet-progress-panel">
      <p class="micro">Daily target</p>
      <h3>${escapeHtml(currentFood)}</h3>
      <div class="diet-progress-track" style="--diet-progress: ${escapeAttribute(review.progressPercent)}%;">
        <span></span>
      </div>
      <div class="diet-progress-stats">
        ${renderStat("Target", dailyTarget)}
        ${renderStat("Eaten", `${review.eatenMeals.length}/${review.expectedMeals}`)}
        ${renderStat("Served", review.meals.length)}
      </div>
      <p>${review.openMeal ? "A meal is served and waiting for an outcome." : "No open meal outcome is waiting right now."}</p>
    </section>
  `;
}

function renderMealsTodayPanel(review) {
  return `
    <section class="panel diet-meals-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Meals today</p>
          <h3>${review.meals.length}/${review.expectedMeals} served</h3>
        </div>
        <button class="button ghost" data-action="open-diet-log-meal">Log Meal</button>
      </div>
      <div class="diet-log-list">
        ${review.meals.length ? review.meals.map(renderDietMealRow).join("") : `<p class="empty-state">No meals logged today. Use Log Meal when Phoenix is served.</p>`}
      </div>
    </section>
  `;
}

function renderDietMealRow(entry) {
  const pending = /pending|still grazing/i.test(`${entry.outcome || ""} ${entry.note || ""}`);
  return `
    <article class="diet-log-row ${pending ? "pending" : "complete"}">
      ${renderGlyph("meal")}
      <div>
        <strong>${escapeHtml(entry.mealType || entry.title || "Meal")}</strong>
        <small>${escapeHtml(formatDateTime(entry.occurredAt))} | ${escapeHtml(entry.servedBy || entry.caregiver || "Unassigned")}</small>
        <p>${escapeHtml(entry.portionOffered || "Portion not set")} offered | ${escapeHtml(entry.outcome || "Pending")}</p>
      </div>
      ${
        pending
          ? `<button class="button ghost" data-action="meal-outcome" data-entry-id="${escapeAttribute(entry.id)}" data-outcome="Ate all">Mark eaten</button>`
          : ""
      }
    </article>
  `;
}

function renderTreatsTodayPanel(review) {
  return `
    <section class="panel diet-treats-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Treats today</p>
          <h3>${review.treats.length} logged</h3>
        </div>
        <button class="button ghost" data-action="open-diet-log-treat">Log Treat</button>
      </div>
      <div class="diet-log-list">
        ${
          review.treats.length
            ? review.treats.map((entry) => renderDietSimpleRow(entry, "treat")).join("")
            : `<p class="empty-state">No treats logged today. Training treats and chews will show here.</p>`
        }
      </div>
      <p class="diet-note">${escapeHtml(review.profile.treatsAllowed || "Treat baseline not set yet.")}</p>
    </section>
  `;
}

function renderHydrationContextPanel(review) {
  const latest = review.water[0];
  const copy = latest
    ? `${review.water.length} water note${review.water.length === 1 ? "" : "s"} today. Last: ${formatDateTime(latest.occurredAt)}.`
    : "No water refill logged today. Add hydration detail from the Log screen when needed.";
  return `
    <section class="panel">
      <p class="micro">Water / hydration</p>
      <h3>${review.water.length ? "Water evidence logged" : "Needs water proof"}</h3>
      <p>${escapeHtml(copy)}</p>
      <small>Health wording stays non-diagnostic. Share changes with a vet when appetite, vomiting, stool, energy, or hydration concerns stack up.</small>
    </section>
  `;
}

function renderDietAvoidList(review) {
  const avoidItems = splitDietList(review.profile.avoid);
  const sensitivityItems = splitDietList(review.profile.sensitivities);
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="micro">Avoid list</p>
          <h3>Food boundaries</h3>
        </div>
        <button class="button ghost" data-action="edit-diet-profile">Edit</button>
      </div>
      <div class="diet-chip-list">
        ${
          [...avoidItems, ...sensitivityItems].length
            ? [...avoidItems, ...sensitivityItems].map((item) => `<span>${escapeHtml(item)}</span>`).join("")
            : `<span>Nothing listed yet</span>`
        }
      </div>
      <p>${escapeHtml(review.profile.appetiteQuirks || "Add picky eating, anxiety, or feeding setup notes here.")}</p>
    </section>
  `;
}

function renderDietSimpleRow(entry, glyphType) {
  return `
    <article class="diet-log-row">
      ${renderGlyph(glyphType)}
      <div>
        <strong>${escapeHtml(entry.treatType || entry.title || titleCase(entry.type))}</strong>
        <small>${escapeHtml(formatDateTime(entry.occurredAt))} | ${escapeHtml(entry.caregiver || "Unassigned")}</small>
        <p>${escapeHtml(entry.note || entry.reason || "Household-visible care proof.")}</p>
      </div>
    </article>
  `;
}

function splitDietList(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderTimelineTab() {
  const entries = [...(state.entries || [])].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  return `
    <div class="dashboard-grid timeline-screen">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Timeline</p>
            <h3>Full household care history</h3>
            <p>Every care event stays inspectable before deeper edit-history and server retention policies are added.</p>
          </div>
          <button class="button primary" data-tab="log">Add log</button>
        </div>
        ${renderTimeline(entries)}
      </section>
    </div>
  `;
}

function renderReportsTab(context) {
  const report = buildReportText(state);
  return `
    <div class="dashboard-grid reports-screen">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Reports</p>
            <h3>${escapeHtml(context.summary.monthLabel)} progress report</h3>
            <p>Monthly care context, progress memory, and export actions stay separate from raw records.</p>
          </div>
          <div class="button-row">
            <button class="button ghost" data-action="copy-report">Copy report</button>
            <button class="button primary" data-action="download-report">Download</button>
          </div>
        </div>
        <pre class="report-box">${escapeHtml(report)}</pre>
      </section>
      ${renderProgressMemoryPanel(context.calendar, context.trainingProgress)}
    </div>
  `;
}

function renderCarePassTab(context) {
  return `
    <div class="dashboard-grid care-pass-screen">
      ${renderCarePassPanel(context.summary)}
    </div>
  `;
}

function renderAvatarStudioTab(context) {
  const studio = state.avatarStudio || {};
  const selected = AVATAR_STATES.find((item) => item.id === studio.selectedState) || AVATAR_STATES[0];
  const previewAvatar = {
    ...context.avatar,
    mood: selected.mood,
    urgency: selected.id === "not-feeling-well" ? "review" : selected.id === "home-alone" ? "watch" : "steady",
    speech: `${selected.label} state selected for Phoenix.`,
    suggestedAction: selected.motion,
    evidence: [selected.use]
  };
  return `
    <div class="dashboard-grid avatar-studio-screen">
      <section class="panel span-2 avatar-studio-hero">
        <div class="section-heading">
          <div>
            <p class="micro">Avatar Studio</p>
            <h3>Bring Phoenix into the app</h3>
            <p>Prototype state inventory for future pixel sprite, Rive, Lottie, or Reanimated assets. Current mode uses local template states and optional uploaded reference photo memory.</p>
          </div>
          <span class="status-chip watch">Template mode</span>
        </div>
        <div class="avatar-studio-preview">
          <div>
            ${studio.sourceImage ? `<img class="avatar-reference-photo" src="${escapeAttribute(studio.sourceImage)}" alt="Uploaded Phoenix reference" />` : renderPhoenixAvatar(previewAvatar, "rail")}
          </div>
          <div>
            <p class="micro">Selected state</p>
            <h3>${escapeHtml(selected.label)}</h3>
            <p>${escapeHtml(selected.use)}</p>
            <small>Motion target: ${escapeHtml(selected.motion)}</small>
            <div class="button-row">
              <button class="button primary" data-action="avatar-upload-photo">Upload Photo</button>
              <button class="button ghost" data-action="set-avatar-state" data-avatar-state="${escapeAttribute(selected.id)}">Save State</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">State inventory</p>
            <h3>Required Phoenix states</h3>
          </div>
          <span class="status-chip steady">${AVATAR_STATES.length} states</span>
        </div>
        <div class="avatar-state-grid">
          ${AVATAR_STATES.map((item) => renderAvatarStateCard(item, selected.id)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderAvatarStateCard(item, selectedId) {
  const selected = item.id === selectedId;
  return `
    <button class="avatar-state-card ${selected ? "selected" : ""}" data-action="set-avatar-state" data-avatar-state="${escapeAttribute(item.id)}">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.motion)}</span>
      <small>${escapeHtml(item.use)}</small>
    </button>
  `;
}

function renderAchievementsTab(context) {
  const review = context.achievementReview || getAchievementReview(state);
  const achievements = review.achievements.filter((item) => ACHIEVEMENT_ROUTE_IDS.includes(item.id));
  const featured = review.featured || achievements[0];
  return `
    <div class="dashboard-grid achievements-screen">
      <section class="panel span-2 achievements-hero">
        <div class="section-heading">
          <div>
            <p class="micro">Achievements</p>
            <h3>Meaningful care milestones</h3>
            <p>Badges are earned from household-visible logs, records, and care consistency. No fake coins, no empty rewards.</p>
          </div>
          <span class="status-chip ${review.completedCount >= review.totalCount ? "steady" : "watch"}">${review.completedCount}/${review.totalCount} earned</span>
        </div>
        <div class="achievement-hero-grid">
          <article class="achievement-featured-card">
            <p class="micro">Featured</p>
            <h4>${escapeHtml(featured.title)}</h4>
            <p>${escapeHtml(featured.summary)}</p>
            <div class="achievement-progress-track" aria-label="${escapeAttribute(featured.title)} progress">
              <span style="width: ${featured.percent}%"></span>
            </div>
            <small>${escapeHtml(featured.evidence)}</small>
          </article>
          <div class="achievement-score-stack">
            ${renderStat("Score", `${review.score}%`)}
            ${renderStat("Week logs", review.evidence.weekLogs)}
            ${renderStat("Month logs", review.evidence.monthLogs)}
            ${renderStat("Humans", review.evidence.householdCaregivers)}
          </div>
        </div>
      </section>
      <section class="panel">
        <p class="micro">Next best milestone</p>
        <h3>${escapeHtml(achievements.find((item) => item.status !== "earned")?.title || "Care set is steady")}</h3>
        <p>${escapeHtml(achievements.find((item) => item.status !== "earned")?.summary || "Keep logging care normally and review Health Watch when patterns change.")}</p>
        <div class="button-row">
          <button class="button ghost" data-tab="log">Log care</button>
          <button class="button ghost" data-tab="records">Review records</button>
          <button class="button primary" data-tab="reports">Open reports</button>
        </div>
      </section>
      <section class="panel span-2 achievement-card-grid">
        ${achievements.map(renderAchievementCard).join("")}
      </section>
    </div>
  `;
}

function renderAchievementCard(achievement) {
  return `
    <article class="achievement-card ${escapeAttribute(achievement.status)}" data-achievement-id="${escapeAttribute(achievement.id)}">
      <div class="achievement-card-top">
        <div>
          <p class="micro">${escapeHtml(achievement.category)}</p>
          <h4>${escapeHtml(achievement.title)}</h4>
        </div>
        <span class="status-chip ${achievementStatusClass(achievement.status)}">${escapeHtml(achievement.statusLabel)}</span>
      </div>
      <p>${escapeHtml(achievement.summary)}</p>
      <div class="achievement-progress-track" aria-label="${escapeAttribute(achievement.title)} progress">
        <span style="width: ${achievement.percent}%"></span>
      </div>
      <div class="achievement-card-footer">
        <strong>${achievement.progress}/${achievement.target}</strong>
        <small>${escapeHtml(achievement.evidence)}</small>
      </div>
    </article>
  `;
}

function achievementStatusClass(status) {
  if (status === "earned") return "steady";
  if (status === "progress") return "watch";
  return "review";
}

function renderSettingsTab(context) {
  const syncPlan = buildCloudSyncPlan(state, { provider: "local-only" });
  return `
    <div class="dashboard-grid settings-screen">
      <section class="panel span-2 settings-hero">
        <div class="section-heading">
          <div>
            <p class="micro">Settings</p>
            <h3>Local-first care controls</h3>
            <p>Backup, restore, privacy, safety boundaries, provider readiness, and reset controls are kept together so the household can trust what is live.</p>
          </div>
          <span class="status-chip watch">local-only</span>
        </div>
        <div class="settings-metric-grid">
          ${renderStat("Logs", state.entries?.length || 0)}
          ${renderStat("Routines", state.routines?.length || 0)}
          ${renderStat("Records", state.records?.length || 0)}
          ${renderStat("Goals", state.goals?.length || 0)}
        </div>
      </section>
      ${renderSettingsBackupPanel()}
      ${renderSettingsSafetyPanel(context, syncPlan)}
      ${renderSettingsProviderPanel(syncPlan)}
    </div>
  `;
}

function renderSettingsBackupPanel() {
  return `
    <section class="panel span-2 settings-backup-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Backup and transfer</p>
          <h3>Move Phoenix data intentionally</h3>
          <p>Full backup is for the household. Care room transfer is for same-household device moves. Scoped Care Pass stays under Reports.</p>
        </div>
        <span class="status-chip steady">Local file</span>
      </div>
      <div class="settings-action-grid">
        <button class="button primary" data-action="export-json">Download full backup</button>
        <button class="button ghost" data-action="import-json">Import backup</button>
        <button class="button ghost" data-action="export-transfer">Download care room transfer</button>
        <button class="button ghost danger" data-action="reset-demo">Reset demo data</button>
      </div>
    </section>
  `;
}

function renderSettingsSafetyPanel(context, syncPlan) {
  const aiMode = assistantStatus.configured ? "Live OpenAI configured" : "Local WoofGuide fallback";
  const notificationLabel = context.notifications?.statusLabel || "Not checked";
  const items = [
    "No provider-backed sync is enabled in this PWA route yet.",
    "No external AI key is stored in client JavaScript.",
    "Health Watch and Bile Watch are pattern tracking, not veterinary diagnosis.",
    "Full backups include private household care data. Share only with trusted household members.",
    `Reminder delivery is ${notificationLabel.toLowerCase()} and still app-open unless a hosted provider is configured.`,
    `Cloud readiness is ${syncPlan.status.replace(/_/g, "-")}.`
  ];
  return `
    <section class="panel settings-safety-panel">
      <p class="micro">Safety</p>
      <h3>What is true right now</h3>
      <ul class="settings-safety-list">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      <p class="notification-boundary">WoofGuide mode: ${escapeHtml(aiMode)}. Serious symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, foreign-object concern, or not eating need veterinary care.</p>
    </section>
  `;
}

function renderSettingsProviderPanel(syncPlan) {
  return `
    <section class="panel settings-provider-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Provider readiness</p>
          <h3>${escapeHtml(syncPlan.backend.provider)} sync plan</h3>
        </div>
        <span class="status-chip ${syncPlan.blockers.length ? "watch" : "steady"}">${escapeHtml(syncPlan.status.replace(/_/g, "-"))}</span>
      </div>
      <div class="settings-resource-list">
        ${syncPlan.resources.slice(0, 6).map((resource) => `
          <article>
            <strong>${escapeHtml(resource.name)}</strong>
            <span>${escapeHtml(resource.description)}</span>
          </article>
        `).join("")}
      </div>
      <div class="settings-blocker-list">
        ${(syncPlan.blockers.length ? syncPlan.blockers : ["Provider-backed sync can be connected after auth, storage, and privacy policy are approved."]).map((blocker) => `<p>${escapeHtml(blocker)}</p>`).join("")}
      </div>
    </section>
  `;
}

function renderMoreTab(context) {
  return `
    <div class="dashboard-grid more-screen">
      ${renderMoreDirectoryPanel()}
      ${renderDietProfilePanel()}
      ${renderCarePassPanel(context.summary)}
      ${renderCareTeamPanel(context.handoff)}
      ${renderRecordsPanel()}
      ${renderProgressMemoryPanel(context.calendar, context.trainingProgress)}
      ${renderWoofGuidePanel()}
    </div>
  `;
}

function renderMoreDirectoryPanel() {
  const items = [
    { tab: "household-pulse", label: "Household Pulse", detail: "Who is home, whether Phoenix is alone, and return outcomes." },
    { tab: "diet-treats", label: "Diet & Treats", detail: "Food baseline, portions, treats, notes, and avoid list." },
    { tab: "records", label: "Records", detail: "Vaccines, visits, insurance, receipts, and dog ID." },
    { tab: "reports", label: "Reports", detail: "Care Pass exports and monthly progress." },
    { tab: "woofguide", label: "WoofGuide", detail: "Owner-reviewed assistant drafts and summaries." },
    { tab: "avatar-studio", label: "Avatar Studio", detail: "Pixel Phoenix states and future asset pipeline." },
    { tab: "achievements", label: "Achievements", detail: "Meaningful care milestones from real logs and records." },
    { tab: "settings", label: "Settings", detail: "Backup, import, privacy, safety, and provider readiness." }
  ];
  return `
    <section class="panel span-2 more-directory-panel">
      <div class="section-heading">
        <div>
          <p class="micro">More</p>
          <h3>Tools that connect care</h3>
        </div>
        <span class="status-chip steady">No dead ends</span>
      </div>
      <div class="more-directory-grid">
        ${items.map((item) => `
          <button class="more-directory-tile" data-tab="${escapeAttribute(item.tab)}">
            <strong>${escapeHtml(item.label)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function renderDietProfilePanel() {
  const profile = state.dietProfile || {};
  return `
    <section class="panel span-2 diet-profile-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Diet Profile</p>
          <h3>What helps Phoenix eat calmly</h3>
        </div>
        <span class="status-chip steady">Editable</span>
      </div>
      <div class="diet-profile-grid">
        ${renderDietFact("Food", profile.primaryFood)}
        ${renderDietFact("Portion", profile.normalPortion)}
        ${renderDietFact("Schedule", profile.mealSchedule)}
        ${renderDietFact("Bedtime", profile.bedtimeSnack)}
        ${renderDietFact("Avoid", profile.avoid)}
        ${renderDietFact("Quirk", profile.appetiteQuirks)}
      </div>
      <form class="diet-form" data-form="diet-profile">
        ${renderDietField("primaryFood", "Primary food", profile.primaryFood)}
        ${renderDietField("normalPortion", "Normal portion", profile.normalPortion)}
        ${renderDietField("mealSchedule", "Meal schedule", profile.mealSchedule)}
        ${renderDietField("toppers", "Toppers", profile.toppers)}
        ${renderDietField("supplements", "Supplements", profile.supplements)}
        ${renderDietField("bedtimeSnack", "Bedtime snack", profile.bedtimeSnack)}
        ${renderDietField("treatsAllowed", "Treats allowed", profile.treatsAllowed)}
        ${renderDietField("avoid", "Avoid", profile.avoid)}
        ${renderDietField("sensitivities", "Sensitivities", profile.sensitivities)}
        ${renderDietField("appetiteQuirks", "Appetite quirks", profile.appetiteQuirks)}
        ${renderDietField("vetNotes", "Vet notes", profile.vetNotes)}
        <button class="button primary wide" type="submit">Save Diet Profile</button>
      </form>
    </section>
  `;
}

function renderDietFact(label, value) {
  return `
    <article>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not set")}</strong>
    </article>
  `;
}

function renderDietField(name, label, value) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input name="${escapeAttribute(name)}" value="${escapeAttribute(value || "")}" />
    </label>
  `;
}

function renderCarePassPanel(summary) {
  const report = buildReportText(state);
  return `
    <section class="panel span-2 care-pass-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Care Pass</p>
          <h3>${escapeHtml(summary.monthLabel)} share package</h3>
        </div>
        <div class="button-row">
          <button class="button ghost" data-action="copy-report">Copy report</button>
          <button class="button ghost" data-action="download-report">Download</button>
          <button class="button ghost" data-action="export-transfer">Care Pass JSON</button>
          <button class="button primary" data-action="print-report">Print/PDF</button>
        </div>
      </div>
      <p>Care Pass packages Phoenix's care context for a caregiver, sitter, vet conversation, or monthly review.</p>
      ${renderScopedCarePassPanel()}
      <pre class="report-box compact">${escapeHtml(report)}</pre>
    </section>
  `;
}

function renderScopedCarePassPanel() {
  const audiences = CARE_PASS_VARIANTS.filter((variant) => SCOPED_CARE_PASS_AUDIENCES.includes(variant.id));
  return `
    <div class="scoped-care-pass-grid" aria-label="Scoped Care Pass exports">
      ${audiences.map((variant) => renderCarePassAudienceCard(variant)).join("")}
    </div>
  `;
}

function renderCarePassAudienceCard(variant) {
  const pass = buildScopedCarePass(state, { audience: variant.id });
  const sectionCount = Array.isArray(pass.sections) ? pass.sections.length : 0;
  return `
    <article class="care-pass-audience-card">
      <div>
        <p class="micro">${escapeHtml(variant.id)}</p>
        <h4>${escapeHtml(variant.label)}</h4>
        <p>${escapeHtml(getCarePassAudienceDescription(variant.id))}</p>
      </div>
      <small>${sectionCount} scoped sections | ${escapeHtml(pass.privacy?.privateData || "Scoped context")}</small>
      <div class="button-row">
        <button class="button ghost" data-action="copy-care-pass" data-care-pass-audience="${escapeAttribute(variant.id)}">Copy</button>
        <button class="button ghost" data-action="download-care-pass" data-care-pass-audience="${escapeAttribute(variant.id)}">Download</button>
      </div>
    </article>
  `;
}

function getCarePassAudienceDescription(audience) {
  if (audience === "vet") return "Health, diet, medications, vomiting, records, and recent concerns for veterinarian review.";
  if (audience === "trainer") return "Training wins, rough spots, triggers, social exposure, and focus areas.";
  if (audience === "emergency") return "Core ID, routines, diet, key records, health watch, and latest timeline.";
  return "Routine, food instructions, anxiety notes, walks, bedtime, and household handoff context.";
}

function buildScopedCarePassText(audience) {
  const pass = buildScopedCarePass(state, { audience });
  const lines = [
    `${pass.label} for ${pass.petName}`,
    `Created: ${formatDateTime(pass.createdAt)}`,
    pass.boundary,
    "",
    `Sections: ${(pass.sections || []).join(", ")}`,
    `Diet: ${pass.dietProfile?.primaryFood || "Not set"} | ${pass.dietProfile?.normalPortion || "Portion not set"}`,
    `Household: ${pass.householdPulse?.summary || "No household summary"}`,
    "",
    JSON.stringify(pass, null, 2)
  ];
  return lines.filter(Boolean).join("\n");
}

function renderCareTeamPanel(handoff) {
  return `
    <section class="panel span-2 care-team-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Care Team</p>
          <h3>Humans caring for Phoenix</h3>
        </div>
        <span class="status-chip steady">${state.caregivers.length} active</span>
      </div>
      <div class="care-team-grid">
        ${state.caregivers.map((caregiver) => renderCaregiverEditor(caregiver, handoff)).join("")}
      </div>
      <div class="inline-add-panel">
        <p class="micro">Add caregiver</p>
        ${renderCaregiverForm()}
      </div>
    </section>
  `;
}

function renderRecordsPanel() {
  return `
    <section class="panel span-2 records-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Records</p>
          <h3>Vaccines, vet notes, weight, instructions</h3>
        </div>
        <span class="status-chip steady">${state.records.length} stored</span>
      </div>
      <div class="record-list">
        ${state.records.map(renderRecord).join("")}
      </div>
      <div class="inline-add-panel">
        <p class="micro">Add record</p>
        <form class="record-form" data-form="record" data-record-mode="add">
          <label>
            <span>Type</span>
            <select name="type">
              ${renderRecordTypeOptions()}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Rabies vaccine, weight check" />
          </label>
          <label>
            <span>Due/date</span>
            <input name="due" placeholder="2026-06-20 or next visit" />
          </label>
          <label class="wide">
            <span>Note</span>
            <textarea name="note" rows="3" placeholder="Clinic, result, next step, or care instruction."></textarea>
          </label>
          <button class="button primary wide" type="submit">Save record</button>
        </form>
      </div>
    </section>
  `;
}

function renderProgressMemoryPanel(calendar, trainingProgress) {
  const selectedDay = getSelectedCalendarDay(calendar);
  return `
    <section class="panel span-2 memory-panel">
      <div class="section-heading">
        <div>
          <p class="micro">Memory</p>
          <h3>Patterns and milestones</h3>
        </div>
        <span class="status-chip ${calendar.reviewDays ? "watch" : "steady"}">${calendar.reviewDays} review days</span>
      </div>
      <div class="memory-grid">
        <article>
          <span>Care calendar</span>
          <strong>${escapeHtml(calendar.monthLabel)}</strong>
          ${renderMonthMap()}
        </article>
        <article>
          <span>Training progress</span>
          <strong>${escapeHtml(trainingProgress.status)}</strong>
          <p>${escapeHtml(trainingProgress.focusAreas[0] || "Keep logging short sessions and calm wins.")}</p>
        </article>
        <article>
          <span>Selected day</span>
          <strong>${escapeHtml(selectedDay ? formatLongDate(selectedDay.dateKey) : "Today")}</strong>
          <p>${escapeHtml(selectedDay?.summary || "Choose a calendar day after logs build up.")}</p>
        </article>
      </div>
    </section>
  `;
}

function renderWoofGuideTab(context) {
  return `
    <div class="dashboard-grid woofguide-screen">
      ${renderWoofGuidePanel(context)}
    </div>
  `;
}

function renderWoofGuidePanel() {
  const context = getAssistantContext(state, "");
  const answer = assistantAnswer || context.localAnswer;
  const liveReady = assistantStatus.configured;
  const chipLabel = assistantBusy ? "Reviewing" : liveReady ? "Live OpenAI" : "Local mode";
  const chipClass = assistantBusy ? "watch" : liveReady ? "steady" : "watch";
  return `
    <section class="panel span-2 woofguide-panel">
      <div class="section-heading">
        <div>
          <p class="micro">WoofGuide</p>
          <h3>Ask with Phoenix context</h3>
        </div>
        <span class="status-chip ${chipClass}">${chipLabel}</span>
      </div>
      <form class="assistant-form" data-form="assistant">
        <label>
          <span>Question</span>
          <textarea name="question" rows="4" placeholder="Phoenix threw up yellow again. What should we track before calling the vet?"></textarea>
        </label>
        <button class="button primary" type="submit">Review Phoenix context</button>
      </form>
      <div class="assistant-answer" aria-live="polite">
        <p>${escapeHtml(answer)}</p>
      </div>
      ${renderWoofGuideActionCards(context)}
      <p class="notification-boundary">WoofGuide can organize Phoenix's logs and caregiver notes. It does not diagnose, replace a veterinarian, or decide urgent care.</p>
    </section>
  `;
}

function renderWoofGuideActionCards(context) {
  const meal = WOOFGUIDE_ACTIONS.find((action) => action.id === "meal-draft");
  const carePass = WOOFGUIDE_ACTIONS.find((action) => action.id === "care-pass");
  const records = WOOFGUIDE_ACTIONS.find((action) => action.id === "records");
  const vetNote = WOOFGUIDE_ACTIONS.find((action) => action.id === "vet-note");
  return `
    <div class="woofguide-action-grid" aria-label="Owner-reviewed WoofGuide actions">
      ${renderWoofGuideActionCard(meal, "woofguide-log-meal")}
      ${renderWoofGuideActionCard(carePass, "woofguide-open-care-pass")}
      ${renderWoofGuideActionCard(records, "woofguide-open-records")}
      ${renderWoofGuideActionCard(vetNote, "woofguide-draft-vet-note", context.healthWatch?.status === "alert" ? "review" : "watch")}
    </div>
  `;
}

function renderWoofGuideActionCard(action, dataAction, tone = "steady") {
  if (!action) return "";
  return `
    <article class="woofguide-action-card">
      <div>
        <p class="micro">owner-reviewed</p>
        <h4>${escapeHtml(action.label)}</h4>
        <p>${escapeHtml(action.detail)}</p>
      </div>
      ${renderWoofGuideActionButton(dataAction, action.cta, tone)}
    </article>
  `;
}

function renderWoofGuideActionButton(dataAction, label, tone) {
  const buttonClass = tone === "review" ? "primary" : "ghost";
  if (dataAction === "woofguide-log-meal") {
    return `<button class="button ${buttonClass}" data-action="woofguide-log-meal">${escapeHtml(label)}</button>`;
  }
  if (dataAction === "woofguide-open-care-pass") {
    return `<button class="button ${buttonClass}" data-action="woofguide-open-care-pass">${escapeHtml(label)}</button>`;
  }
  if (dataAction === "woofguide-open-records") {
    return `<button class="button ${buttonClass}" data-action="woofguide-open-records">${escapeHtml(label)}</button>`;
  }
  return `<button class="button ${buttonClass}" data-action="woofguide-draft-vet-note">${escapeHtml(label)}</button>`;
}

function buildWoofGuideVetNoteDraft(context = getAssistantContext(state, "")) {
  const latest = context.latest || [];
  const healthSignals = context.healthWatch?.signals || [];
  const bileSignals = context.bileWatch?.signals || [];
  const petName = state.profile?.name || "Phoenix";
  const lines = [
    `${petName} vet note draft`,
    "",
    "Reason for review:",
    healthSignals[0] || "Owner is organizing recent care context for veterinarian review.",
    "",
    "Bile Watch:",
    bileSignals[0] || "No bile-watch signal available in local context.",
    "",
    "Recent owner-entered logs:",
    ...latest.map((entry) => `- ${formatDateTime(entry.occurredAt)} | ${entry.type} | ${entry.title} | ${entry.caregiver}${entry.note ? ` | ${entry.note}` : ""}`),
    "",
    "Questions to ask:",
    "- Is this pattern worth an appointment or continued tracking?",
    "- What details should we log next time?",
    "- Are food gaps, appetite, stool, hydration, or energy relevant here?",
    "",
    "Boundary: This is owner-entered pattern context for a veterinarian. It is not a diagnosis, treatment plan, or emergency triage."
  ];
  return lines.join("\n");
}

function renderHealthTab(health, bileWatch) {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Pattern status</p>
            <h3>${escapeHtml(health.label)}</h3>
          </div>
          <span class="status-chip ${health.status}">${escapeHtml(health.status)}</span>
        </div>
        <div class="signal-list">
          ${health.signals.map((signal) => `<p>${escapeHtml(signal)}</p>`).join("")}
        </div>
        <p class="notification-boundary">This is pattern support, not a diagnosis. Use it to decide what to track, what to share, and when Phoenix needs a veterinarian.</p>
      </section>
      <section class="panel alert-panel">
        <p class="micro">Vet boundary</p>
        <h3>Red flags</h3>
        <ul>
          ${health.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}
        </ul>
      </section>
      <section class="panel span-2 bile-watch-panel">
        <div class="section-heading">
          <div>
            <p class="micro">Bile Watch</p>
            <h3>Empty-stomach pattern</h3>
          </div>
          <span class="status-chip ${escapeAttribute(bileWatch.status)}">${escapeHtml(bileWatch.label)}</span>
        </div>
        <div class="bile-watch-grid">
          ${renderStat("Food gap", bileWatch.hoursSinceLastFood === null ? "No logs" : `${bileWatch.hoursSinceLastFood}h`)}
          ${renderStat("Bile logs", bileWatch.recentYellowBileCount)}
          ${renderStat("Bed snack", bileWatch.bedtimeSnackLogged ? "Logged" : "Missing")}
        </div>
        <div class="signal-list">
          ${bileWatch.signals.map((signal) => `<p>${escapeHtml(signal)}</p>`).join("")}
        </div>
        <ul class="action-list">
          ${bileWatch.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}
        </ul>
        <p class="notification-boundary">${escapeHtml(bileWatch.vetBoundary)}</p>
      </section>
      <section class="panel">
        <p class="micro">Health timeline</p>
        <h3>Vomit, vet, weight, medication</h3>
        ${renderTimeline(state.entries.filter((entry) => ["vomit", "health", "vet", "weight", "medication"].includes(entry.type)).slice(0, 12))}
      </section>
    </div>
  `;
}

function renderRecordsTab() {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <p class="micro">Care vault</p>
        <h3>Stored records</h3>
        <div class="record-list">
          ${state.records.map(renderRecord).join("")}
        </div>
      </section>
      <section class="panel">
        <p class="micro">Add record</p>
        <h3>Vet, vaccine, weight, instruction</h3>
        <form class="record-form" data-form="record" data-record-mode="add">
          <label>
            <span>Type</span>
            <select name="type">
              ${renderRecordTypeOptions()}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Rabies vaccine, weight check" />
          </label>
          <label>
            <span>Due/date</span>
            <input name="due" placeholder="2026-06-20 or next visit" />
          </label>
          <label>
            <span>Note</span>
            <textarea name="note" rows="4" placeholder="Clinic, result, next step, or care instruction."></textarea>
          </label>
          <button class="button primary" type="submit">Save record</button>
        </form>
      </section>
    </div>
  `;
}

function renderRecord(record) {
  return `
    <article class="record-row">
      <span>${escapeHtml(record.type)}</span>
      <form class="record-inline-form" data-form="record" data-record-mode="edit">
        <input type="hidden" name="id" value="${escapeAttribute(record.id)}" />
        <div class="record-fields">
          <label>
            <span>Type</span>
            <select name="type">
              ${renderRecordTypeOptions(record.type)}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input name="title" required value="${escapeAttribute(record.title)}" />
          </label>
          <label>
            <span>Due/date</span>
            <input name="due" value="${escapeAttribute(record.due || "")}" />
          </label>
          <label>
            <span>Note</span>
            <textarea name="note" rows="2">${escapeHtml(record.note || "")}</textarea>
          </label>
        </div>
        <div class="button-row">
          <button class="button ghost" type="submit">Save</button>
          <button class="button ghost danger" type="button" data-action="remove-record" data-record-id="${escapeAttribute(record.id)}">Remove</button>
        </div>
      </form>
    </article>
  `;
}

function renderRecordTypeOptions(selected = "instruction") {
  return RECORD_TYPE_OPTIONS.map((type) => `<option value="${escapeAttribute(type)}" ${type === selected ? "selected" : ""}>${escapeHtml(titleCase(type))}</option>`).join("");
}

function renderReportTab(summary) {
  const report = buildReportText(state);
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Export</p>
            <h3>${escapeHtml(summary.monthLabel)} care report</h3>
          </div>
          <div class="button-row">
            <button class="button ghost" data-action="copy-report">Copy</button>
            <button class="button ghost" data-action="download-report">Download</button>
            <button class="button ghost" data-action="export-transfer">Transfer</button>
            <button class="button primary" data-action="print-report">Print/PDF</button>
          </div>
        </div>
        <pre class="report-box">${escapeHtml(report)}</pre>
      </section>
      <section class="panel">
        <p class="micro">Month map</p>
        <h3>Care density</h3>
        ${renderMonthMap()}
      </section>
    </div>
  `;
}

function renderAssistantTab() {
  const context = getAssistantContext(state, "");
  const answer = assistantAnswer || context.localAnswer;
  const liveReady = assistantStatus.configured;
  const chipLabel = assistantBusy ? "Reviewing" : liveReady ? "Live OpenAI" : "Local mode";
  const chipClass = assistantBusy ? "watch" : liveReady ? "steady" : "watch";
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">AI-ready care helper</p>
            <h3>Ask with Phoenix context</h3>
          </div>
          <span class="status-chip ${chipClass}">${chipLabel}</span>
        </div>
        <form class="assistant-form" data-form="assistant">
          <label>
            <span>Question</span>
            <textarea name="question" rows="4" placeholder="Phoenix threw up yellow again. What should we track before calling the vet?"></textarea>
          </label>
          <button class="button primary" type="submit">Review Phoenix context</button>
        </form>
        <div class="assistant-answer" aria-live="polite">
          <p>${escapeHtml(answer)}</p>
        </div>
      </section>
      <section class="panel">
        <p class="micro">OpenAI status</p>
        <h3>${liveReady ? "Credential found" : "Credential approval needed"}</h3>
        <p>${
          liveReady
            ? `The server reports OpenAI is configured${assistantStatus.model ? ` with ${escapeHtml(assistantStatus.model)}` : ""}. Questions use the live helper first and keep local review as fallback.`
            : "No API key is approved or stored here. WoofWatcher is using deterministic local care review until OPENAI_API_KEY is configured on the server or Vercel."
        }</p>
      </section>
    </div>
  `;
}

function renderTimeline(entries) {
  if (!entries.length) return `<p class="empty">No matching logs yet.</p>`;
  return `
    <div class="timeline">
      ${[...entries]
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .map(
          (entry) => `
          <article class="timeline-item ${entry.requiresFollowUp ? "follow-up" : ""}">
            <div class="timeline-avatar">${escapeHtml(entry.caregiver.charAt(0) || "U")}</div>
            <div class="timeline-content">
              <div class="timeline-header">
                <strong>${escapeHtml(titleCase(entry.type))}: ${escapeHtml(entry.title)}</strong>
                <span>${escapeHtml(formatDateTime(entry.occurredAt))}</span>
              </div>
              <div class="timeline-body">
                ${entry.note ? escapeHtml(entry.note) : "Logged by " + escapeHtml(entry.caregiver)}
              </div>
            </div>
          </article>
        `
        )
        .join("")}
    </div>
  `;
}

function renderMonthMap() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const count = state.entries.filter((entry) => {
      const date = new Date(entry.occurredAt);
      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
    }).length;
    const level = count >= 4 ? "high" : count >= 2 ? "mid" : count === 1 ? "low" : "";
    return `<span class="${level}" title="${count} logs on day ${day}">${day}</span>`;
  });
  return `<div class="month-map" aria-label="Monthly care density">${cells.join("")}</div>`;
}

function renderNavButton(tab, label) {
  const isActive = activeTab === tab;
  return `<button class="${isActive ? "active" : ""}"${isActive ? ' aria-current="page"' : ""} data-tab="${escapeAttribute(tab)}"><span>${escapeHtml(label)}</span></button>`;
}

function bindEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = normalizeTab(button.dataset.tab);
      if (activeTab !== "log") activeQuickFlow = "";
      const params = new URLSearchParams({ tab: activeTab });
      history.replaceState(null, "", `?${params.toString()}`);
      render();
    });
  });

  app.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCalendarDate = button.dataset.calendarDate;
      activeTab = "more";
      history.replaceState(null, "", `?tab=more&date=${encodeURIComponent(selectedCalendarDate)}`);
      render();
    });
  });

  app.querySelector("[data-form='top-search']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("q") || "").trim();
    logSearchQuery = query;
    activeTab = "log";
    const params = new URLSearchParams({ tab: activeTab });
    if (logSearchQuery) params.set("q", logSearchQuery);
    history.replaceState(null, "", `?${params.toString()}`);
    render();
  });

  app.querySelectorAll("[data-quick-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.quickType;
      const title = button.dataset.quickTitle;
      if (type === "meal" || type === "potty") {
        activeQuickFlow = type;
        activeTab = "log";
        history.replaceState(null, "", "?tab=log");
        render();
        return;
      }
      if (type === "alone") {
        if (/leaving/i.test(title)) {
          startLeavingHome({
            caregiver: "Unassigned",
            note: "Started from Quick Log."
          });
        }
        activeQuickFlow = "";
        activeTab = "household-pulse";
        history.replaceState(null, "", "?tab=household-pulse");
        render();
        return;
      }
      const now = new Date().toISOString();
      const entry = createEntry({
        type,
        title,
        caregiver: "Unassigned",
        occurredAt: now,
        ...getQuickEntryDefaults(type, title, now)
      });
      saveState({ ...state, entries: [entry, ...(state.entries || [])] });
      activeTab = "phoenix";
      render();
    });
  });

  app.querySelector("[data-form='entry']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const entry = createEntry({
      ...data,
      occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : new Date().toISOString()
    });
    saveState({ ...state, entries: [entry, ...(state.entries || [])] });
    activeTab = "phoenix";
    render();
  });

  app.querySelectorAll("[data-form='meal-lifecycle']").forEach((form) => {
    form.addEventListener("submit", handleMealLifecycleSubmit);
  });

  app.querySelector("[data-form='potty-outcome']")?.addEventListener("submit", handlePottyOutcomeSubmit);

  app.querySelector("[data-form='leaving-home']")?.addEventListener("submit", handleLeavingHomeSubmit);

  app.querySelector("[data-form='return-home']")?.addEventListener("submit", handleReturnHomeSubmit);

  app.querySelectorAll("[data-action='remove-record']").forEach((button) => {
    button.addEventListener("click", () => {
      saveState({ ...state, records: removeRecord(state.records, button.dataset.recordId) });
      activeTab = activeTab === "records" ? "records" : "more";
      render();
    });
  });

  app.querySelectorAll("[data-form='record']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, records: upsertRecord(state.records, data) });
      activeTab = activeTab === "records" ? "records" : "more";
      render();
    });
  });

  app.querySelectorAll("[data-form='routine']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, routines: upsertRoutine(state.routines, data) });
      activeTab = "plans";
      render();
    });
  });

  app.querySelectorAll("[data-form='caregiver']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState(upsertCaregiverProfile(state, data.previousName, data));
      activeTab = "more";
      render();
    });
  });

  app.querySelectorAll("[data-form='goal']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, goals: upsertGoal(state.goals, data) });
      activeTab = "plans";
      render();
    });
  });

  app.querySelector("[data-form='diet-profile']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    saveState({ ...state, dietProfile: normalizeDietProfileInput(data) });
    activeTab = activeTab === "diet-treats" ? "diet-treats" : "more";
    render();
  });

  app.querySelector("[data-form='assistant']")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = new FormData(event.currentTarget).get("question");
    await reviewAssistantQuestion(question);
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button));
  });

  app.querySelector("[data-input='import-json']")?.addEventListener("change", handleImportFile);

  app.querySelector("[data-input='avatar-photo']")?.addEventListener("change", handleAvatarPhotoInput);
}

function handleMealLifecycleSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const now = new Date().toISOString();
  if (data.mode === "update") {
    const outcome = cleanFormValue(data.outcome) || "Ate some";
    const portionEaten = cleanFormValue(data.portionEaten) || outcome;
    const note = cleanFormValue(data.note);
    const entries = (state.entries || []).map((entry) => {
      if (entry.id !== data.entryId) return entry;
      return {
        ...entry,
        outcome,
        portionEaten,
        outcomeAt: now,
        outcomeBy: cleanFormValue(data.outcomeBy) || entry.caregiver || "Unassigned",
        trustState: "Confirmed",
        visibility: "Household",
        note: mergeNote(entry.note, note ? `Meal outcome updated: ${outcome}. ${note}` : `Meal outcome updated: ${outcome}.`)
      };
    });
    saveState({ ...state, entries });
  } else {
    const mealType = cleanFormValue(data.mealType) || "Meal";
    const servedBy = cleanFormValue(data.servedBy) || "Unassigned";
    const entry = createEntry({
      type: "meal",
      title: mealType,
      caregiver: servedBy,
      occurredAt: now,
      mealType,
      servedAt: now,
      servedBy,
      food: cleanFormValue(data.food),
      portionOffered: cleanFormValue(data.portionOffered),
      outcome: "Pending",
      trustState: "Confirmed",
      visibility: "Household",
      note: cleanFormValue(data.note) || "Meal served. Outcome pending."
    });
    saveState({ ...state, entries: [entry, ...(state.entries || [])] });
  }
  activeQuickFlow = "";
  activeTab = "phoenix";
  render();
}

function handlePottyOutcomeSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const now = new Date().toISOString();
  const pottyOutcome = cleanFormValue(data.pottyOutcome) || "Tried, nothing";
  const pottyLocation = cleanFormValue(data.pottyLocation) || "Outside";
  const entry = createEntry({
    type: "potty",
    title: `Potty: ${pottyOutcome}`,
    caregiver: cleanFormValue(data.caregiver) || "Unassigned",
    occurredAt: now,
    pottyLocation,
    pottyOutcome,
    outcome: pottyOutcome,
    trustState: "Confirmed",
    visibility: "Household",
    note: cleanFormValue(data.note)
  });
  saveState({ ...state, entries: [entry, ...(state.entries || [])] });
  activeQuickFlow = "";
  activeTab = "phoenix";
  render();
}

function cleanFormValue(value) {
  return String(value || "").trim();
}

function handleLeavingHomeSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  startLeavingHome({
    caregiver: cleanFormValue(data.caregiver) || "Unassigned",
    note: cleanFormValue(data.note)
  });
  activeTab = "household-pulse";
  history.replaceState(null, "", "?tab=household-pulse");
  render();
}

function startLeavingHome({ caregiver = "Unassigned", note = "" } = {}) {
  const active = getActiveAloneEntry();
  if (active) return active;
  const now = new Date().toISOString();
  const entry = createEntry({
    type: "alone",
    title: "Leaving Home",
    caregiver,
    occurredAt: now,
    trustState: "Confirmed",
    visibility: "Household",
    moodAfter: "Home alone",
    note: note ? `Phoenix is home alone. ${note}` : "Phoenix is home alone. Return outcome pending."
  });
  saveState({ ...state, entries: [entry, ...(state.entries || [])] });
  return entry;
}

function handleReturnHomeSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const now = new Date().toISOString();
  const entryId = cleanFormValue(data.entryId);
  const outcome = cleanFormValue(data.aloneOutcome) || "Unknown";
  const caregiver = cleanFormValue(data.caregiver) || "Unassigned";
  const recoveryMinutes = cleanFormValue(data.recoveryMinutes);
  const note = cleanFormValue(data.note);
  const entries = (state.entries || []).map((entry) => {
    if (entry.id !== entryId) return entry;
    const durationMinutes = Math.max(0, Math.round((new Date(now).getTime() - new Date(entry.occurredAt).getTime()) / 60000));
    return {
      ...entry,
      title: "Alone Time",
      caregiver: entry.caregiver && entry.caregiver !== "Unassigned" ? entry.caregiver : caregiver,
      endedAt: now,
      durationMinutes,
      aloneOutcome: outcome,
      moodAfter: outcome,
      outcome,
      trustState: "Confirmed",
      visibility: "Household",
      note: mergeNote(entry.note, buildReturnHomeNote({ caregiver, outcome, recoveryMinutes, note }))
    };
  });
  saveState({ ...state, entries });
  activeTab = "household-pulse";
  history.replaceState(null, "", "?tab=household-pulse");
  render();
}

function buildReturnHomeNote({ caregiver, outcome, recoveryMinutes, note }) {
  const parts = [`Return logged by ${caregiver}. Outcome: ${outcome}.`];
  if (recoveryMinutes) parts.push(`Recovery: ${recoveryMinutes} minutes.`);
  if (note) parts.push(note);
  return parts.join(" ");
}

async function handleAction(action, button) {
  if (action === "reset-demo") {
    const confirmed = window.confirm("Reset WoofWatcher to the Phoenix demo state? This clears local logs on this device.");
    if (!confirmed) return;
    saveState(getDefaultState());
    activeTab = "phoenix";
    assistantAnswer = "";
    render();
  }

  if (action === "toggle-theme") {
    saveTheme(theme === "dark" ? "light" : "dark");
    render();
  }

  if (action === "clear-log-search") {
    logSearchQuery = "";
    activeTab = "log";
    history.replaceState(null, "", "?tab=log");
    render();
  }

  if (action === "clear-quick-flow") {
    activeQuickFlow = "";
    activeTab = "log";
    history.replaceState(null, "", "?tab=log");
    render();
  }

  if (action === "open-diet-log-meal") {
    activeQuickFlow = "meal";
    activeTab = "log";
    history.replaceState(null, "", "?tab=log");
    render();
    return;
  }

  if (action === "open-diet-log-treat") {
    const now = new Date().toISOString();
    const caregiver = getCaregiverOptions()[0] || "Unassigned";
    const entry = createEntry({
      type: "treat",
      title: "Treat",
      caregiver,
      occurredAt: now,
      treatType: state.dietProfile?.treatsAllowed || "Treat",
      reason: "Diet & Treats quick log",
      trustState: "Confirmed",
      visibility: "Household",
      note: "Treat logged from Diet & Treats."
    });
    saveState({ ...state, entries: [entry, ...(state.entries || [])] });
    activeTab = "diet-treats";
    history.replaceState(null, "", "?tab=diet-treats");
    render();
    return;
  }

  if (action === "edit-diet-profile") {
    activeTab = "diet-treats";
    history.replaceState(null, "", "?tab=diet-treats#diet-profile");
    render();
    window.requestAnimationFrame(() => {
      app.querySelector("[data-form='diet-profile'] input")?.focus();
    });
    return;
  }

  if (action === "woofguide-log-meal") {
    activeQuickFlow = "meal";
    activeTab = "log";
    assistantAnswer = "Meal log draft opened. Review what was served, portion offered, and outcome before saving to the household timeline.";
    history.replaceState(null, "", "?tab=log");
    render();
    return;
  }

  if (action === "woofguide-open-care-pass") {
    activeTab = "care-pass";
    assistantAnswer = "Care Pass review opened. Pick the right audience before copying or downloading anything.";
    history.replaceState(null, "", "?tab=care-pass");
    render();
    return;
  }

  if (action === "woofguide-open-records") {
    activeTab = "records";
    assistantAnswer = "Records review opened. Check vaccines, visits, insurance, microchip, and documents before sharing.";
    history.replaceState(null, "", "?tab=records");
    render();
    return;
  }

  if (action === "woofguide-draft-vet-note") {
    assistantAnswer = buildWoofGuideVetNoteDraft();
    activeTab = "woofguide";
    history.replaceState(null, "", "?tab=woofguide#vet-note");
    render();
    return;
  }

  if (action === "avatar-upload-photo") {
    app.querySelector("[data-input='avatar-photo']")?.click();
    return;
  }

  if (action === "set-avatar-state") {
    const avatarState = button?.dataset.avatarState || "happy";
    saveState({
      ...state,
      avatarStudio: {
        ...(state.avatarStudio || {}),
        selectedState: avatarState,
        updatedAt: new Date().toISOString()
      }
    });
    activeTab = "avatar-studio";
    history.replaceState(null, "", "?tab=avatar-studio");
    render();
    return;
  }

  if (action === "quick-leaving-home") {
    startLeavingHome({ caregiver: "Unassigned", note: "Started from Household Pulse." });
    activeTab = "household-pulse";
    history.replaceState(null, "", "?tab=household-pulse");
    render();
  }

  if (action === "focus-return-home") {
    activeTab = "household-pulse";
    history.replaceState(null, "", "?tab=household-pulse#return-home");
    render();
  }

  if (action === "meal-outcome") {
    const entryId = button?.dataset.entryId;
    const outcome = button?.dataset.outcome || "Ate some";
    const now = new Date().toISOString();
    const entries = (state.entries || []).map((entry) => {
      if (entry.id !== entryId) return entry;
      return {
        ...entry,
        outcome,
        portionEaten: outcome === "Ate all" ? (entry.portionOffered || "All") : (entry.portionEaten || outcome),
        outcomeAt: now,
        outcomeBy: entry.caregiver || "Unassigned",
        trustState: "Confirmed",
        note: mergeNote(entry.note, `Meal outcome updated: ${outcome}.`)
      };
    });
    saveState({ ...state, entries });
    activeTab = "phoenix";
    render();
  }

  if (action === "download-report") {
    downloadText("woofwatcher-phoenix-report.txt", buildReportText(state));
  }

  if (action === "copy-report") {
    navigator.clipboard?.writeText(buildReportText(state));
  }

  if (action === "copy-care-pass") {
    const audience = button?.dataset.carePassAudience || "sitter";
    navigator.clipboard?.writeText(buildScopedCarePassText(audience));
  }

  if (action === "download-care-pass") {
    const audience = button?.dataset.carePassAudience || "sitter";
    const filename = `woofwatcher-phoenix-${audience}-care-pass.json`;
    downloadText(filename, JSON.stringify(buildScopedCarePass(state, { audience }), null, 2), "application/json");
  }

  if (action === "copy-handoff") {
    navigator.clipboard?.writeText(getCaregiverHandoff(state).message);
  }

  if (action === "remove-routine") {
    const routineId = button?.dataset.routineId;
    saveState({ ...state, routines: removeRoutine(state.routines, routineId) });
    activeTab = "plans";
    render();
  }

  if (action === "remove-goal") {
    const goalId = button?.dataset.goalId;
    saveState({ ...state, goals: removeGoal(state.goals, goalId) });
    activeTab = "plans";
    render();
  }

  if (action === "remove-caregiver") {
    saveState(removeCaregiverProfile(state, button?.dataset.caregiverName));
    activeTab = "more";
    render();
  }

  if (action === "complete-reminder") {
    const routine = (state.routines || []).find((item) => item.id === button?.dataset.routineId);
    if (!routine) return;
    const entry = createEntry({
      type: routine.type,
      title: routine.label,
      caregiver: reminderCaregiver(routine.owner),
      note: routine.note ? `Reminder completed. ${routine.note}` : "Reminder completed.",
      occurredAt: new Date().toISOString()
    });
    saveState({ ...state, entries: [entry, ...(state.entries || [])] });
    activeTab = "plans";
    render();
  }

  if (action === "enable-notifications") {
    notificationPermission = await requestNotificationPermission();
    activeTab = "plans";
    render();
  }

  if (action === "test-notification") {
    await showCareNotification({
      title: "WoofWatcher test alert",
      body: "Phoenix care alerts are ready while WoofWatcher is open.",
      tag: "woofwatcher-test"
    });
  }

  if (action === "print-report") {
    window.print();
  }

  if (action === "export-json") {
    downloadText("woofwatcher-phoenix-backup.json", JSON.stringify(state, null, 2), "application/json");
  }

  if (action === "export-transfer") {
    downloadText("woofwatcher-phoenix-care-pass.json", JSON.stringify(buildCareRoomTransfer(state), null, 2), "application/json");
  }

  if (action === "import-json") {
    app.querySelector("[data-input='import-json']")?.click();
  }
}

function getCaregiverOptions() {
  const names = (state.caregivers || []).map((caregiver) => caregiver.name).filter(Boolean);
  return [...new Set([...names, "Both", "Unassigned"])];
}

function reminderCaregiver(owner = "") {
  const options = getCaregiverOptions();
  return options.find((name) => name.toLowerCase() === String(owner).trim().toLowerCase()) || "Unassigned";
}

async function handleImportFile(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    saveState(normalizeState(imported));
    activeTab = "phoenix";
    assistantAnswer = imported.packageType === "woofwatcher.care-room-transfer"
      ? "Care room transfer imported. Review Phoenix's handoff and latest timeline before continuing care."
      : "Backup imported. Review Phoenix's latest care timeline before acting on any old notes.";
    render();
  } catch {
    window.alert("WoofWatcher could not import that file. Choose a JSON backup or care room transfer exported from this app.");
  }
}

function handleAvatarPhotoInput(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    saveState({
      ...state,
      avatarStudio: {
        ...(state.avatarStudio || {}),
        sourceImage: String(reader.result || ""),
        sourceImageName: file.name || "Phoenix reference",
        updatedAt: new Date().toISOString()
      }
    });
    activeTab = "avatar-studio";
    history.replaceState(null, "", "?tab=avatar-studio");
    render();
  });
  reader.readAsDataURL(file);
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isBrowserNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function getBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) return "unsupported";
  return Notification.permission || "default";
}

async function requestNotificationPermission() {
  if (!isBrowserNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || "default";
  }
}

function maybeSendDueNotification(notifications) {
  if (!notifications.shouldNotifyNow || !notifications.nextNotification || !notifications.notificationKey) return;
  const lastSent = sessionStorage.getItem(NOTIFICATION_SENT_KEY);
  if (lastSent === notifications.notificationKey) return;
  showCareNotification(notifications.nextNotification)
    .then(() => sessionStorage.setItem(NOTIFICATION_SENT_KEY, notifications.notificationKey))
    .catch(() => {});
}

async function showCareNotification(payload) {
  if (!payload || !isBrowserNotificationSupported() || Notification.permission !== "granted") return false;
  const options = {
    body: payload.body,
    tag: payload.tag,
    icon: "/public/app-icon.svg",
    badge: "/public/app-icon.svg",
    data: { url: "/?tab=reminders" }
  };

  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(payload.title, options);
        return true;
      }
    } catch {}
  }

  try {
    new Notification(payload.title, options);
    return true;
  } catch {
    return false;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

async function checkAssistantStatus() {
  try {
    const response = await fetch("/api/care-helper", { cache: "no-store" });
    if (!response.ok) return;
    const status = await response.json();
    assistantStatus = {
      checked: true,
      configured: Boolean(status.configured),
      mode: status.mode || (status.configured ? "openai" : "local"),
      model: status.model || ""
    };
    if (activeTab === "woofguide") render();
  } catch {
    assistantStatus = { checked: true, configured: false, mode: "local", model: "" };
  }
}

async function reviewAssistantQuestion(question) {
  const context = getAssistantContext(state, question);
  assistantBusy = true;
  assistantAnswer = "Reviewing Phoenix context. If live OpenAI is not configured, WoofWatcher will use the local care review.";
  render();

  const liveAnswer = await requestLiveAssistant(question, context);
  assistantBusy = false;
  if (liveAnswer?.answer) {
    assistantAnswer = liveAnswer.answer;
    assistantStatus = {
      checked: true,
      configured: liveAnswer.mode === "openai" || assistantStatus.configured,
      mode: liveAnswer.mode || "openai",
      model: liveAnswer.model || assistantStatus.model || ""
    };
  } else {
    assistantAnswer = context.localAnswer;
  }
  render();
}

async function requestLiveAssistant(question, context) {
  try {
    const response = await fetch("/api/care-helper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context })
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function toDateTimeLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatLongDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function getSelectedCalendarDay(calendar) {
  const selected = calendar.days.find((day) => day.dateKey === selectedCalendarDate);
  if (selected) return selected;
  const today = calendar.days.find((day) => day.isToday);
  if (today) {
    selectedCalendarDate = today.dateKey;
    return today;
  }
  const reviewDay = calendar.days.find((day) => day.status === "review");
  const activeDay = calendar.days.find((day) => day.status === "active");
  const fallback = reviewDay || activeDay || calendar.days[0] || null;
  selectedCalendarDate = fallback?.dateKey || "";
  return fallback;
}

function titleCase(value) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
