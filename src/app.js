import {
  buildCareRoomTransfer,
  buildReportText,
  createEntry,
  getCareCalendar,
  getCaregiverHandoff,
  getAssistantContext,
  getDefaultState,
  getGoalReview,
  getHealthWatch,
  getMonthlySummary,
  getReminderCenter,
  getTrainingProgress,
  getTodayPlan,
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
const ENTRY_SELECT_OPTIONS = [
  "meal",
  "treat",
  "walk",
  "park",
  "training",
  "social",
  "vomit",
  "health",
  "vet",
  "weight",
  "medication",
  "note"
];
const RECORD_TYPE_OPTIONS = ["vet", "vaccine", "weight", "instruction", "medication", "microchip"];

const app = document.querySelector("#app");
let state = loadState();
const initialParams = new URLSearchParams(window.location.search);
let activeTab = initialParams.get("tab") || "today";
let selectedCalendarDate = initialParams.get("date") || "";
let assistantAnswer = "";
let assistantBusy = false;
let assistantStatus = { checked: false, configured: false, mode: "local", model: "" };

render();
registerServiceWorker();
checkAssistantStatus();

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

function render() {
  const summary = getMonthlySummary(state);
  const plan = getTodayPlan(state);
  const handoff = getCaregiverHandoff(state);
  const goalReview = getGoalReview(state);
  const calendar = getCareCalendar(state);
  const trainingProgress = getTrainingProgress(state);
  const health = getHealthWatch(state);
  const reminders = getReminderCenter(state);

  app.dataset.loading = "false";
  app.innerHTML = `
    <header class="topbar">
      <div class="brand-lockup">
        <img src="/public/app-icon.svg" alt="" class="app-icon" />
        <div>
          <p class="micro">WoofWatcher</p>
          <h1>Phoenix care command</h1>
        </div>
      </div>
      <div class="top-actions">
        <button class="button ghost" data-action="export-json">Backup</button>
        <button class="button ghost" data-action="export-transfer">Transfer</button>
        <button class="button ghost" data-action="import-json">Import</button>
        <button class="button ghost" data-action="reset-demo">Reset</button>
      </div>
      <input class="visually-hidden" data-input="import-json" type="file" accept="application/json,.json" />
    </header>

    <main class="workspace">
      <aside class="profile-rail">
        ${renderProfileCard(health)}
        ${renderCareStats(summary)}
        ${renderHandoff(handoff)}
      </aside>

      <section class="primary-surface">
        ${renderTabHeader(activeTab)}
        ${renderActiveTab(activeTab, { summary, plan, reminders, health, handoff, goalReview, calendar, trainingProgress })}
      </section>
    </main>

    <nav class="bottom-nav" aria-label="WoofWatcher sections">
      ${renderNavButton("today", "Today")}
      ${renderNavButton("team", "Team")}
      ${renderNavButton("reminders", "Reminders")}
      ${renderNavButton("schedule", "Schedule")}
      ${renderNavButton("goals", "Goals")}
      ${renderNavButton("calendar", "Calendar")}
      ${renderNavButton("progress", "Progress")}
      ${renderNavButton("log", "Quick Log")}
      ${renderNavButton("health", "Health")}
      ${renderNavButton("records", "Records")}
      ${renderNavButton("report", "Report")}
      ${renderNavButton("assistant", "Helper")}
    </nav>
  `;

  bindEvents();
}

function renderProfileCard(health) {
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
      <div class="dog-portrait" aria-hidden="true">
        <div class="dog-ear left"></div>
        <div class="dog-ear right"></div>
        <div class="dog-face">
          <span></span>
          <span></span>
        </div>
      </div>
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

function renderHandoff(handoff) {
  return `
    <section class="panel handoff-card">
      <div class="section-heading">
        <div>
          <p class="micro">Caregiver handoff</p>
          <h3>${handoff.completedCount}/${handoff.totalCount} routines logged</h3>
        </div>
        <button class="button ghost" data-action="copy-handoff">Copy</button>
      </div>
      <p>${escapeHtml(handoff.message)}</p>
      <div class="button-row">
        <button class="button ghost" data-action="export-transfer">Transfer package</button>
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

function renderTabHeader(tab) {
  const labels = {
    today: ["Today", "Routine, handoff, and latest care."],
    team: ["Care Team", "Edit caregiver names, roles, and handoff ownership."],
    reminders: ["Reminders", "Due, overdue, completed, and upcoming Phoenix care."],
    schedule: ["Schedule", "Edit meals, walks, snacks, training, and ownership."],
    goals: ["Goals", "Weight, training, social, anxiety, and health milestones."],
    calendar: ["Calendar", "Monthly care patterns, vomit days, and daily handoff evidence."],
    progress: ["Progress", "Training wins, rough spots, social exposure, and next focus."],
    log: ["Quick Log", "Capture what happened without a long conversation."],
    health: ["Health Watch", "Track patterns and know when review is needed."],
    records: ["Records", "Vaccines, vet notes, weight goals, and instructions."],
    report: ["Monthly Report", "Export a clean care summary for review."],
    assistant: ["Care Helper", "Local context now; OpenAI-ready when credentials are approved."]
  };
  const [title, body] = labels[tab] || labels.today;
  return `
    <div class="surface-header">
      <div>
        <p class="micro">Phoenix</p>
        <h2>${title}</h2>
        <p>${body}</p>
      </div>
      <button class="button primary" data-tab="log">Add log</button>
    </div>
  `;
}

function renderActiveTab(tab, context) {
  if (tab === "team") return renderTeamTab(context.handoff);
  if (tab === "reminders") return renderRemindersTab(context.reminders);
  if (tab === "schedule") return renderScheduleTab();
  if (tab === "goals") return renderGoalsTab(context.goalReview);
  if (tab === "calendar") return renderCalendarTab(context.calendar);
  if (tab === "progress") return renderProgressTab(context.trainingProgress);
  if (tab === "log") return renderLogTab();
  if (tab === "health") return renderHealthTab(context.health);
  if (tab === "records") return renderRecordsTab();
  if (tab === "report") return renderReportTab(context.summary);
  if (tab === "assistant") return renderAssistantTab();
  return renderTodayTab(context.plan, context.health, context.handoff);
}

function renderRemindersTab(reminders) {
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
    </div>
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

function renderTodayTab(plan, health, handoff) {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <div class="section-heading">
          <div>
            <p class="micro">${escapeHtml(plan.dateLabel)}</p>
            <h3>Today's routine</h3>
          </div>
          <span class="status-chip ${health.status}">${escapeHtml(health.label)}</span>
        </div>
        <div class="routine-list">
          ${state.routines.map((routine) => renderRoutine(routine, plan.completedLabels.includes(routine.label))).join("")}
        </div>
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="micro">Next handoff</p>
            <h3>${escapeHtml(handoff.nextRoutine?.label || "Routine covered")}</h3>
          </div>
          <button class="button ghost" data-action="copy-handoff">Copy</button>
        </div>
        <p class="handoff-message">${escapeHtml(handoff.message)}</p>
      </section>
      <section class="panel">
        <p class="micro">Quick Log</p>
        <h3>Most common actions</h3>
        <div class="quick-actions">
          ${renderQuickButton("meal", "Breakfast")}
          ${renderQuickButton("walk", "Morning walk")}
          ${renderQuickButton("training", "Training")}
          ${renderQuickButton("social", "Dog interaction")}
          ${renderQuickButton("vomit", "Yellow bile")}
          ${renderQuickButton("weight", "Weight check")}
        </div>
      </section>
      <section class="panel">
        <p class="micro">Care timeline</p>
        <h3>Recent logs</h3>
        ${renderTimeline(state.entries.slice(0, 6))}
      </section>
    </div>
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

function renderQuickButton(type, title) {
  return `<button class="quick-button" data-quick-type="${type}" data-quick-title="${escapeHtml(title)}">${escapeHtml(title)}</button>`;
}

function renderLogTab() {
  return `
    <div class="dashboard-grid">
      <section class="panel span-2">
        <p class="micro">New care event</p>
        <h3>Log Phoenix's care</h3>
        ${renderEntryForm()}
      </section>
      <section class="panel">
        <p class="micro">Recent entries</p>
        <h3>Editable by reset or backup import</h3>
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
        <span>Minutes</span>
        <input name="durationMinutes" inputmode="numeric" placeholder="20" />
      </label>
      <label>
        <span>Dog interactions</span>
        <input name="dogInteractions" inputmode="numeric" placeholder="0" />
      </label>
      <label>
        <span>Mood/appetite</span>
        <input name="mood" placeholder="settled, anxious, refused" />
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

function renderHealthTab(health) {
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
      </section>
      <section class="panel alert-panel">
        <p class="micro">Vet boundary</p>
        <h3>Red flags</h3>
        <ul>
          ${health.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join("")}
        </ul>
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
          <article class="timeline-row ${entry.requiresFollowUp ? "follow-up" : ""}">
            <div>
              <span>${escapeHtml(titleCase(entry.type))}</span>
              <h4>${escapeHtml(entry.title)}</h4>
              <p>${escapeHtml(entry.caregiver)} | ${escapeHtml(formatDateTime(entry.occurredAt))}</p>
              ${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ""}
            </div>
            ${entry.requiresFollowUp ? `<strong>Review</strong>` : ""}
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
      activeTab = button.dataset.tab;
      const params = new URLSearchParams({ tab: activeTab });
      if (activeTab === "calendar" && selectedCalendarDate) params.set("date", selectedCalendarDate);
      history.replaceState(null, "", `?${params.toString()}`);
      render();
    });
  });

  app.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCalendarDate = button.dataset.calendarDate;
      activeTab = "calendar";
      history.replaceState(null, "", `?tab=calendar&date=${encodeURIComponent(selectedCalendarDate)}`);
      render();
    });
  });

  app.querySelectorAll("[data-quick-type]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.quickType;
      const title = button.dataset.quickTitle;
      const entry = createEntry({ type, title, caregiver: "Unassigned", occurredAt: new Date().toISOString() });
      saveState({ ...state, entries: [entry, ...(state.entries || [])] });
      activeTab = "today";
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
    activeTab = "today";
    render();
  });

  app.querySelectorAll("[data-action='remove-record']").forEach((button) => {
    button.addEventListener("click", () => {
      saveState({ ...state, records: removeRecord(state.records, button.dataset.recordId) });
      activeTab = "records";
      render();
    });
  });

  app.querySelectorAll("[data-form='record']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, records: upsertRecord(state.records, data) });
      activeTab = "records";
      render();
    });
  });

  app.querySelectorAll("[data-form='routine']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, routines: upsertRoutine(state.routines, data) });
      activeTab = "schedule";
      render();
    });
  });

  app.querySelectorAll("[data-form='caregiver']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState(upsertCaregiverProfile(state, data.previousName, data));
      activeTab = "team";
      render();
    });
  });

  app.querySelectorAll("[data-form='goal']").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      saveState({ ...state, goals: upsertGoal(state.goals, data) });
      activeTab = "goals";
      render();
    });
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

function handleAction(action, button) {
  if (action === "reset-demo") {
    const confirmed = window.confirm("Reset WoofWatcher to the Phoenix demo state? This clears local logs on this device.");
    if (!confirmed) return;
    saveState(getDefaultState());
    activeTab = "today";
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
    activeTab = "schedule";
    render();
  }

  if (action === "remove-goal") {
    const goalId = button?.dataset.goalId;
    saveState({ ...state, goals: removeGoal(state.goals, goalId) });
    activeTab = "goals";
    render();
  }

  if (action === "remove-caregiver") {
    saveState(removeCaregiverProfile(state, button?.dataset.caregiverName));
    activeTab = "team";
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
    activeTab = "reminders";
    render();
  }

  if (action === "print-report") {
    window.print();
  }

  if (action === "export-json") {
    downloadText("woofwatcher-phoenix-backup.json", JSON.stringify(state, null, 2), "application/json");
  }

  if (action === "export-transfer") {
    downloadText("woofwatcher-phoenix-transfer.json", JSON.stringify(buildCareRoomTransfer(state), null, 2), "application/json");
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
    activeTab = "today";
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
