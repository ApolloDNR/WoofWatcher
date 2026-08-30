import type {
  HealthSection,
  MoreSection,
  PlansSection,
} from "./navigationOwnership.ts";
import { UNIVERSAL_PRIMARY_TAB_MODELS } from "./universalNavigationManifest.ts";

export const UNIVERSAL_PRIMARY_TABS = UNIVERSAL_PRIMARY_TAB_MODELS;

export const UNIVERSAL_COMPATIBILITY_TABS = [
  "pack",
  "story",
  "records",
] as const;

export type UniversalTabName = (typeof UNIVERSAL_PRIMARY_TABS)[number]["name"];

export interface UniversalTabPressInput {
  tabName: UniversalTabName;
  focused: boolean;
  pathname: string;
  plansItem?: string;
  plansSection?: PlansSection;
  healthSection?: HealthSection;
  moreSection: MoreSection;
}

export interface UniversalTabPressEffects {
  preventDefault: () => void;
  replace: (pathname: "/calendar" | "/health" | "/more") => void;
}

export function handleUniversalTabPress(
  input: UniversalTabPressInput,
  effects: UniversalTabPressEffects,
): boolean {
  if (!input.focused) return false;

  let root: "/calendar" | "/health" | "/more" | undefined;
  if (
    input.tabName === "calendar" &&
    input.pathname === "/calendar" &&
    (input.plansItem || input.plansSection === "reminders")
  ) {
    root = "/calendar";
  } else if (
    input.tabName === "health" &&
    input.pathname === "/health" &&
    input.healthSection !== undefined &&
    input.healthSection !== "overview"
  ) {
    root = "/health";
  } else if (
    input.tabName === "more" &&
    input.pathname === "/more" &&
    input.moreSection !== "root"
  ) {
    root = "/more";
  }

  if (!root) return false;

  effects.preventDefault();
  effects.replace(root);
  return true;
}
