const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";

const EVENT_POOL = [
  { type: "beach", title: "Off-leash beach morning", time: "8:00 AM", weekend: true, note: "Cooler sand and calm crowds early. Bring fresh water and a towel." },
  { type: "hike", title: "Shaded trail sniff walk", time: "9:00 AM", weekend: true, note: "Low-traffic loop, good for a decompression walk at her own pace." },
  { type: "meetup", title: "Small-dog social hour", time: "10:30 AM", weekend: true, note: "Smaller groups keep anxious dogs comfortable. Watch body language." },
  { type: "playdate", title: "Neighborhood puppy playdate", time: "4:00 PM", weekend: false, note: "Calm, familiar dogs only — good low-pressure socialization." },
  { type: "training", title: "Calm leash skills class", time: "6:00 PM", weekend: false, note: "Positive-reinforcement group. Great for focus and confidence." },
  { type: "event", title: "Dog-friendly farmers market", time: "9:30 AM", weekend: true, note: "Leashed and busy — keep treats handy for neutral exposure." },
  { type: "grooming", title: "Pop-up wash & nail trim", time: "11:00 AM", weekend: true, note: "Quick self-wash station. Go early to avoid a wait." },
  { type: "meetup", title: "Shepherd & herding breed meetup", time: "5:30 PM", weekend: false, note: "Active breeds with similar energy — supervised play." },
  { type: "event", title: "Patio yappy hour", time: "5:00 PM", weekend: false, note: "Relaxed dog-friendly patio. A calm way to practice settling out." },
  { type: "hike", title: "Sunset ridge walk", time: "7:00 PM", weekend: false, note: "Quiet golden-hour route, fewer dogs, gentle exercise." },
];

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getWoofguideEventsStatus(env = process.env) {
  return { configured: Boolean(cleanText(env.OPENAI_API_KEY)), model: cleanText(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL };
}

function nextDateForOffset(base, dayOffset) {
  const d = new Date(base.getTime() + dayOffset * 86400000);
  return d.toISOString().slice(0, 10);
}

function isWeekend(isoDate) {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// Deterministic-ish local curation so the feature always works without any
// external events API. Spreads varied dog-friendly events across ~3 weeks.
export function buildLocalEvents({ location, profile } = {}) {
  const place = cleanText(location) || "your area";
  const now = new Date();
  const offsets = [2, 4, 6, 8, 11, 13, 16, 19];
  const chosen = [];
  const used = new Set();
  let poolIdx = Math.floor(now.getDate()) % EVENT_POOL.length;

  for (const offset of offsets) {
    if (chosen.length >= 6) break;
    const date = nextDateForOffset(now, offset);
    const weekend = isWeekend(date);
    // Find an event matching the day type, preferring unused ones.
    let pick = null;
    for (let i = 0; i < EVENT_POOL.length; i++) {
      const candidate = EVENT_POOL[(poolIdx + i) % EVENT_POOL.length];
      if (used.has(candidate.title)) continue;
      if (candidate.weekend === weekend) {
        pick = candidate;
        poolIdx = (poolIdx + i + 1) % EVENT_POOL.length;
        break;
      }
    }
    if (!pick) continue;
    used.add(pick.title);
    chosen.push({
      title: pick.title,
      type: pick.type,
      date,
      time: pick.time,
      location: place,
      note: pick.note,
    });
  }

  // Personalize a note toward the dog's care focus when available.
  const focus = cleanText(profile?.careFocus);
  if (focus && chosen[0]) {
    chosen[0] = { ...chosen[0], note: `${chosen[0].note} Aligns with: ${focus}` };
  }
  return chosen.slice(0, 6);
}

function safeParseEvents(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((e) => e && cleanText(e.title) && cleanText(e.date))
      .slice(0, 6)
      .map((e) => ({
        title: cleanText(e.title),
        type: cleanText(e.type) || "event",
        date: cleanText(e.date).slice(0, 10),
        time: cleanText(e.time) || undefined,
        location: cleanText(e.location) || cleanText(undefined),
        note: cleanText(e.note) || undefined,
      }));
  } catch {
    return null;
  }
}

export async function createWoofguideEvents({ location, profile, env = process.env, fetchImpl = globalThis.fetch }) {
  const apiKey = cleanText(env.OPENAI_API_KEY);
  // No key configured: always return curated local events.
  if (!apiKey || typeof fetchImpl !== "function") {
    return { events: buildLocalEvents({ location, profile }), mode: "local" };
  }

  const model = cleanText(env.OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const today = new Date().toISOString().slice(0, 10);
  const instructions = [
    "You are WoofGuide, curating upcoming dog-friendly outings for a single household dog.",
    "Generate plausible, realistic local events (beach mornings, trail walks, dog meetups, training classes, dog-friendly markets/patios, grooming pop-ups).",
    "These are inspirational suggestions, not bookings. Do not invent specific business names, addresses, phone numbers, or prices.",
    `Return STRICT JSON: an array of 5-6 objects with keys: title, type (one of beach,hike,meetup,playdate,training,event,grooming), date (YYYY-MM-DD, between ${today} and ~3 weeks out), time, location, note.`,
    "Tailor a couple of suggestions to the dog's care focus and temperament. Keep notes short, calm, and practical. Output JSON only.",
  ].join("\n");
  const input = [
    `Location: ${cleanText(location) || "the local area"}`,
    `Today: ${today}`,
    "Dog profile:",
    JSON.stringify(
      {
        name: cleanText(profile?.name),
        breed: cleanText(profile?.breed),
        careFocus: cleanText(profile?.careFocus),
        background: cleanText(profile?.background),
      },
      null,
      2,
    ),
  ].join("\n");

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, reasoning: { effort: "low" }, max_output_tokens: 700, instructions, input }),
    });
    if (!response.ok) {
      return { events: buildLocalEvents({ location, profile }), mode: "local" };
    }
    const body = await response.json().catch(() => null);
    const text =
      (typeof body?.output_text === "string" && body.output_text) ||
      (Array.isArray(body?.output)
        ? body.output
            .flatMap((o) => (Array.isArray(o.content) ? o.content : []))
            .map((p) => p.text || p.output_text || "")
            .join("\n")
        : "");
    const parsed = safeParseEvents(text);
    if (!parsed || parsed.length === 0) {
      return { events: buildLocalEvents({ location, profile }), mode: "local" };
    }
    const place = cleanText(location) || "your area";
    return {
      events: parsed.map((e) => ({ ...e, location: e.location || place })),
      mode: "openai",
    };
  } catch {
    return { events: buildLocalEvents({ location, profile }), mode: "local" };
  }
}
