import {
  deriveHealthWatch,
  deriveRoutineBoard,
  isRoutineBoardScheduledItem,
  normalizeCareEventType,
  type CareEventDetails,
} from "../../../lib/care-domain/src/index.ts";
import type { Mood } from "./phoenixStatus.ts";

export type AvatarMotionState =
  | "happy"
  | "sad"
  | "bored"
  | "annoyed"
  | "tired"
  | "excited"
  | "eating"
  | "drinking"
  | "walking"
  | "sleeping"
  | "treat"
  | "sick";

export type AvatarMotionCue =
  | "tail-wag"
  | "ear-perk"
  | "slow-blink"
  | "slow-breath"
  | "paw-bounce"
  | "chew"
  | "lap"
  | "walk-cycle"
  | "treat-hop"
  | "head-tilt"
  | "low-energy"
  | "health-watch";

export type AvatarMotionIntensity = "resting" | "soft" | "medium" | "high" | "urgent";

export type AvatarMotionRoute = "/log" | "/calendar" | "/records" | "/portrait";

export interface AvatarMotionEntry {
  id?: string;
  type: string;
  title?: string | null;
  caregiver?: string | null;
  occurredAt: string;
  durationMinutes?: number | null;
  amount?: string | null;
  mood?: string | null;
  severity?: string | null;
  note?: string | null;
  details?: CareEventDetails;
}

export interface AvatarMotionRoutine {
  id?: string;
  label: string;
  type: string;
  time: string;
  owner?: string | null;
  note?: string | null;
}

export interface AvatarMotionCaregiver {
  name: string;
  role?: string;
}

export interface AvatarMotionInput {
  entries: readonly AvatarMotionEntry[];
  routines: readonly AvatarMotionRoutine[];
  caregivers?: readonly AvatarMotionCaregiver[];
  now?: number;
  energy?: number | null;
  /**
   * An open walk session is live state, not a one-shot reaction. It remains
   * authoritative across app reloads until the household finishes the walk.
   */
  activeWalk?: boolean;
  /**
   * Session gate for reaction states: recent-entry reactions (eating,
   * drinking, walking, treat, ...) only play for entries logged at or after
   * this timestamp. Home passes its mount time so an app reload never
   * replays a pre-reload log's reaction; standing derivations (health
   * watch, quiet hours, routine pressure, energy) ignore the gate. Omit to
   * react to any entry inside the recent-action window.
   */
  reactionsSince?: number;
}

export interface AvatarMotionModel {
  state: AvatarMotionState;
  avatarMood: Mood;
  cue: AvatarMotionCue;
  intensity: AvatarMotionIntensity;
  label: string;
  speech: string;
  line: string;
  route: AvatarMotionRoute;
}

const RECENT_ACTION_WINDOW_MINUTES = 45;
const WALK_SOON_WINDOW_MINUTES = 60;

function minutesBetween(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / 60_000;
}

function isQuietHour(now: number): boolean {
  const hour = new Date(now).getHours();
  return hour >= 22 || hour < 5;
}

function latestRecentEntry(
  entries: readonly AvatarMotionEntry[],
  now: number,
): AvatarMotionEntry | null {
  return [...entries]
    .filter((entry) => {
      const minutes = minutesBetween(entry.occurredAt, now);
      return minutes >= 0 && minutes <= RECENT_ACTION_WINDOW_MINUTES;
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0] ?? null;
}

function motionForRecentEntry(entry: AvatarMotionEntry): AvatarMotionModel | null {
  const type = normalizeCareEventType(entry.type, entry.details);
  if (type === "meal") {
    return {
      state: "eating",
      avatarMood: "happy",
      cue: "chew",
      intensity: "medium",
      label: "Eating",
      speech: "Meal logged. Tail wag.",
      line: "Meal logged. The day plan and diet history stay connected.",
      route: "/log",
    };
  }
  if (type === "treat") {
    return {
      state: "treat",
      avatarMood: "happy",
      cue: "treat-hop",
      intensity: "high",
      label: "Treat",
      speech: "Tiny celebration.",
      line: "Treat logged with the rest of the care timeline.",
      route: "/log",
    };
  }
  if (type === "water") {
    return {
      state: "drinking",
      avatarMood: "calm",
      cue: "lap",
      intensity: "soft",
      label: "Hydrating",
      speech: "Water break.",
      line: "Water logged so hydration stays visible to the household.",
      route: "/log",
    };
  }
  if (type === "walk") {
    return {
      state: "walking",
      avatarMood: "happy",
      cue: "walk-cycle",
      intensity: "high",
      label: "Walking",
      speech: "Walk logged.",
      line: "Walk logged. Route, duration, and social notes can build from here.",
      route: "/log",
    };
  }
  if (type === "play" || type === "training") {
    return {
      state: "excited",
      avatarMood: "excited",
      cue: "paw-bounce",
      intensity: "high",
      label: type === "training" ? "Training spark" : "Play spark",
      speech: type === "training" ? "Training win." : "Play time.",
      line: "Good energy logged for the household record.",
      route: "/log",
    };
  }
  if (type === "mood") {
    const mood = String(entry.mood ?? "").toLowerCase();
    if (mood.includes("anx") || mood.includes("sad") || mood.includes("unwell")) {
      return {
        state: "sad",
        avatarMood: "anxious",
        cue: "head-tilt",
        intensity: "soft",
        label: "Needs comfort",
        speech: "Stay close?",
        line: "Mood logged. Watch context and routine changes together.",
        route: "/log",
      };
    }
    if (mood.includes("excited") || mood.includes("zoom")) {
      return {
        state: "excited",
        avatarMood: "excited",
        cue: "paw-bounce",
        intensity: "high",
        label: "Excited",
        speech: "Let's go.",
        line: "Mood logged. Energy context is now part of the timeline.",
        route: "/log",
      };
    }
  }
  return null;
}

function openRoutineMotion(
  input: AvatarMotionInput,
  now: number,
): AvatarMotionModel | null {
  const board = deriveRoutineBoard({
    routines: input.routines,
    entries: input.entries,
    caregivers: input.caregivers,
    now,
  });
  const scheduled = board.items.filter(isRoutineBoardScheduledItem);
  const open = scheduled.find((item) => item.status === "overdue") ??
    scheduled.find((item) => item.status === "due") ??
    scheduled.find((item) => item.status === "upcoming");

  if (!open) return null;

  const type = open.normalizedType;
  if (open.status === "overdue") {
    if (type === "walk" || type === "play" || type === "training") {
      return {
        state: "bored",
        avatarMood: "excited",
        cue: "paw-bounce",
        intensity: "medium",
        label: "Waiting for activity",
        speech: "Still waiting.",
        line: `${open.label} is overdue. Open the routine board to assign or log it.`,
        route: "/calendar",
      };
    }
    return {
      state: "annoyed",
      avatarMood: "anxious",
      cue: "head-tilt",
      intensity: "medium",
      label: "Needs attention",
      speech: "Need a human.",
      line: `${open.label} is overdue. Update the household plan before it gets lost.`,
      route: "/calendar",
    };
  }

  if ((type === "walk" || type === "play" || type === "training") && open.minutesFromNow <= WALK_SOON_WINDOW_MINUTES) {
    return {
      state: "excited",
      avatarMood: "excited",
      cue: "paw-bounce",
      intensity: "high",
      label: "Ready soon",
      speech: "Walk soon?",
      line: `${open.label} is coming up. Phoenix is watching the routine board.`,
      route: "/calendar",
    };
  }

  if (type === "meal" && open.status === "due") {
    return {
      state: "annoyed",
      avatarMood: "excited",
      cue: "ear-perk",
      intensity: "medium",
      label: "Meal due",
      speech: "Meal time?",
      line: `${open.label} is due. Log served and eaten amounts when it happens.`,
      route: "/log",
    };
  }

  return null;
}

export function deriveAvatarMotion(input: AvatarMotionInput): AvatarMotionModel {
  const now = input.now ?? Date.now();
  const health = deriveHealthWatch({
    entries: input.entries,
    routines: input.routines,
    now,
  });
  const hasActiveHealthSignal =
    health.status === "alert" ||
    health.redFlags.length > 0 ||
    health.signals.some((signal) => signal.kind === "vomit-pattern" || signal.urgency === "alert");

  if (hasActiveHealthSignal) {
    return {
      state: "sick",
      avatarMood: "unwell",
      cue: "health-watch",
      intensity: health.status === "alert" ? "urgent" : "medium",
      label: "Health watch",
      speech: "Let's take it easy.",
      line: `${health.summary} WoofWatcher tracks patterns; it does not diagnose or replace veterinary care.`,
      route: "/records",
    };
  }

  if (input.activeWalk) {
    return {
      state: "walking",
      avatarMood: "happy",
      cue: "walk-cycle",
      intensity: "high",
      label: "Walking",
      speech: "Out exploring.",
      line: "Walk in progress. Phoenix keeps moving until the session is finished.",
      route: "/log",
    };
  }

  const recent = latestRecentEntry(input.entries, now);
  const recentIsFresh =
    recent !== null &&
    (input.reactionsSince === undefined ||
      new Date(recent.occurredAt).getTime() >= input.reactionsSince);
  if (recent && recentIsFresh) {
    const recentMotion = motionForRecentEntry(recent);
    if (recentMotion) return recentMotion;
  }

  if (isQuietHour(now)) {
    return {
      state: "sleeping",
      avatarMood: "calm",
      cue: "slow-breath",
      intensity: "resting",
      label: "Sleeping",
      speech: "Soft snooze.",
      line: "Quiet hours. Keep the routine calm unless something important changes.",
      route: "/log",
    };
  }

  const routineMotion = openRoutineMotion(input, now);
  if (routineMotion) return routineMotion;

  if (typeof input.energy === "number" && input.energy <= 45) {
    return {
      state: "tired",
      avatarMood: "calm",
      cue: "low-energy",
      intensity: "soft",
      label: "Low energy",
      speech: "Slow day.",
      line: "Energy is running low. Keep logging meals, rest, mood, and health context.",
      route: "/log",
    };
  }

  return {
    state: "happy",
    avatarMood: "happy",
    cue: "tail-wag",
    intensity: "soft",
    label: "Steady",
    speech: "All steady.",
    line: "Care is steady. Keep routines and logs moving together.",
    route: "/log",
  };
}
