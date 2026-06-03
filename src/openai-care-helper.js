const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export const CARE_HELPER_BOUNDARY =
  "For urgent symptoms, repeated vomiting, blood, lethargy, bloating, dehydration, toxin exposure, foreign-object concern, or not eating, contact a veterinarian or urgent care.";

export function isOpenAIConfigured(env = process.env) {
  return Boolean(cleanText(env.OPENAI_API_KEY));
}

export function getOpenAIStatus(env = process.env) {
  return {
    configured: isOpenAIConfigured(env),
    model: cleanText(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL,
    boundary: CARE_HELPER_BOUNDARY
  };
}

export async function createOpenAICareAnswer({ question, context, env = process.env, fetchImpl = globalThis.fetch }) {
  const apiKey = cleanText(env.OPENAI_API_KEY);
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.code = "missing_openai_key";
    throw error;
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available in this runtime.");
  }

  const model = cleanText(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const response = await fetchImpl(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      max_output_tokens: 420,
      instructions: buildCareHelperInstructions(),
      input: buildCareHelperInput({ question, context })
    })
  });

  const responseBody = await safeJson(response);
  if (!response.ok) {
    const message = responseBody?.error?.message || `OpenAI request failed with status ${response.status}.`;
    const error = new Error(message);
    error.code = "openai_request_failed";
    error.status = response.status;
    throw error;
  }

  const answer = ensureVeterinaryBoundary(extractOpenAIText(responseBody));
  return {
    answer,
    mode: "openai",
    model,
    requestId: response.headers?.get?.("x-request-id") || responseBody?.id || null
  };
}

export function buildCareHelperInstructions() {
  return [
    "You are WoofWatcher Care Helper for Phoenix, an anxious rescued female shepherd mix.",
    "Help Apollo and the other caregiver understand what to track, how to coordinate care, and when to seek veterinarian help.",
    "Use only the Phoenix context provided in the prompt. Do not invent medical history, vaccines, diagnoses, or treatments.",
    "Do not diagnose. Do not tell the caregivers to ignore urgent symptoms.",
    "Write in short, calm, practical paragraphs. Lead with what matters next.",
    `Always preserve this boundary: ${CARE_HELPER_BOUNDARY}`
  ].join("\n");
}

export function buildCareHelperInput({ question, context }) {
  const safeContext = compactAssistantContext(context);
  return [
    `Question: ${cleanText(question) || "What should we review for Phoenix today?"}`,
    "",
    "Phoenix context:",
    JSON.stringify(safeContext, null, 2)
  ].join("\n");
}

export function compactAssistantContext(context = {}) {
  const latest = Array.isArray(context.latest) ? context.latest : [];
  return {
    profile: compactProfile(context.profile),
    summary: compactPlainObject(context.summary),
    healthWatch: compactPlainObject(context.healthWatch),
    todayPlan: compactTodayPlan(context.todayPlan),
    latest: latest.slice(0, 5).map(compactEntry)
  };
}

export function extractOpenAIText(responseBody = {}) {
  if (typeof responseBody.output_text === "string" && responseBody.output_text.trim()) {
    return responseBody.output_text.trim();
  }

  const output = Array.isArray(responseBody.output) ? responseBody.output : [];
  const text = [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === "string") text.push(part.text);
      if (typeof part.output_text === "string") text.push(part.output_text);
    }
  }

  return text.join("\n").trim();
}

export function ensureVeterinaryBoundary(answer) {
  const clean = cleanText(answer);
  const fallback =
    "I can help summarize Phoenix's logged care context, but I cannot diagnose her. Track meals, timing, appetite, vomit events, stool, energy, and any red flags.";
  const base = clean || fallback;
  return /veterinarian|urgent care/i.test(base) ? base : `${base} ${CARE_HELPER_BOUNDARY}`;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function compactProfile(profile = {}) {
  return {
    name: cleanText(profile.name),
    breed: cleanText(profile.breed),
    background: cleanText(profile.background),
    careFocus: cleanText(profile.careFocus),
    weight: profile.weight || null,
    vetBoundary: cleanText(profile.vetBoundary)
  };
}

function compactTodayPlan(todayPlan = {}) {
  return {
    dateLabel: cleanText(todayPlan.dateLabel),
    completedCount: Number(todayPlan.completedCount) || 0,
    totalCount: Number(todayPlan.totalCount) || 0,
    nextItems: Array.isArray(todayPlan.nextItems)
      ? todayPlan.nextItems.slice(0, 3).map((item) => ({
          label: cleanText(item.label),
          time: cleanText(item.time),
          owner: cleanText(item.owner),
          note: cleanText(item.note)
        }))
      : [],
    handoffPrompt: cleanText(todayPlan.handoffPrompt)
  };
}

function compactEntry(entry = {}) {
  return {
    type: cleanText(entry.type),
    title: cleanText(entry.title),
    caregiver: cleanText(entry.caregiver),
    occurredAt: cleanText(entry.occurredAt),
    amount: cleanText(entry.amount),
    mood: cleanText(entry.mood),
    note: cleanText(entry.note),
    severity: cleanText(entry.severity),
    requiresFollowUp: Boolean(entry.requiresFollowUp)
  };
}

function compactPlainObject(value = {}) {
  return JSON.parse(JSON.stringify(value || {}));
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
