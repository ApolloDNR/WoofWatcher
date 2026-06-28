export type AdventureQuestStatus = "available" | "complete" | "locked";
export type AdventureModeStatus = "needs-outing" | "quest-ready" | "memory-ready";
export type AdventureMemoryStorageStatus = "local-draft" | "provider-ready" | "provider-saved";
export type AdventureMemoryMediaStatus = "no-photo-yet" | "local-photo" | "provider-photo";
export type AdventureQuestAction = "start-walk" | "log-training" | "log-play" | "save-memory";

export interface AdventureEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  mood?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
}

export interface AdventureMemory {
  id: string;
  petName: string;
  questId: string;
  title: string;
  note: string;
  createdAt: string;
  humans: string[];
  xp: number;
  storageStatus: AdventureMemoryStorageStatus;
  mediaStatus: AdventureMemoryMediaStatus;
  photoUri?: string;
}

export interface AdventureInput {
  petName?: string | null;
  entries?: readonly AdventureEntry[] | null;
  memories?: readonly AdventureMemory[] | null;
  now?: number;
}

export interface AdventureQuest {
  id: string;
  title: string;
  prompt: string;
  rewardXp: number;
  status: AdventureQuestStatus;
  action: AdventureQuestAction;
  actionLabel: string;
  evidence: string;
  safetyNote: string;
}

export interface AdventureProof {
  entryId: string;
  label: string;
  xp: number;
  occurredAt: string;
}

export interface AdventureMode {
  status: AdventureModeStatus;
  petName: string;
  title: string;
  summary: string;
  nextStep: string;
  privacyBoundary: string;
  todayXp: number;
  level: number;
  memoriesCount: number;
  completedProof: AdventureProof[];
  quests: AdventureQuest[];
  memories: AdventureMemory[];
}

export interface AdventureMemoryDraftInput {
  petName?: string | null;
  questId?: string | null;
  title?: string | null;
  note?: string | null;
  humans?: readonly string[] | null;
  photoUri?: string | null;
  nowIso?: string;
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function isSameLocalDay(iso: string, now: number): boolean {
  const d = new Date(iso);
  const n = new Date(now);
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function visible(entry: AdventureEntry): boolean {
  return entry.details?.householdVisible !== false;
}

function normalizedType(entry: AdventureEntry): string {
  return clean(entry.type).toLowerCase();
}

function duration(entry: AdventureEntry): number {
  const value = Number(entry.durationMinutes);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function entryXp(entry: AdventureEntry): number {
  const type = normalizedType(entry);
  if (type === "walk") return Math.min(duration(entry), 45);
  if (type === "training") return Math.max(8, Math.min(duration(entry) * 2, 30));
  if (type === "play") return Math.max(6, Math.min(duration(entry), 20));
  if (type === "alone") return 8;
  return 0;
}

function proofLabel(entry: AdventureEntry): string {
  const title = clean(entry.title);
  if (title) return title;
  const type = normalizedType(entry);
  if (type === "walk") return "Walk adventure";
  if (type === "training") return "Training win";
  if (type === "play") return "Play memory";
  return "Care moment";
}

function quest(
  id: string,
  title: string,
  prompt: string,
  rewardXp: number,
  status: AdventureQuestStatus,
  action: AdventureQuestAction,
  actionLabel: string,
  evidence: string,
  safetyNote = "Keep it private, safe, leashed where required, and appropriate for your dog.",
): AdventureQuest {
  return { id, title, prompt, rewardXp, status, action, actionLabel, evidence, safetyNote };
}

export function buildAdventureMemoryDraft(input: AdventureMemoryDraftInput): AdventureMemory {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const title = clean(input.title) || "Adventure memory";
  const humans = (input.humans ?? []).map(clean).filter(Boolean);
  const photoUri = clean(input.photoUri);

  return {
    id: `memory_${slug(title) || "adventure"}_${Date.parse(nowIso) || Date.now()}`,
    petName: clean(input.petName) || "Phoenix",
    questId: clean(input.questId) || "free-memory",
    title,
    note: clean(input.note),
    createdAt: nowIso,
    humans,
    xp: 18,
    storageStatus: "local-draft",
    mediaStatus: photoUri ? "local-photo" : "no-photo-yet",
    ...(photoUri ? { photoUri } : {}),
  };
}

export function deriveAdventureMode(input: AdventureInput): AdventureMode {
  const now = input.now ?? Date.now();
  const petName = clean(input.petName) || "Phoenix";
  const memories = [...(input.memories ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const todays = (input.entries ?? []).filter((entry) => visible(entry) && isSameLocalDay(entry.occurredAt, now));
  const walkEntries = todays.filter((entry) => normalizedType(entry) === "walk");
  const trainingEntries = todays.filter((entry) => normalizedType(entry) === "training");
  const playEntries = todays.filter((entry) => normalizedType(entry) === "play");
  const completedProof = todays
    .map((entry, index): AdventureProof | null => {
      const xp = entryXp(entry);
      if (xp <= 0) return null;
      return {
        entryId: clean(entry.id) || `entry_${index}`,
        label: proofLabel(entry),
        xp,
        occurredAt: entry.occurredAt,
      };
    })
    .filter((proof): proof is AdventureProof => Boolean(proof));
  const todayXp = completedProof.reduce((sum, proof) => sum + proof.xp, 0);
  const level = Math.max(1, Math.floor(todayXp / 50) + 1);
  const hasWalk = walkEntries.some((entry) => duration(entry) >= 10);
  const hasTraining = trainingEntries.length > 0;
  const hasMemoryToday = memories.some((memory) => isSameLocalDay(memory.createdAt, now));

  const quests: AdventureQuest[] = [
    quest(
      "sniffari-walk",
      "Calm Sniffari Walk",
      `Take ${petName} on a calm 10-20 minute walk and let the outing become today's care adventure.`,
      20,
      hasWalk ? "complete" : "available",
      "start-walk",
      "Start walk",
      hasWalk ? "A household-visible walk is logged today." : "No walk adventure is logged yet.",
    ),
    quest(
      "training-win",
      "Tiny Training Win",
      "Practice one cue outside or near the door, then log the win or rough spot.",
      14,
      hasTraining ? "complete" : "available",
      "log-training",
      "Log training",
      hasTraining ? "A training session is logged today." : "No training win is logged yet.",
    ),
    quest(
      "play-reset",
      "Play Reset",
      "Add a short play or decompression moment if the day needs a softer mood.",
      10,
      playEntries.length > 0 ? "complete" : "available",
      "log-play",
      "Log play",
      playEntries.length > 0 ? "Play is logged today." : "No play memory is logged yet.",
    ),
    quest(
      "memory-photo",
      "Save today's memory",
      "Add one private note or photo caption so the care story grows from real life.",
      18,
      hasMemoryToday ? "complete" : hasWalk || hasTraining || playEntries.length > 0 ? "available" : "locked",
      "save-memory",
      "Save memory",
      hasMemoryToday ? "A memory is saved today." : "Complete a care outing first, then save the memory.",
      "Do not share location or photos publicly unless every owner agrees.",
    ),
  ].sort((a, b) => {
    const rank: Record<AdventureQuestStatus, number> = { available: 0, locked: 1, complete: 2 };
    const rankDiff = rank[a.status] - rank[b.status];
    if (rankDiff !== 0) return rankDiff;
    if (a.id === "memory-photo") return -1;
    if (b.id === "memory-photo") return 1;
    return 0;
  });

  const status: AdventureModeStatus =
    hasMemoryToday ? "memory-ready" : todayXp > 0 ? "quest-ready" : "needs-outing";

  return {
    status,
    petName,
    title: status === "needs-outing" ? "Adventure starts with real care" : "Adventure Mode is ready",
    summary:
      todayXp > 0
        ? `${petName} earned ${todayXp} care XP from ${completedProof.length} real care moment${completedProof.length === 1 ? "" : "s"} today.`
        : `${petName}'s adventure log is waiting for a calm real-world care moment.`,
    nextStep:
      status === "needs-outing"
        ? "Start with a calm 10-20 minute walk, training win, or play reset."
        : hasMemoryToday
          ? "A private memory is saved today. Keep the next quest small and real."
          : "Save a private memory from today's care before the moment disappears.",
    privacyBoundary: "Adventure memories are private to the household unless an owner shares them.",
    todayXp,
    level,
    memoriesCount: memories.length,
    completedProof,
    quests,
    memories,
  };
}
