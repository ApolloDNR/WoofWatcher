import {
  buildCareRoomTransfer,
  buildReportText,
  createEntry,
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

const STORAGE_KEY = "woofwatcher.v1.state";
const NOTIFICATION_SENT_KEY = "woofwatcher.v1.lastNotificationKey";
const ENTRY_SELECT_OPTIONS = [
  "meal",
  "treat",
  "walk",
  "park",
  "potty",
  "poop",
  "pee",
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
const PRIMARY_TABS = new Set(["phoenix", "log", "plans", "health", "more"]);
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
  records: "more",
  report: "more",
  assistant: "more"
};

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>`,
  plans: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  log: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  health: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  backup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  meal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11h14a7 7 0 0 1-14 0Z"/><line x1="12" y1="4" x2="12" y2="7"/></svg>`,
  walk: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="14.5" r="3.4"/><circle cx="6.6" cy="10" r="1.5"/><circle cx="10" cy="7" r="1.5"/><circle cx="14" cy="7" r="1.5"/><circle cx="17.4" cy="10" r="1.5"/></svg>`,
  potty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z"/></svg>`,
  training: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M9 14.5 8 22l4-2 4 2-1-7.5"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4Z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
};

let app;
let state;
let activeTab;
let selectedCalendarDate;
let assistantAnswer = "";
let assistantBusy = false;
let assistantStatus = { checked: false, configured: false, mode: "local", model: "" };
let notificationPermission;

export function initApp(container) {
  app = container;
  state = loadState();
  const initialParams = new URLSearchParams(window.location.search);
  activeTab = normalizeTab(initialParams.get("tab"));
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
  const clock = new Date();
  const hour = clock.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const greetIcon = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";
  const dateLabel = clock.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  app.dataset.loading = "false";
  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="side-brand">
          <img src="/app-icon.svg" alt="" class="side-logo" />
          <span class="side-brand-text"><span class="woof">Woof</span> <span class="watcher">Watcher</span></span>
        </div>
        <nav class="side-nav" aria-label="WoofWatcher sections">
          ${renderSideNav("phoenix", "Dashboard", ICONS.dashboard)}
          ${renderSideNav("plans", "Plans", ICONS.plans)}
          ${renderSideNav("log", "Log", ICONS.log)}
          ${renderSideNav("health", "Health", ICONS.health)}
          ${renderSideNav("more", "More", ICONS.more)}
        </nav>
        <div class="side-foot">
          <div class="side-user">
            <div class="side-user-avatar">${escapeHtml(caregiverName.charAt(0).toUpperCase())}</div>
            <div class="side-user-meta">
              <strong>${escapeHtml(caregiverName)}</strong>
              <span>Primary Caregiver</span>
            </div>
          </div>
          <button class="side-backup" data-action="export-json">${ICONS.backup}<span>Backup data</span></button>
        </div>
      </aside>

      <div class="main-area">
        <header class="dash-topbar">
          <div class="greeting-block">
            <h1 class="greeting">${greeting}, ${escapeHtml(caregiverName)}! <span>${greetIcon}</span></h1>
            <p class="greeting-sub">${escapeHtml(state.profile.name)} is ready for an adventure.</p>
          </div>
          <div class="top-right">
            <span class="date-pill">${ICONS.calendar}${escapeHtml(dateLabel)}</span>
          </div>
        </header>
        <main class="workspace">
          ${renderActiveTab(activeTab, { summary, plan, reminders, notifications, health, bileWatch, handoff, pulse, avatar, goalReview, calendar, trainingProgress })}
        </main>
      </div>
    </div>

    <nav class="bottom-nav" aria-label="WoofWatcher sections">
      ${renderNavButton("phoenix", "Home")}
      ${renderNavButton("plans", "Plans")}
      <button class="nav-center-btn" data-tab="log">+</button>
      ${renderNavButton("health", "Health")}
      ${renderNavButton("more", "More")}
    </nav>
    <input class="visually-hidden" data-input="import-json" type="file" accept="application/json,.json" />
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
  const { avatar, pulse, summary, health, reminders } = context;
  const nextReminder = reminders.nextReminder || pulse.nextAction || {};
  const mood = moodInfo(avatar.mood);
  const energy = energyPct(health.status);
  const recent = (state.entries || []).slice(0, 4);
  const vomiting = summary.vomitIncidents > 0 ? String(summary.vomitIncidents) : "None";
  const weight = `${state.profile.weight.current} ${state.profile.weight.unit}`;
  const caregiverName = (state.caregivers && state.caregivers[0] && state.caregivers[0].name) || "friend";

  return `
    <div class="dash">
      <div class="dash-col">
        <section class="card hero">
          <div class="hero-photo">
            <img src="/phoenix-hero.png" alt="${escapeAttribute(state.profile.name)}" />
            <span class="hero-name">${escapeHtml(state.profile.name)}</span>
            <span class="hero-speech">${escapeHtml(avatar.suggestedAction)}</span>
            <span class="hero-mood">${mood.emoji} ${escapeHtml(mood.label)}</span>
          </div>
          <div class="hero-body">
            <div class="energy">
              <div class="energy-top"><span>Energy</span><strong>${energy}%</strong></div>
              <div class="energy-track"><i style="width:${energy}%"></i></div>
            </div>
            <p class="hero-quote">${escapeHtml(avatar.speech)}</p>
          </div>
          <div class="hero-next">
            <div>
              <span>Next up</span>
              <strong>${escapeHtml(nextReminder.label || "Routine covered")} · ${escapeHtml(nextReminder.time || "Today")}</strong>
            </div>
            <button class="button" data-tab="plans">View</button>
          </div>
        </section>

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

        <section class="card">
          <div class="card-head"><h3>Health Watch</h3><span class="pill ${escapeAttribute(health.status)}">${escapeHtml(health.label)}</span></div>
          <div class="health-list">
            ${renderHealthRow("Appetite", health.status === "review" ? "Watch" : "Good", health.status === "review" ? "watch" : "good")}
            ${renderHealthRow("Stool", "Normal", "good")}
            ${renderHealthRow("Vomiting", vomiting, summary.vomitIncidents > 0 ? "watch" : "good")}
            ${renderHealthRow("Energy", energy >= 70 ? "Good" : energy >= 50 ? "Fair" : "Low", energy >= 70 ? "good" : "watch")}
            ${renderHealthRow("Weight", weight, "neutral")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderSideNav(tab, label, icon) {
  const isActive = activeTab === tab;
  return `<button class="side-link ${isActive ? "active" : ""}"${isActive ? ' aria-current="page"' : ""} data-tab="${escapeAttribute(tab)}">${icon}<span>${escapeHtml(label)}</span></button>`;
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

function renderLogTab() {
  return `
    <div class="dashboard-grid log-screen">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">Effortless Log</p>
            <h3>Tap first, detail second</h3>
          </div>
          <span class="status-chip steady">Local-first</span>
        </div>
        <div class="effortless-grid">
          ${renderQuickButton("meal", "Meal")}
          ${renderQuickButton("treat", "Treat")}
          ${renderQuickButton("walk", "Walk")}
          ${renderQuickButton("potty", "Potty")}
          ${renderQuickButton("training", "Training win")}
          ${renderQuickButton("alone", "Alone time")}
          ${renderQuickButton("mood", "Mood")}
          ${renderQuickButton("vomit", "Bile note")}
        </div>
      </section>
      <section class="panel span-2">
        <p class="micro">New care event</p>
        <h3>Log Phoenix's care</h3>
        ${renderEntryForm()}
      </section>
      <section class="panel span-2">
        <p class="micro">Recent entries</p>
        <h3>Latest household proof</h3>
        ${renderTimeline(state.entries.slice(0, 12))}
      </section>
    </div>
  `;
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
        <span>Appetite</span>
        <input name="appetite" placeholder="eager, picky, refused" />
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

function renderMoreTab(context) {
  return `
    <div class="dashboard-grid more-screen">
      ${renderDietProfilePanel()}
      ${renderCarePassPanel(context.summary)}
      ${renderCareTeamPanel(context.handoff)}
      ${renderRecordsPanel()}
      ${renderProgressMemoryPanel(context.calendar, context.trainingProgress)}
      ${renderWoofGuidePanel()}
    </div>
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
      <pre class="report-box compact">${escapeHtml(report)}</pre>
    </section>
  `;
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
      <p class="notification-boundary">WoofGuide can organize Phoenix's logs and caregiver notes. It does not diagnose, replace a veterinarian, or decide urgent care.</p>
    </section>
  `;
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
  return `<button class="${activeTab === tab ? "active" : ""}" data-tab="${tab}">${label}</button>`;
}

function bindEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = normalizeTab(button.dataset.tab);
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

  app.querySelectorAll("[data-quick-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.quickType;
      const title = button.dataset.quickTitle;
      const entry = createEntry({ type, title, caregiver: "Unassigned", occurredAt: new Date().toISOString() });
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

  app.querySelectorAll("[data-action='remove-record']").forEach((button) => {
    button.addEventListener("click", () => {
      saveState({ ...state, records: removeRecord(state.records, button.dataset.recordId) });
      activeTab = "more";
      render();
    });
  });

  app.querySelectorAll("[data-form='record']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, records: upsertRecord(state.records, data) });
      activeTab = "more";
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
    activeTab = "more";
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

  if (action === "download-report") {
    downloadText("woofwatcher-phoenix-report.txt", buildReportText(state));
  }

  if (action === "copy-report") {
    navigator.clipboard?.writeText(buildReportText(state));
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
    if (activeTab === "assistant") render();
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
