import type {
  CanonicalDestination,
  MoreSection,
} from "./navigationOwnership.ts";
import { resolveCanonicalDestination } from "./navigationOwnership.ts";

export type CareTeamSection = "care-team" | "care-team-supplies";

export type MoreSectionTarget =
  | Readonly<{ kind: "root" }>
  | Readonly<{ kind: "dog-profile" }>
  | Readonly<{ kind: "avatar-studio" }>
  | Readonly<{ kind: "care-team-supplies"; section: CareTeamSection }>
  | Readonly<{ kind: "story-progress" }>
  | Readonly<{ kind: "adventure" }>
  | Readonly<{ kind: "woofguide" }>
  | Readonly<{ kind: "settings" }>
  | Readonly<{ kind: "privacy" }>
  | Readonly<{ kind: "legal" }>;

export const MORE_SECTION_TARGETS = {
  root: { kind: "root" },
  "dog-profile": { kind: "dog-profile" },
  "avatar-studio": { kind: "avatar-studio" },
  "care-team": { kind: "care-team-supplies", section: "care-team" },
  "care-team-supplies": {
    kind: "care-team-supplies",
    section: "care-team-supplies",
  },
  "story-progress": { kind: "story-progress" },
  adventure: { kind: "adventure" },
  woofguide: { kind: "woofguide" },
  settings: { kind: "settings" },
  privacy: { kind: "privacy" },
  legal: { kind: "legal" },
} as const satisfies Readonly<Record<MoreSection, MoreSectionTarget>>;

export type MoreRouteParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface ResolvedMoreSectionRoute {
  destination: CanonicalDestination;
  section: MoreSection;
  target: MoreSectionTarget;
  itemId?: string;
  entryId?: string;
  walkId?: string;
  prompt?: string;
  legalDocument?: "privacy" | "terms";
}

export type MoreSectionNavigationDestination = Readonly<{
  pathname: "/more";
  params: Readonly<
    { section: Exclude<MoreSection, "root"> } &
      Partial<{ doc: "privacy" | "terms" }>
  >;
}>;

export function navigateToMoreSection(
  push: (destination: MoreSectionNavigationDestination) => void,
  nextSection: Exclude<MoreSection, "root">,
  ownedParams?: Readonly<{ doc: "privacy" | "terms" }>,
): void {
  push(
    ownedParams && nextSection === "legal"
      ? {
          pathname: "/more",
          params: { section: nextSection, doc: ownedParams.doc },
        }
      : { pathname: "/more", params: { section: nextSection } },
  );
}

export function resolveMoreSectionRoute(
  params: MoreRouteParams = {},
): ResolvedMoreSectionRoute {
  const destination = resolveCanonicalDestination({
    pathname: "/more",
    params,
  });
  const candidate =
    destination.parent === "more" ? destination.params?.section : undefined;
  const section: MoreSection =
    candidate &&
    Object.prototype.hasOwnProperty.call(MORE_SECTION_TARGETS, candidate)
      ? (candidate as MoreSection)
      : "root";
  const resolved = {
    destination,
    section,
    target: MORE_SECTION_TARGETS[section],
  };

  switch (section) {
    case "care-team-supplies":
      return {
        ...resolved,
        ...(destination.params?.item
          ? { itemId: destination.params.item }
          : {}),
      };
    case "story-progress":
      return {
        ...resolved,
        ...(destination.params?.entry
          ? { entryId: destination.params.entry }
          : {}),
        ...(destination.params?.walk
          ? { walkId: destination.params.walk }
          : {}),
      };
    case "woofguide":
      return {
        ...resolved,
        ...(destination.params?.prompt
          ? { prompt: destination.params.prompt }
          : {}),
      };
    case "legal": {
      const document = destination.params?.doc;
      return {
        ...resolved,
        ...(document === "privacy" || document === "terms"
          ? { legalDocument: document }
          : {}),
      };
    }
    default:
      return resolved;
  }
}
