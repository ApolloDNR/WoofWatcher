import type { MoreSection } from "./navigationOwnership.ts";
import {
  canonicalHealthRoute,
  canonicalMoreRoute,
} from "./canonicalRouteBuilders.ts";

export type MoreDirectoryDestination =
  | Readonly<{ parent: "more"; section: Exclude<MoreSection, "root"> }>
  | Readonly<{ parent: "health"; section: "care-pass" }>;

export interface MoreDirectoryItem {
  id: string;
  label: string;
  detail: string;
  searchTerms: readonly string[];
  destination: MoreDirectoryDestination;
}

export interface MoreDirectoryGroup {
  id: "dog" | "people-home" | "experiences" | "app-privacy";
  title: "Dog" | "People & Home" | "Experiences" | "App & Privacy";
  items: readonly MoreDirectoryItem[];
}

export const MORE_DIRECTORY_GROUPS: readonly MoreDirectoryGroup[] = [
  {
    id: "dog",
    title: "Dog",
    items: [
      { id: "dog-profile", label: "Dog Profile", detail: "Identity, care facts, and veterinarian contacts.", searchTerms: ["dog", "profile", "identity"], destination: { parent: "more", section: "dog-profile" } },
      { id: "avatar-studio", label: "Avatar Studio", detail: "Choose and customize a manual pixel care twin.", searchTerms: ["avatar", "portrait", "pixel twin"], destination: { parent: "more", section: "avatar-studio" } },
    ],
  },
  {
    id: "people-home",
    title: "People & Home",
    items: [
      { id: "care-team", label: "Care Team", detail: "Caregivers, household access, and responsibility.", searchTerms: ["caregiver", "people", "household"], destination: { parent: "more", section: "care-team" } },
      { id: "supplies-travel", label: "Supplies & Travel", detail: "Pack inventory and the travel bag checklist.", searchTerms: ["supplies", "travel", "pack", "leash"], destination: { parent: "more", section: "care-team-supplies" } },
    ],
  },
  {
    id: "experiences",
    title: "Experiences",
    items: [
      { id: "story-progress", label: "Story & Progress", detail: "Real care memories, walks, badges, and progress.", searchTerms: ["story", "memories", "progress"], destination: { parent: "more", section: "story-progress" } },
      { id: "adventure", label: "Adventure", detail: "Private care quests grounded in completed care.", searchTerms: ["adventure", "quests", "walk"], destination: { parent: "more", section: "adventure" } },
      { id: "woofguide", label: "WoofGuide", detail: "Care-aware guidance and owner-reviewed drafts.", searchTerms: ["guide", "assistant"], destination: { parent: "more", section: "woofguide" } },
    ],
  },
  {
    id: "app-privacy",
    title: "App & Privacy",
    items: [
      { id: "settings", label: "Settings", detail: "Learn how the five WoofWatcher tabs work.", searchTerms: ["settings", "help", "app"], destination: { parent: "more", section: "settings" } },
      { id: "privacy", label: "Privacy & Data", detail: "Export or delete local household care data.", searchTerms: ["privacy", "export", "delete data", "safety"], destination: { parent: "more", section: "privacy" } },
      { id: "legal", label: "Legal", detail: "Read bundled policies and terms of service.", searchTerms: ["legal", "terms", "policy"], destination: { parent: "more", section: "legal" } },
      { id: "care-pass", label: "Share Care Pass", detail: "Open Health to prepare a shareable vet or sitter report.", searchTerms: ["vet report", "care pass", "handoff", "share"], destination: { parent: "health", section: "care-pass" } },
    ],
  },
];

function normalizeDirectoryQuery(value: string): string {
  return value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
}

export function searchMoreDirectory(query: string): MoreDirectoryItem[] {
  const items = MORE_DIRECTORY_GROUPS.flatMap((group) => group.items);
  const normalized = normalizeDirectoryQuery(query);
  if (!normalized) return [...items];
  return items.filter((item) =>
    normalizeDirectoryQuery([item.label, item.detail, ...item.searchTerms].join(" ")).includes(normalized),
  );
}

export function executeMoreDirectoryDestination(
  destination: MoreDirectoryDestination,
  navigate: (route: string) => void,
): void {
  navigate(
    destination.parent === "health"
      ? canonicalHealthRoute(destination.section)
      : canonicalMoreRoute(destination.section),
  );
}
