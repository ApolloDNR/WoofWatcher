import type { Mood } from "./phoenixStatus";

const CONCERN_SPEECH: Pick<Record<Mood, string>, "anxious" | "unwell"> = {
  anxious: "Stay close today.\nA calm plan helps.",
  unwell: "Tummy feels off.\nLet's watch gently.",
};

function greetingForHour(hour: number): string {
  if (!Number.isFinite(hour)) return "Hello";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getHomeRoomSpeech(mood: Mood, hour: number): string {
  if (mood === "anxious" || mood === "unwell") {
    return CONCERN_SPEECH[mood];
  }

  return `${greetingForHour(hour)}!\nWhat's next?\nI'm ready!`;
}
