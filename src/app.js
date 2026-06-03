import {
  buildReportText,
  createEntry,
  getAssistantContext,
  getDefaultState,
  getHealthWatch,
  getMonthlySummary,
  normalizeState,
  getTodayPlan
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

const app = document.querySelector("#app");
let state = loadState();
let activeTab = new URLSearchParams(window.location.search).get("tab") || "today";
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
  const health = getHealthWatch(state);

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
        <button class="button ghost" data-action="import-json">Import</button>
        <button class="button ghost" data-action="reset-demo">Reset</button>
      </div>
      <input class="visually-hidden" data-input="import-json" type="file" accept="application/json,.json" />
    </header>

    <main class="workspace">
      <aside class="profile-rail">
        ${renderProfileCard(health)}
        ${renderCareStats(summary)}
        ${renderHandoff(plan)}
      </aside>

      <section class="primary-surface">
        ${renderTabHeader(activeTab)}
        ${renderActiveTab(activeTab, { summary, plan, health })}
      </section>
    </main>

    <nav class="bottom-nav" aria-label="WoofWatcher sections">
      ${renderNavButton("today", "Today")}
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

function renderHandoff(plan) {
  return `
    <section class="panel">
      <p class="micro">Caregiver handoff</p>
      <h3>${plan.completedCount}/${plan.totalCount} routines logged</h3>
      <p>${escapeHtml(plan.handoffPrompt)}</p>
      <div class="caregiver-list">
        ${state.caregivers.map((caregiver) => `<span>${escapeHtml(caregiver.name)}</span>`).join("")}
      </div>
    </section>
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
  if (tab === "log") return renderLogTab();
  if (tab === "health") return renderHealthTab(context.health);
  if (tab === "records") return renderRecordsTab();
  if (tab === "report") return renderReportTab(context.summary);
  if (tab === "assistant") return renderAssistantTab();
  return renderTodayTab(context.plan, context.health);
}

function renderTodayTab(plan, health) {
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
  const caregiverOptions = ["Apollo", "Girlfriend", "Both", "Unassigned"]
    .map((name) => `<option ${prefill.caregiver === name ? "selected" : ""}>${name}</option>`)
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
        <form class="record-form" data-form="record">
          <label>
            <span>Type</span>
            <select name="type">
              <option value="vet">Vet</option>
              <option value="vaccine">Vaccine</option>
              <option value="weight">Weight</option>
              <option value="instruction">Instruction</option>
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
      <div>
        <h4>${escapeHtml(record.title)}</h4>
        <p>${escapeHtml(record.due || "No date set")}</p>
        <small>${escapeHtml(record.note || "")}</small>
      </div>
    </article>
  `;
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
      history.replaceState(null, "", `?tab=${activeTab}`);
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

  app.querySelector("[data-form='record']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const record = {
      id: `record_${Date.now().toString(36)}`,
      type: clean(data.type || "instruction"),
      title: clean(data.title || "Care record"),
      due: clean(data.due || ""),
      note: clean(data.note || "")
    };
    saveState({ ...state, records: [record, ...(state.records || [])] });
    render();
  });

  app.querySelector("[data-form='assistant']")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = new FormData(event.currentTarget).get("question");
    await reviewAssistantQuestion(question);
  });

  app.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });

  app.querySelector("[data-input='import-json']")?.addEventListener("change", handleImportFile);
}

function handleAction(action) {
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

  if (action === "print-report") {
    window.print();
  }

  if (action === "export-json") {
    downloadText("woofwatcher-phoenix-backup.json", JSON.stringify(state, null, 2), "application/json");
  }

  if (action === "import-json") {
    app.querySelector("[data-input='import-json']")?.click();
  }
}

async function handleImportFile(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    saveState(normalizeState(imported));
    activeTab = "today";
    assistantAnswer = "Backup imported. Review Phoenix's latest care timeline before acting on any old notes.";
    render();
  } catch {
    window.alert("WoofWatcher could not import that backup. Choose a JSON backup exported from this app.");
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

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
