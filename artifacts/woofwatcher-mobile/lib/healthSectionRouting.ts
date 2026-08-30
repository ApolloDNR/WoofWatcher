import type {
  CanonicalDestination,
  HealthSection,
} from "./navigationOwnership.ts";
import { resolveCanonicalDestination } from "./navigationOwnership.ts";

export type HealthCoreSection =
  | "overview"
  | "health-watch"
  | "bile-watch"
  | "medications";

export type RecordsHealthSection = "records" | "dog-id" | "care-pass";

export type HealthSectionTarget =
  | Readonly<{ kind: "core"; section: HealthCoreSection }>
  | Readonly<{ kind: "diet" }>
  | Readonly<{ kind: "trends" }>
  | Readonly<{ kind: "records"; section: RecordsHealthSection }>;

export const HEALTH_SECTION_TARGETS = {
  overview: { kind: "core", section: "overview" },
  "health-watch": { kind: "core", section: "health-watch" },
  "bile-watch": { kind: "core", section: "bile-watch" },
  medications: { kind: "core", section: "medications" },
  diet: { kind: "diet" },
  trends: { kind: "trends" },
  records: { kind: "records", section: "records" },
  "dog-id": { kind: "records", section: "dog-id" },
  "care-pass": { kind: "records", section: "care-pass" },
} as const satisfies Readonly<Record<HealthSection, HealthSectionTarget>>;

export type HealthRouteParams = Readonly<
  Record<string, string | string[] | undefined>
>;

export interface ResolvedHealthSectionRoute {
  destination: CanonicalDestination;
  section: HealthSection;
  target: HealthSectionTarget;
  entryId?: string;
  reportId?: string;
}

export function resolveHealthSectionRoute(
  params: HealthRouteParams = {},
): ResolvedHealthSectionRoute {
  const destination = resolveCanonicalDestination({
    pathname: "/health",
    params,
  });
  const candidate = destination.params?.section;
  const section: HealthSection =
    candidate &&
    Object.prototype.hasOwnProperty.call(HEALTH_SECTION_TARGETS, candidate)
      ? (candidate as HealthSection)
      : "overview";
  const resolved = {
    destination,
    section,
    target: HEALTH_SECTION_TARGETS[section],
  };

  if (section !== "records") return resolved;

  return {
    ...resolved,
    ...(destination.params?.entry
      ? { entryId: destination.params.entry }
      : {}),
    ...(destination.params?.report
      ? { reportId: destination.params.report }
      : {}),
  };
}
