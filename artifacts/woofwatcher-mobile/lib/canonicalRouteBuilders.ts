import {
  resolveCanonicalDestination,
  type HealthSection,
  type MoreSection,
} from "./navigationOwnership.ts";

export type CanonicalHealthRoute = `/health?section=${HealthSection}`;
export type CanonicalMoreRoute =
  `/more?section=${Exclude<MoreSection, "root">}`;
export type CanonicalPlansReminderCenterRoute = "/calendar?section=reminders";

export const canonicalHomeRoute = (): "/" => "/";
export const canonicalLogRoute = (): "/log" => "/log";
export const canonicalFastLogRoute = (): "/fastlog" => "/fastlog";
export const canonicalPlansRoute = (): "/calendar" => "/calendar";
export const canonicalPlansReminderCenterRoute =
  (): CanonicalPlansReminderCenterRoute => "/calendar?section=reminders";

export function replaceWithCanonicalHome(router: {
  replace(route: ReturnType<typeof canonicalHomeRoute>): void;
}): void {
  router.replace(canonicalHomeRoute());
}

const OWNERSHIP_PATHS = new Set([
  "/",
  "/log",
  "/fastlog",
  "/calendar",
  "/health",
  "/more",
  "/reminders",
  "/records",
  "/trends",
  "/pack",
  "/story",
  "/woofguide",
  "/legal",
  "/profile",
  "/portrait",
  "/adventure",
  "/privacy",
]);

export function canonicalHealthRoute(
  section: HealthSection,
): CanonicalHealthRoute {
  return `/health?section=${section}`;
}

export function canonicalMoreRoute(
  section: Exclude<MoreSection, "root">,
): CanonicalMoreRoute {
  return `/more?section=${section}`;
}

export function canonicalizeOwnedRoute(route: string): string {
  const queryIndex = route.indexOf("?");
  const pathname = queryIndex === -1 ? route : route.slice(0, queryIndex);
  if (!OWNERSHIP_PATHS.has(pathname)) return route;
  const query = queryIndex === -1 ? "" : route.slice(queryIndex + 1);
  const params: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(query)) {
    const existing = params[key];
    params[key] =
      existing === undefined
        ? value
        : Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
  }

  const destination = resolveCanonicalDestination({ pathname, params });
  const canonicalOwnerNeedsSerialization =
    pathname === "/calendar" || pathname === "/health" || pathname === "/more";
  if (!destination.replace && !canonicalOwnerNeedsSerialization) return route;
  const destinationQuery = destination.params
    ? new URLSearchParams({ ...destination.params }).toString()
    : "";
  return `${destination.pathname}${destinationQuery ? `?${destinationQuery}` : ""}`;
}
