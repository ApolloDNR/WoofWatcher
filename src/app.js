const STORAGE_KEY = 'woofwatcher.phoenix.v1';

export const careCategories = {
  meal: { label: 'Meal', icon: '🍲', tone: 'amber' },
  walk: { label: 'Walk', icon: '🦮', tone: 'green' },
  health: { label: 'Health', icon: '🩺', tone: 'rose' },
  training: { label: 'Training', icon: '🎯', tone: 'violet' },
  social: { label: 'Social', icon: '🐕', tone: 'blue' },
};

export const defaultState = {
  dog: {
    name: 'Phoenix',
    breed: 'German Shepherd / Belgian Shepherd mix',
    rescueDate: '2025-05-01',
    weightGoal: 'Build steady appetite, reduce empty-stomach bile episodes, and keep anxiety low.',
    vetNotes: 'Track yellow vomit timing, last meal, stool, appetite, energy, and possible triggers.',
  },
  caregivers: ['Me', 'Girlfriend'],
  routines: [
    { id: 'r1', time: '7:30 AM', title: 'Breakfast + potty walk', owner: 'Whoever is home', note: 'Calm voice, no pressure if anxious. Offer measured food.' },
    { id: 'r2', time: '1:00 PM', title: 'Check-in / short walk', owner: 'Shared', note: 'Log appetite, stool, and mood.' },
    { id: 'r3', time: '6:30 PM', title: 'Dinner + enrichment', owner: 'Shared', note: 'Puzzle toy or training reps after she settles.' },
    { id: 'r4', time: '10:00 PM', title: 'Bedtime bile-prevention snack', owner: 'Whoever says goodnight', note: 'Small bland snack if vet-approved; log if she skips.' },
  ],
  entries: [
    { id: 'e1', date: todayOffset(-5), time: '7:40 AM', category: 'meal', title: 'Ate half breakfast', caregiver: 'Me', mood: 'Nervous but okay', notes: 'Ate after both caregivers were in the house.' },
    { id: 'e2', date: todayOffset(-4), time: '8:10 PM', category: 'training', title: 'Loose leash practice', caregiver: 'Girlfriend', mood: 'Focused', notes: 'Better engagement near quiet street; needs work around dogs.' },
    { id: 'e3', date: todayOffset(-2), time: '6:20 AM', category: 'health', title: 'Yellow bile vomit', caregiver: 'Me', mood: 'Normal after', notes: 'Empty stomach suspected. No blood, diarrhea, lethargy, or appetite loss recorded.' },
  ],
};

function todayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createEntry({ date, time, category, title, caregiver, mood, notes }) {
  return {
    id: `e${Date.now()}`,
    date,
    time,
    category,
    title: title.trim(),
    caregiver: caregiver.trim() || 'Unassigned',
    mood: mood.trim() || 'Not logged',
    notes: notes.trim(),
  };
}

export function summarizeEntries(entries, now = new Date()) {
  const month = now.toISOString().slice(0, 7);
  const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
  const byCategory = Object.fromEntries(Object.keys(careCategories).map((category) => [category, 0]));
  for (const entry of monthEntries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }
  return {
    total: monthEntries.length,
    meals: byCategory.meal,
    walks: byCategory.walk,
    health: byCategory.health,
    training: byCategory.training,
    social: byCategory.social,
    vomitMentions: monthEntries.filter((entry) => /vomit|bile|throw/i.test(`${entry.title} ${entry.notes}`)).length,
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function groupEntriesByDate(entries) {
  return entries
    .slice()
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .reduce((groups, entry) => {
      groups[entry.date] = groups[entry.date] || [];
      groups[entry.date].push(entry);
      return groups;
    }, {});
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function render() {
  const state = loadState();
  const summary = summarizeEntries(state.entries);
  const groupedEntries = groupEntriesByDate(state.entries);
  const app = document.querySelector('#app');

  app.innerHTML = `
    <section class="hero card">
      <div>
        <p class="eyebrow">Shared care command center</p>
        <h1>WoofWatcher for ${state.dog.name}</h1>
        <p class="lede">Keep meals, walks, training, anxiety triggers, health events, and caregiver handoffs in one calm place.</p>
      </div>
      <div class="dog-card">
        <span class="avatar">🐺</span>
        <strong>${state.dog.breed}</strong>
        <span>${state.dog.weightGoal}</span>
      </div>
    </section>

    <section class="grid stats" aria-label="Monthly summary">
      ${statCard('Logged this month', summary.total, 'Total care notes')}
      ${statCard('Meals', summary.meals, 'Food, snacks, appetite')}
      ${statCard('Walks', summary.walks, 'Potty + exercise')}
      ${statCard('Vomit alerts', summary.vomitMentions, 'Mentions of vomit/bile')}
    </section>

    <section class="grid two-col">
      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Today and every day</p>
            <h2>Care schedule</h2>
          </div>
          <button class="ghost" data-action="print">Export PDF</button>
        </div>
        <div class="routine-list">
          ${state.routines.map((routine) => `
            <div class="routine">
              <time>${routine.time}</time>
              <div>
                <strong>${routine.title}</strong>
                <span>${routine.owner} · ${routine.note}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </article>

      <article class="card ai-card">
        <p class="eyebrow">AI-ready safety helper</p>
        <h2>Ask about Phoenix</h2>
        <p>Future ChatGPT integration can answer with Phoenix's recent meals, vomiting log, stool notes, vaccines, weight trends, and training history.</p>
        <div class="prompt-box">“Phoenix threw up yellow again. Her last meal was skipped last night. What should we track and when should we call the vet?”</div>
        <p class="medical-note">Not a substitute for a veterinarian. Urgent red flags: repeated vomiting, blood, bloat, lethargy, dehydration, toxin exposure, severe pain, or appetite loss.</p>
      </article>
    </section>

    <section class="grid two-col align-start">
      <article class="card">
        <p class="eyebrow">Quick log</p>
        <h2>Add care note</h2>
        <form id="entry-form" class="entry-form">
          <label>Date<input name="date" type="date" value="${todayOffset(0)}" required /></label>
          <label>Time<input name="time" type="time" required /></label>
          <label>Category<select name="category">${Object.entries(careCategories).map(([key, category]) => `<option value="${key}">${category.icon} ${category.label}</option>`).join('')}</select></label>
          <label>Caregiver<input name="caregiver" placeholder="Me, girlfriend, sitter…" /></label>
          <label class="span-2">Title<input name="title" placeholder="Ate dinner, yellow bile vomit, dog park visit…" required /></label>
          <label class="span-2">Mood / anxiety<input name="mood" placeholder="Calm, anxious when alone, happy after walk…" /></label>
          <label class="span-2">Notes<textarea name="notes" rows="4" placeholder="Food amount, treats, stool, triggers, dogs met, training wins, vet questions…"></textarea></label>
          <button type="submit" class="primary span-2">Save Phoenix note</button>
        </form>
      </article>

      <article class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Timeline</p>
            <h2>Recent care calendar</h2>
          </div>
          <button class="ghost" data-action="reset">Reset demo</button>
        </div>
        <div class="timeline">
          ${Object.entries(groupedEntries).map(([date, entries]) => `
            <div class="day-group">
              <h3>${formatDate(date)}</h3>
              ${entries.map((entry) => entryCard(entry)).join('')}
            </div>
          `).join('')}
        </div>
      </article>
    </section>
  `;

  document.querySelector('#entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    state.entries.push(createEntry(data));
    saveState(state);
    render();
  });

  document.querySelector('[data-action="reset"]').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    render();
  });

  document.querySelector('[data-action="print"]').addEventListener('click', () => window.print());
}

function statCard(label, value, help) {
  return `<article class="card stat"><span>${label}</span><strong>${value}</strong><small>${help}</small></article>`;
}

function entryCard(entry) {
  const category = careCategories[entry.category] || careCategories.health;
  return `
    <div class="entry ${category.tone}">
      <span class="entry-icon">${category.icon}</span>
      <div>
        <div class="entry-top"><strong>${entry.title}</strong><time>${entry.time}</time></div>
        <p>${entry.caregiver} · ${entry.mood}</p>
        ${entry.notes ? `<small>${entry.notes}</small>` : ''}
      </div>
    </div>
  `;
}

if (typeof document !== 'undefined') {
  render();
}
