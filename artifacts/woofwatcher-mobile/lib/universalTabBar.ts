export const UNIVERSAL_PRIMARY_TABS = [
  { name: "index", label: "Home", parent: "home" },
  { name: "log", label: "Log", parent: "log" },
  { name: "calendar", label: "Plans", parent: "plans" },
  { name: "health", label: "Health", parent: "health" },
  { name: "more", label: "More", parent: "more" },
] as const;

export const UNIVERSAL_COMPATIBILITY_TABS = [
  "pack",
  "story",
  "records",
] as const;
