const ENTRY_TYPES = new Set([
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
]);
const GOAL_CATEGORIES = new Set(["weight", "training", "anxiety", "social", "health", "custom"]);
const GOAL_STATUSES = new Set(["active", "paused", "done"]);
const RECORD_TYPES = new Set(["vet", "vaccine", "weight", "instruction", "medication", "microchip"]);
const CARE_ROOM_TRANSFER_TYPE = "woofwatcher.care-room-transfer";

const TYPE_DEFAULT_TITLES = {
  meal: "Meal",
  treat: "Treat",
  walk: "Walk",
  park: "Dog park",
  training: "Training",
  social: "Social interaction",
  vomit: "Vomit incident",
  health: "Health note",
  vet: "Vet record",
  weight: "Weight check",
  medication: "Medication",
  note: "Care note"
};

export function getDefaultState(now = new Date().toISOString()) {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    profile: {
      name: "Phoenix",
      publicLabel: "Phoenix",
      breed: "German Shepherd / Belgian Shepherd mix",
      background: "Rescued over a year ago after being underweight and food anxious.",
      careFocus: "Keep routines calm, document appetite patterns, and prevent long empty-stomach windows.",
      weight: {
        current: 56.2,
        goal: "Slow, vet-guided weight gain and stable appetite",
        unit: "lb"
      },
      vetBoundary: "WoofWatcher tracks patterns for caregiver and veterinarian review. It is not a veterinary diagnosis."
    },
    caregivers: [
      { name: "Apollo", role: "Primary caregiver" },
      { name: "Girlfriend", role: "Primary caregiver" }
    ],
    routines: [
      {
        id: "routine_breakfast",
        label: "Breakfast",
        type: "meal",
        time: "7:30 AM",
        owner: "Whoever is up first",
        note: "Small calm meal; avoid pressure if Phoenix is anxious."
      },
      {
        id: "routine_morning_walk",
        label: "Morning walk",
        type: "walk",
        time: "8:15 AM",
        owner: "Apollo",
        note: "Decompress walk, sniffing encouraged."
      },
      {
        id: "routine_midday_check",
        label: "Midday check",
        type: "note",
        time: "12:30 PM",
        owner: "Either caregiver",
        note: "Water, mood, appetite, and anxiety check."
      },
      {
        id: "routine_dinner",
        label: "Dinner",
        type: "meal",
        time: "6:30 PM",
        owner: "Either caregiver",
        note: "Document amount and whether she needed company to eat."
      },
      {
        id: "routine_evening_walk",
        label: "Evening walk",
        type: "walk",
        time: "8:15 PM",
        owner: "Whoever is home",
        note: "Short settling walk before bedtime."
      },
      {
        id: "routine_bedtime_snack",
        label: "Bedtime snack",
        type: "treat",
        time: "10:00 PM",
        owner: "Either caregiver",
        note: "Small snack may help reduce empty-stomach bile mornings."
      }
    ],
    goals: [
      {
        id: "goal_weight_stability",
        category: "weight",
        title: "Stable weight gain",
        target: "Move toward 58 lb with vet-guided pacing",
        status: "active",
        due: "Monthly",
        note: "Use gentle trend tracking; do not force sudden food changes."
      },
      {
        id: "goal_place_work",
        category: "training",
        title: "Calm place work",
        target: "Three short calm sessions per week",
        status: "active",
        due: "Weekly",
        note: "Track whether she settles faster when food or visitors are involved."
      },
      {
        id: "goal_social_neutrality",
        category: "social",
        title: "Neutral dog exposure",
        target: "Calm, low-pressure interactions",
        status: "active",
        due: "Ongoing",
        note: "Log dog park visits and sidewalk passes with mood notes."
      }
    ],
    records: [
      {
        id: "record_vet_baseline",
        type: "vet",
        title: "Next vet discussion",
        due: "Next regular appointment",
        note: "Mention occasional yellow bile vomiting, appetite anxiety, weight goal, and any frequency changes."
      },
      {
        id: "record_weight_goal",
        type: "weight",
        title: "Weight goal",
        due: "Monthly",
        note: "Track weight trend gently; avoid aggressive feeding changes without vet guidance."
      },
      {
        id: "record_vaccines",
        type: "vaccine",
        title: "Vaccine records",
        due: "Add dates",
        note: "Store rabies, DHPP, Bordetella, and any clinic notes here."
      }
    ],
    entries: [
      createEntry({
        type: "meal",
        title: "Breakfast",
        caregiver: "Apollo",
        amount: "1 cup",
        mood: "settled",
        note: "Ate after a calm start.",
        occurredAt: shiftIso(now, -7)
      }),
      createEntry({
        type: "walk",
        title: "Morning walk",
        caregiver: "Apollo",
        durationMinutes: 22,
        note: "Loose leash, sniffed calmly.",
        occurredAt: shiftIso(now, -6)
      }),
      createEntry({
        type: "training",
        title: "Place work",
        caregiver: "Girlfriend",
        durationMinutes: 10,
        mood: "engaged",
        note: "Held place while food was prepared.",
        occurredAt: shiftIso(now, -5)
      }),
      createEntry({
        type: "vomit",
        title: "Yellow bile",
        caregiver: "Apollo",
        severity: "watch",
        note: "Small amount before breakfast. Normal energy after.",
        occurredAt: shiftIso(now, -4)
      })
    ]
  };
}

export function normalizeState(input = {}, now = new Date().toISOString()) {
  const source = unwrapTransferState(input);
  const defaults = getDefaultState(source.createdAt || now);
  const profile = typeof source.profile === "object" && source.profile ? source.profile : {};
  const weight = typeof profile.weight === "object" && profile.weight ? profile.weight : {};

  return {
    ...defaults,
    ...compactObject(source),
    version: 1,
    profile: {
      ...defaults.profile,
      ...compactObject(profile),
      weight: {
        ...defaults.profile.weight,
        ...compactObject(weight)
      }
    },
    caregivers: Array.isArray(source.caregivers) && source.caregivers.length ? source.caregivers.map(normalizeCaregiver) : defaults.caregivers,
    routines: Array.isArray(source.routines) ? sortRoutines(source.routines.map(normalizeRoutineInput)) : defaults.routines,
    goals: Array.isArray(source.goals) ? sortGoals(source.goals.map(normalizeGoalInput)) : defaults.goals,
    records: Array.isArray(source.records) ? source.records.map(normalizeRecordInput) : defaults.records,
    entries: Array.isArray(source.entries) ? source.entries.map(normalizeImportedEntry) : defaults.entries,
    updatedAt: now
  };
}

export function normalizeCaregiverInput(input = {}) {
  return normalizeCaregiver(input);
}

export function upsertCaregiverProfile(state = {}, previousName = "", input = {}, now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const previous = cleanText(previousName);
  const caregiver = normalizeCaregiver(input);
  const target = previous || caregiver.name;
  let replaced = false;

  const caregivers = (normalized.caregivers || []).map((item) => {
    const existing = normalizeCaregiver(item);
    if (namesEqual(existing.name, target)) {
      replaced = true;
      return caregiver;
    }
    return existing;
  });

  if (!replaced) caregivers.push(caregiver);

  const shouldMigrate = previous && !namesEqual(previous, caregiver.name);
  return normalizeState(
    {
      ...normalized,
      caregivers: dedupeCaregivers(caregivers),
      routines: shouldMigrate ? replaceRoutineOwner(normalized.routines, previous, caregiver.name) : normalized.routines,
      entries: shouldMigrate ? replaceEntryCaregiver(normalized.entries, previous, caregiver.name) : normalized.entries
    },
    now
  );
}

export function removeCaregiverProfile(state = {}, caregiverName = "", now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  const target = cleanText(caregiverName);
  if (!target) return normalized;

  const caregivers = (normalized.caregivers || []).filter((caregiver) => !namesEqual(caregiver.name, target));
  return normalizeState(
    {
      ...normalized,
      caregivers: caregivers.length ? caregivers : normalized.caregivers,
      routines: replaceRoutineOwner(normalized.routines, target, "Either caregiver")
    },
    now
  );
}

export function normalizeEntryInput(input = {}) {
  const type = ENTRY_TYPES.has(input.type) ? input.type : "note";
  const title = cleanText(input.title) || TYPE_DEFAULT_TITLES[type] || "Care note";
  const occurredAt = normalizeDate(input.occurredAt);
  const severity = ["normal", "watch", "urgent"].includes(input.severity) ? input.severity : "normal";

  return {
    type,
    title,
    caregiver: cleanText(input.caregiver) || "Unassigned",
    occurredAt,
    durationMinutes: clampWholeNumber(input.durationMinutes),
    dogInteractions: clampWholeNumber(input.dogInteractions),
    amount: cleanText(input.amount),
    mood: cleanText(input.mood),
    note: cleanText(input.note),
    severity
  };
}

export function normalizeRoutineInput(input = {}) {
  const type = ENTRY_TYPES.has(input.type) ? input.type : "note";
  const label = cleanText(input.label) || TYPE_DEFAULT_TITLES[type] || "Care routine";
  const time = cleanText(input.time) || "Unscheduled";
  return {
    id: cleanText(input.id) || makeRoutineId({ type, label, time }),
    label,
    type,
    time,
    owner: cleanText(input.owner) || "Either caregiver",
    note: cleanText(input.note)
  };
}

export function upsertRoutine(routines = [], input = {}) {
  const routine = normalizeRoutineInput(input);
  const existing = Array.isArray(routines) ? routines : [];
  const replaced = existing.some((item) => item.id === routine.id);
  const next = replaced ? existing.map((item) => (item.id === routine.id ? routine : normalizeRoutineInput(item))) : [...existing.map(normalizeRoutineInput), routine];
  return sortRoutines(next);
}

export function removeRoutine(routines = [], routineId = "") {
  const target = cleanText(routineId);
  return sortRoutines((Array.isArray(routines) ? routines : []).filter((routine) => routine.id !== target).map(normalizeRoutineInput));
}

export function normalizeGoalInput(input = {}) {
  const category = GOAL_CATEGORIES.has(input.category) ? input.category : "custom";
  const title = cleanText(input.title) || "Care goal";
  return {
    id: cleanText(input.id) || makeGoalId({ category, title }),
    category,
    title,
    target: cleanText(input.target) || "Define target",
    status: GOAL_STATUSES.has(input.status) ? input.status : "active",
    due: cleanText(input.due) || "No date set",
    note: cleanText(input.note)
  };
}

export function upsertGoal(goals = [], input = {}) {
  const goal = normalizeGoalInput(input);
  const existing = Array.isArray(goals) ? goals : [];
  const replaced = existing.some((item) => item.id === goal.id);
  const next = replaced ? existing.map((item) => (item.id === goal.id ? goal : normalizeGoalInput(item))) : [...existing.map(normalizeGoalInput), goal];
  return sortGoals(next);
}

export function removeGoal(goals = [], goalId = "") {
  const target = cleanText(goalId);
  return sortGoals((Array.isArray(goals) ? goals : []).filter((goal) => goal.id !== target).map(normalizeGoalInput));
}

export function normalizeRecordInput(input = {}) {
  const type = RECORD_TYPES.has(input.type) ? input.type : "instruction";
  const title = cleanText(input.title) || "Care record";
  return {
    id: cleanText(input.id) || makeRecordId({ type, title }),
    type,
    title,
    due: cleanText(input.due) || "No date set",
    note: cleanText(input.note)
  };
}

export function upsertRecord(records = [], input = {}) {
  const record = normalizeRecordInput(input);
  const existing = Array.isArray(records) ? records : [];
  const replaced = existing.some((item) => item.id === record.id);
  return replaced ? existing.map((item) => (item.id === record.id ? record : normalizeRecordInput(item))) : [record, ...existing.map(normalizeRecordInput)];
}

export function removeRecord(records = [], recordId = "") {
  const target = cleanText(recordId);
  return (Array.isArray(records) ? records : []).filter((record) => record.id !== target).map(normalizeRecordInput);
}

export function createEntry(input = {}) {
  const draft = normalizeEntryInput(input);
  return {
    id: makeEntryId(draft),
    ...draft,
    requiresFollowUp: requiresFollowUp(draft),
    vetDisclaimer:
      "Pattern tracking only. Contact a veterinarian for diagnosis, treatment, worsening symptoms, or urgent red flags."
  };
}

export function getMonthlySummary(state, now = new Date().toISOString()) {
  const date = new Date(now);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const entries = (state.entries || []).filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred < end;
  });

  return {
    monthLabel: date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    totalEntries: entries.length,
    meals: countType(entries, "meal"),
    treats: countType(entries, "treat"),
    walks: countType(entries, "walk"),
    walkMinutes: sumNumber(entries, "walk", "durationMinutes"),
    parkVisits: countType(entries, "park"),
    socialSessions: countType(entries, "social") + countType(entries, "park"),
    dogInteractions: sumAll(entries, "dogInteractions"),
    trainingSessions: countType(entries, "training"),
    trainingMinutes: sumNumber(entries, "training", "durationMinutes"),
    vomitIncidents: countType(entries, "vomit"),
    healthNotes: countType(entries, "health"),
    vetRecords: countType(entries, "vet"),
    weightChecks: countType(entries, "weight"),
    followUps: entries.filter((entry) => entry.requiresFollowUp).length,
    caregivers: [...new Set(entries.map((entry) => entry.caregiver).filter(Boolean))]
  };
}

export function getCareCalendar(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const year = target.getFullYear();
  const month = target.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEntries = entriesForCalendarMonth(state.entries || [], year, month);
  const todayKey = formatDateKey(target);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const dateKey = formatDateKey(date);
    const entries = monthEntries
      .filter((entry) => formatDateKey(new Date(entry.occurredAt)) === dateKey)
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
    const counts = getDayCounts(entries);
    const needsReview = entries.some((entry) => entry.requiresFollowUp || entry.severity === "urgent");
    return {
      day: index + 1,
      dateKey,
      isToday: dateKey === todayKey,
      totalEntries: entries.length,
      counts,
      status: needsReview ? "review" : entries.length ? "active" : "empty",
      summary: buildDaySummary(counts),
      entries
    };
  });

  return {
    monthLabel: firstDay.toLocaleString("en-US", { month: "long", year: "numeric" }),
    year,
    month,
    firstWeekday: firstDay.getDay(),
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthTotals: {
      ...getMonthlySummary({ ...state, entries: monthEntries }, now),
      totalEntries: monthEntries.length
    },
    reviewDays: days.filter((day) => day.status === "review").length,
    vomitDays: days.filter((day) => day.counts.vomit > 0).length,
    activeDays: days.filter((day) => day.totalEntries > 0).length,
    days
  };
}

export function getTodayPlan(state, now = new Date().toISOString()) {
  const todayEntries = entriesForLocalDay(state.entries || [], now);
  const completedLabels = (state.routines || [])
    .filter((routine) => todayEntries.some((entry) => routineMatchesEntry(routine, entry)))
    .map((routine) => routine.label);

  const nextItems = (state.routines || []).filter((routine) => !completedLabels.includes(routine.label));

  return {
    dateLabel: new Date(now).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    }),
    completedLabels,
    nextItems,
    completedCount: completedLabels.length,
    totalCount: (state.routines || []).length,
    handoffPrompt:
      "Before assuming Phoenix is covered, check who fed, walked, trained, or noticed symptoms today."
  };
}

export function getCaregiverHandoff(state, now = new Date().toISOString()) {
  const plan = getTodayPlan(state, now);
  const todayEntries = entriesForLocalDay(state.entries || [], now).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const lastMeal = todayEntries.find((entry) => entry.type === "meal") || null;
  const lastWalk = todayEntries.find((entry) => entry.type === "walk") || null;
  const followUps = todayEntries.filter((entry) => entry.requiresFollowUp || entry.severity === "urgent");
  const nextRoutine = plan.nextItems[0] || null;
  const caregiverLoad = (state.caregivers || []).map((caregiver) => {
    const name = cleanText(caregiver.name) || "Unassigned";
    const logs = todayEntries.filter((entry) => entryMatchesCaregiver(entry, name));
    const latest = logs[0] || null;
    return {
      name,
      role: cleanText(caregiver.role) || "Caregiver",
      todayLogs: logs.length,
      latestAction: latest ? `${latest.title} at ${formatDateTime(latest.occurredAt)}` : "No logs today"
    };
  });

  return {
    dateLabel: plan.dateLabel,
    completedCount: plan.completedCount,
    totalCount: plan.totalCount,
    nextRoutine,
    lastMeal,
    lastWalk,
    followUps,
    caregiverLoad,
    message: buildHandoffMessage({ nextRoutine, lastMeal, lastWalk, followUps })
  };
}

export function getHealthWatch(state, now = new Date().toISOString()) {
  const recent = entriesWithinDays(state.entries || [], now, 14);
  const vomitCount = countType(recent, "vomit");
  const refusedMeals = recent.filter((entry) => entry.type === "meal" && /refus|skip|would not|did not/i.test(entry.mood || entry.note || "")).length;
  const urgentEntries = recent.filter((entry) => entry.severity === "urgent");
  const signals = [];
  const redFlags = [
    "Urgent red flags include repeated vomiting in one day, blood, black or tarry stool, lethargy, bloating, belly pain, dehydration, toxin exposure, foreign-object concern, or not eating."
  ];

  if (vomitCount > 0) signals.push(`${vomitCount} vomit incidents logged in the last 14 days.`);
  if (refusedMeals > 0) signals.push(`${refusedMeals} refused or skipped meal pattern logged.`);
  if (urgentEntries.length > 0) signals.push(`${urgentEntries.length} urgent health entries need review.`);

  const status = vomitCount >= 2 || refusedMeals > 0 || urgentEntries.length > 0 ? "review" : vomitCount === 1 ? "watch" : "steady";

  if (status === "review") {
    redFlags.unshift("Because repeated vomiting or appetite disruption is logged, review the pattern and contact a veterinarian if it repeats, worsens, or comes with any red flag.");
  }

  return {
    status,
    label: status === "steady" ? "Steady" : status === "watch" ? "Watch" : "Review",
    signals: signals.length ? signals : ["No recent vomit, appetite refusal, or urgent health flags logged."],
    redFlags
  };
}

export function getGoalReview(state, now = new Date().toISOString()) {
  const goals = sortGoals((state.goals || []).map(normalizeGoalInput));
  const active = goals.filter((goal) => goal.status === "active");
  const done = goals.filter((goal) => goal.status === "done");
  const monthEntries = entriesForCurrentMonth(state.entries || [], now);
  const latestWeight = latestWeightEntry(state.entries || []);
  const trainingEntries = monthEntries.filter((entry) => entry.type === "training");
  const socialEntries = monthEntries.filter((entry) => entry.type === "social" || entry.type === "park");
  const review = {
    totalGoals: goals.length,
    activeGoals: active.length,
    completedGoals: done.length,
    goals,
    weight: {
      current: latestWeight?.weight ?? null,
      label: latestWeight ? `${latestWeight.weight} lb logged ${formatDateTime(latestWeight.entry.occurredAt)}` : "No weight check logged yet"
    },
    training: {
      sessions: trainingEntries.length,
      minutes: sumAll(trainingEntries, "durationMinutes")
    },
    social: {
      sessions: socialEntries.length,
      interactions: sumAll(socialEntries, "dogInteractions")
    },
    highlights: []
  };

  if (review.weight.current !== null) review.highlights.push(`Latest weight trend: ${review.weight.current} lb.`);
  review.highlights.push(`Training this month: ${review.training.sessions} sessions, ${review.training.minutes} minutes.`);
  review.highlights.push(`Social exposure this month: ${review.social.sessions} sessions, ${review.social.interactions} dog interactions.`);
  if (!active.length) review.highlights.push("No active goals are set.");
  return review;
}

export function getTrainingProgress(state, now = new Date().toISOString()) {
  const target = new Date(now);
  const monthEntries = entriesForCurrentMonth(state.entries || [], now);
  const trainingEntries = monthEntries.filter((entry) => entry.type === "training");
  const socialEntries = monthEntries.filter((entry) => entry.type === "social" || entry.type === "park");
  const progressEntries = [...trainingEntries, ...socialEntries].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  const calmEntries = progressEntries.filter(hasCalmSignal);
  const struggleEntries = progressEntries.filter(hasStruggleSignal);
  const status = progressEntries.length === 0 ? "Needs logs" : struggleEntries.length > 0 ? "Building" : "Steady";

  return {
    monthLabel: target.toLocaleString("en-US", { month: "long", year: "numeric" }),
    status,
    training: {
      sessions: trainingEntries.length,
      minutes: sumAll(trainingEntries, "durationMinutes")
    },
    social: {
      sessions: socialEntries.length,
      dogInteractions: sumAll(socialEntries, "dogInteractions")
    },
    calmSignals: calmEntries.length,
    struggleSignals: struggleEntries.length,
    wins: buildProgressWins(calmEntries),
    focusAreas: buildProgressFocusAreas(struggleEntries, progressEntries),
    recentEntries: progressEntries.slice(0, 6)
  };
}

export function buildReportText(state, now = new Date().toISOString()) {
  const profile = state.profile || { name: "Phoenix" };
  const summary = getMonthlySummary(state, now);
  const healthWatch = getHealthWatch(state, now);
  const goalReview = getGoalReview(state, now);
  const trainingProgress = getTrainingProgress(state, now);
  const latest = [...(state.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 8);

  return [
    "WoofWatcher Monthly Report",
    `${profile.name} - ${summary.monthLabel}`,
    "",
    "Summary",
    `Meals logged: ${summary.meals}`,
    `Treats logged: ${summary.treats}`,
    `Walks: ${summary.walks} (${summary.walkMinutes} minutes)`,
    `Training sessions: ${summary.trainingSessions} (${summary.trainingMinutes} minutes)`,
    `Social sessions: ${summary.socialSessions}`,
    `Dog interactions: ${summary.dogInteractions}`,
    `Vomit incidents: ${summary.vomitIncidents}`,
    `Follow-ups flagged: ${summary.followUps}`,
    "",
    "Health Watch",
    `Status: ${healthWatch.label}`,
    ...healthWatch.signals.map((signal) => `- ${signal}`),
    "",
    "Goal Review",
    `Active goals: ${goalReview.activeGoals}/${goalReview.totalGoals}`,
    ...goalReview.highlights.map((highlight) => `- ${highlight}`),
    "",
    "Training Progress",
    `Status: ${trainingProgress.status}`,
    `Training: ${trainingProgress.training.sessions} sessions, ${trainingProgress.training.minutes} minutes`,
    `Social exposure: ${trainingProgress.social.sessions} sessions, ${trainingProgress.social.dogInteractions} dog interactions`,
    `Calm signals: ${trainingProgress.calmSignals}`,
    `Struggle signals: ${trainingProgress.struggleSignals}`,
    "Wins",
    ...trainingProgress.wins.map((win) => `- ${win}`),
    "Focus areas",
    ...trainingProgress.focusAreas.map((focus) => `- ${focus}`),
    "",
    "Recent Care Timeline",
    ...latest.map((entry) => `- ${formatDateTime(entry.occurredAt)} | ${entry.type.toUpperCase()} | ${entry.title} | ${entry.caregiver}${entry.note ? ` | ${entry.note}` : ""}`),
    "",
    "Boundary",
    "This report is pattern tracking for caregiver and veterinarian review. It is not a veterinary diagnosis."
  ].join("\n");
}

export function buildCareRoomTransfer(state, now = new Date().toISOString()) {
  const normalized = normalizeState(state, now);
  return {
    packageType: CARE_ROOM_TRANSFER_TYPE,
    version: 1,
    createdAt: now,
    petName: normalized.profile.name,
    importNote: "Import this file in WoofWatcher to continue Phoenix care from the same local state.",
    handoff: getCaregiverHandoff(normalized, now),
    monthlySummary: getMonthlySummary(normalized, now),
    healthWatch: getHealthWatch(normalized, now),
    monthlyReport: buildReportText(normalized, now),
    state: normalized
  };
}

export function getAssistantContext(state, question = "", now = new Date().toISOString()) {
  const summary = getMonthlySummary(state, now);
  const healthWatch = getHealthWatch(state, now);
  const todayPlan = getTodayPlan(state, now);
  const handoff = getCaregiverHandoff(state, now);
  const latest = [...(state.entries || [])]
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
    .slice(0, 5);

  return {
    question: cleanText(question),
    profile: state.profile,
    summary,
    healthWatch,
    todayPlan,
    handoff,
    latest,
    localAnswer: buildLocalAssistantAnswer({ question, summary, healthWatch, todayPlan, handoff, latest })
  };
}

function buildLocalAssistantAnswer({ question, summary, healthWatch, todayPlan, handoff, latest }) {
  const asksVomiting = /vomit|throw|bile|yellow|nausea/i.test(question);
  const lines = [];

  if (asksVomiting) {
    lines.push("Phoenix has a vomit pattern worth tracking closely. Yellow bile often appears when a dog has an empty stomach, but WoofWatcher should treat it as a pattern for vet review, not a diagnosis.");
  } else {
    lines.push("Phoenix's care picture is built from today's routine, logged meals, walks, training, social exposure, and health notes.");
  }

  lines.push(`This month: ${summary.meals} meals, ${summary.walks} walks, ${summary.trainingSessions} training sessions, ${summary.vomitIncidents} vomit incidents.`);
  lines.push(`Health watch is ${healthWatch.label.toLowerCase()}: ${healthWatch.signals[0]}`);
  lines.push(`Today completed: ${todayPlan.completedCount}/${todayPlan.totalCount}. Next: ${todayPlan.nextItems[0]?.label || "routine covered"}.`);
  lines.push(`Handoff: ${handoff.message}`);

  if (latest[0]) {
    lines.push(`Latest log: ${latest[0].title} by ${latest[0].caregiver}.`);
  }

  lines.push("For urgent symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, or not eating, contact a veterinarian or urgent care.");
  return lines.join(" ");
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined && item !== null));
}

function unwrapTransferState(input = {}) {
  if (input.packageType === CARE_ROOM_TRANSFER_TYPE && typeof input.state === "object" && input.state) {
    return input.state;
  }
  return input;
}

function normalizeCaregiver(caregiver = {}) {
  return {
    name: cleanText(caregiver.name) || "Unassigned",
    role: cleanText(caregiver.role) || "Caregiver"
  };
}

function dedupeCaregivers(caregivers = []) {
  const byName = new Map();
  for (const caregiver of caregivers.map(normalizeCaregiver)) {
    byName.set(caregiver.name.toLowerCase(), caregiver);
  }
  return [...byName.values()];
}

function replaceRoutineOwner(routines = [], previousName = "", nextName = "") {
  return (routines || []).map((routine) => {
    const normalized = normalizeRoutineInput(routine);
    return namesEqual(normalized.owner, previousName) ? { ...normalized, owner: nextName } : normalized;
  });
}

function replaceEntryCaregiver(entries = [], previousName = "", nextName = "") {
  return (entries || []).map((entry) => {
    const normalized = normalizeImportedEntry(entry);
    return namesEqual(normalized.caregiver, previousName) ? { ...normalized, caregiver: nextName } : normalized;
  });
}

function namesEqual(left = "", right = "") {
  return cleanText(left).toLowerCase() === cleanText(right).toLowerCase();
}

function normalizeImportedEntry(entry = {}) {
  const normalized = createEntry(entry);
  return {
    ...normalized,
    id: cleanText(entry.id) || normalized.id
  };
}

function hasCalmSignal(entry) {
  return /calm|settled|engaged|neutral|held|loose|relax|confident/i.test(progressText(entry));
}

function hasStruggleSignal(entry) {
  return /anxious|bark|react|lung|pull|tense|stress|overwhelm|scared|refus|guard/i.test(progressText(entry));
}

function buildProgressWins(entries) {
  if (!entries.length) return ["No calm training or social wins logged yet this month."];
  return sortProgressWins(entries)
    .slice(0, 3)
    .map((entry) => `${entry.title}: ${cleanText(entry.note || entry.mood || "calm progress logged")}`);
}

function buildProgressFocusAreas(struggleEntries, progressEntries) {
  if (struggleEntries.length) {
    return sortProgressWins(struggleEntries)
      .slice(0, 3)
      .map((entry) => `${entry.title}: keep this short, low-pressure, and log what helped Phoenix recover.`);
  }

  if (!progressEntries.length) {
    return ["Log one short training session and one low-pressure social exposure to establish a baseline."];
  }

  return ["Keep repeating the calm patterns that worked, and log duration, mood, dog interactions, and recovery time."];
}

function progressText(entry) {
  return `${entry.title || ""} ${entry.mood || ""} ${entry.note || ""}`;
}

function sortProgressWins(entries) {
  return [...entries].sort((a, b) => {
    const left = a.type === "training" ? 0 : 1;
    const right = b.type === "training" ? 0 : 1;
    if (left !== right) return left - right;
    return new Date(b.occurredAt) - new Date(a.occurredAt);
  });
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clampWholeNumber(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function requiresFollowUp(entry) {
  return entry.type === "vomit" || entry.severity === "urgent";
}

function entryMatchesCaregiver(entry, caregiverName) {
  const entryCaregiver = cleanText(entry.caregiver).toLowerCase();
  const name = cleanText(caregiverName).toLowerCase();
  return entryCaregiver === name || entryCaregiver === "both";
}

function buildHandoffMessage({ nextRoutine, lastMeal, lastWalk, followUps }) {
  const lines = [];
  if (nextRoutine) {
    lines.push(`Next Phoenix care: ${nextRoutine.label} at ${nextRoutine.time} (${nextRoutine.owner}).`);
  } else {
    lines.push("Next Phoenix care: today's routine is covered.");
  }

  if (lastMeal) {
    lines.push(`Last meal: ${lastMeal.title} by ${lastMeal.caregiver} at ${formatDateTime(lastMeal.occurredAt)}.`);
  } else {
    lines.push("No meals logged today.");
  }

  if (lastWalk) {
    lines.push(`Last walk: ${lastWalk.title} by ${lastWalk.caregiver} at ${formatDateTime(lastWalk.occurredAt)}.`);
  } else {
    lines.push("No walks logged today.");
  }

  if (followUps.length) {
    lines.push(`Follow-up: ${followUps[0].title} needs review${followUps.length > 1 ? `, plus ${followUps.length - 1} more` : ""}.`);
  } else {
    lines.push("No active follow-ups logged today.");
  }

  return lines.join(" ");
}

function makeEntryId(entry) {
  const stamp = new Date(entry.occurredAt).getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `entry_${entry.type}_${stamp}_${rand}`;
}

function makeRoutineId(routine) {
  const label = cleanText(routine.label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `routine_${routine.type}_${label || "care"}_${suffix}`;
}

function makeGoalId(goal) {
  const title = cleanText(goal.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `goal_${goal.category}_${title || "care"}_${suffix}`;
}

function makeRecordId(record) {
  const title = cleanText(record.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `record_${record.type}_${title || "care"}_${suffix}`;
}

function sortGoals(goals = []) {
  const statusOrder = { active: 0, paused: 1, done: 2 };
  return [...goals].sort((a, b) => {
    const leftStatus = statusOrder[a.status] ?? 9;
    const rightStatus = statusOrder[b.status] ?? 9;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    return a.title.localeCompare(b.title);
  });
}

function sortRoutines(routines = []) {
  return [...routines].sort((a, b) => {
    const left = routineSortMinutes(a.time);
    const right = routineSortMinutes(b.time);
    if (left !== right) return left - right;
    return a.label.localeCompare(b.label);
  });
}

function routineSortMinutes(value) {
  const text = cleanText(value);
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();
  if (hour === 12) hour = 0;
  if (meridiem === "PM") hour += 12;
  return hour * 60 + minute;
}

function countType(entries, type) {
  return entries.filter((entry) => entry.type === type).length;
}

function sumNumber(entries, type, field) {
  return entries.filter((entry) => entry.type === type).reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
}

function sumAll(entries, field) {
  return entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);
}

function getDayCounts(entries) {
  return {
    meals: countType(entries, "meal"),
    treats: countType(entries, "treat"),
    walks: countType(entries, "walk"),
    walkMinutes: sumNumber(entries, "walk", "durationMinutes"),
    parkVisits: countType(entries, "park"),
    training: countType(entries, "training"),
    trainingMinutes: sumNumber(entries, "training", "durationMinutes"),
    social: countType(entries, "social"),
    dogInteractions: sumAll(entries, "dogInteractions"),
    vomit: countType(entries, "vomit"),
    health: countType(entries, "health"),
    vet: countType(entries, "vet"),
    weight: countType(entries, "weight"),
    medication: countType(entries, "medication"),
    followUps: entries.filter((entry) => entry.requiresFollowUp).length
  };
}

function buildDaySummary(counts) {
  const parts = [];
  if (counts.meals) parts.push(`${counts.meals} meal${counts.meals === 1 ? "" : "s"}`);
  if (counts.walks) parts.push(`${counts.walks} walk${counts.walks === 1 ? "" : "s"}`);
  if (counts.training) parts.push(`${counts.training} training`);
  if (counts.parkVisits || counts.social) parts.push(`${counts.parkVisits + counts.social} social`);
  if (counts.vomit) parts.push(`${counts.vomit} vomit`);
  if (counts.weight) parts.push(`${counts.weight} weight`);
  if (counts.medication) parts.push(`${counts.medication} medication`);
  if (counts.health || counts.vet) parts.push(`${counts.health + counts.vet} health`);
  return parts.length ? parts.join(" | ") : "No logs";
}

function entriesForLocalDay(entries, now) {
  const target = new Date(now);
  return entries.filter((entry) => {
    const date = new Date(entry.occurredAt);
    return (
      date.getFullYear() === target.getFullYear() &&
      date.getMonth() === target.getMonth() &&
      date.getDate() === target.getDate()
    );
  });
}

function entriesForCalendarMonth(entries, year, month) {
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred.getFullYear() === year && occurred.getMonth() === month;
  });
}

function entriesForCurrentMonth(entries, now) {
  const date = new Date(now);
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred.getFullYear() === date.getFullYear() && occurred.getMonth() === date.getMonth();
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function entriesWithinDays(entries, now, days) {
  const end = new Date(now);
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const occurred = new Date(entry.occurredAt);
    return occurred >= start && occurred <= end;
  });
}

function latestWeightEntry(entries) {
  const weighted = entries
    .filter((entry) => entry.type === "weight")
    .map((entry) => ({ entry, weight: parseWeight(entry.amount || entry.note || entry.title) }))
    .filter((item) => item.weight !== null)
    .sort((a, b) => new Date(b.entry.occurredAt) - new Date(a.entry.occurredAt));
  return weighted[0] || null;
}

function parseWeight(value) {
  const match = cleanText(value).match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function routineMatchesEntry(routine, entry) {
  const routineLabel = routine.label.toLowerCase();
  const title = entry.title.toLowerCase();
  const note = String(entry.note || "").toLowerCase();
  return title === routineLabel || title.includes(routineLabel) || note.includes(routineLabel);
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function shiftIso(value, hours) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}
