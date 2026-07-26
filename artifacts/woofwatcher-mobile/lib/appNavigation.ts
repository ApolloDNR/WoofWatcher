import { CARE_EVENT_TYPES, type CareEventType } from "@workspace/care-domain";

export const APP_PRESENTATION_CONTRACTS = {
  "primary-tab": {
    navigator: "tabs",
    presentation: "tab",
    header: "hidden",
  },
  "secondary-tab": {
    navigator: "tabs",
    presentation: "tab",
    header: "hidden",
  },
  "owner-card-native-header": {
    navigator: "owner-stack",
    presentation: "card",
    header: "native",
  },
  "owner-card-custom-header": {
    navigator: "owner-stack",
    presentation: "card",
    header: "custom",
  },
  "root-card-native-header": {
    navigator: "root-stack",
    presentation: "card",
    header: "native",
  },
  "root-card-custom-header": {
    navigator: "root-stack",
    presentation: "card",
    header: "custom",
  },
  "root-modal": {
    navigator: "root-stack",
    presentation: "modal",
    header: "custom",
  },
  "system-gate": {
    navigator: "system",
    presentation: "gate",
    header: "hidden",
  },
  "system-card": {
    navigator: "system",
    presentation: "card",
    header: "custom",
  },
  "not-found": {
    navigator: "system",
    presentation: "not-found",
    header: "custom",
  },
} as const;

export type AppPresentationId = keyof typeof APP_PRESENTATION_CONTRACTS;
export type CareOwnerId = "today" | "plan" | "health" | "more";
export type AppRouteOwner = CareOwnerId | "quick-log" | null;
export type AppParameterModel =
  | "none"
  | "log"
  | "fastlog"
  | "health"
  | "more"
  | "legal"
  | "woofguide"
  | "setup"
  | "external-qa";

export interface AppRouteContract {
  readonly id: string;
  readonly pathname: string;
  readonly routerHref: string;
  readonly owner: AppRouteOwner;
  readonly presentation: AppPresentationId;
  readonly coldStartFallback: string;
  readonly shellVisible: boolean;
  readonly parameterModel: AppParameterModel;
  readonly sourceFile: string;
}

export const APP_ROUTE_CONTRACTS = [
  {
    id: "today",
    pathname: "/",
    routerHref: "/",
    owner: "today",
    presentation: "primary-tab",
    coldStartFallback: "/",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/(tabs)/index.tsx",
  },
  {
    id: "today-story",
    pathname: "/story",
    routerHref: "/story",
    owner: "today",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/(tabs)/story.tsx",
  },
  {
    id: "today-adventure",
    pathname: "/adventure",
    routerHref: "/adventure",
    owner: "today",
    presentation: "owner-card-native-header",
    coldStartFallback: "/",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/adventure.tsx",
  },
  {
    id: "plan",
    pathname: "/calendar",
    routerHref: "/calendar",
    owner: "plan",
    presentation: "primary-tab",
    coldStartFallback: "/calendar",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/(tabs)/calendar.tsx",
  },
  {
    id: "plan-month",
    pathname: "/calendar-month",
    routerHref: "/calendar-month",
    owner: "plan",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/calendar",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/calendar-month.tsx",
  },
  {
    id: "plan-reminders",
    pathname: "/reminders",
    routerHref: "/reminders",
    owner: "plan",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/calendar",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/reminders.tsx",
  },
  {
    id: "quick-log",
    pathname: "/fastlog",
    routerHref: "/fastlog",
    owner: "quick-log",
    presentation: "root-modal",
    coldStartFallback: "/",
    shellVisible: false,
    parameterModel: "fastlog",
    sourceFile: "app/fastlog.tsx",
  },
  {
    id: "care-log",
    pathname: "/log",
    routerHref: "/log",
    owner: "quick-log",
    presentation: "root-card-custom-header",
    coldStartFallback: "/",
    shellVisible: true,
    parameterModel: "log",
    sourceFile: "app/(tabs)/log.tsx",
  },
  {
    id: "health",
    pathname: "/health",
    routerHref: "/health",
    owner: "health",
    presentation: "primary-tab",
    coldStartFallback: "/health",
    shellVisible: true,
    parameterModel: "health",
    sourceFile: "app/(tabs)/health.tsx",
  },
  {
    id: "health-trends",
    pathname: "/trends",
    routerHref: "/trends",
    owner: "health",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/health",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/trends.tsx",
  },
  {
    id: "health-records",
    pathname: "/records",
    routerHref: "/records",
    owner: "health",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/health",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/(tabs)/records.tsx",
  },
  {
    id: "more",
    pathname: "/more",
    routerHref: "/more",
    owner: "more",
    presentation: "primary-tab",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "more",
    sourceFile: "app/(tabs)/more.tsx",
  },
  {
    id: "more-pack",
    pathname: "/pack",
    routerHref: "/pack",
    owner: "more",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/(tabs)/pack.tsx",
  },
  {
    id: "more-profile",
    pathname: "/profile",
    routerHref: "/profile",
    owner: "more",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/profile.tsx",
  },
  {
    id: "more-portrait",
    pathname: "/portrait",
    routerHref: "/portrait",
    owner: "more",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/portrait.tsx",
  },
  {
    id: "more-guide",
    pathname: "/woofguide",
    routerHref: "/woofguide",
    owner: "more",
    presentation: "owner-card-native-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "woofguide",
    sourceFile: "app/woofguide.tsx",
  },
  {
    id: "more-privacy",
    pathname: "/privacy",
    routerHref: "/privacy",
    owner: "more",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/privacy.tsx",
  },
  {
    id: "more-legal",
    pathname: "/legal",
    routerHref: "/legal",
    owner: "more",
    presentation: "owner-card-custom-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "legal",
    sourceFile: "app/legal.tsx",
  },
  {
    id: "more-premium",
    pathname: "/premium",
    routerHref: "/premium",
    owner: "more",
    presentation: "owner-card-native-header",
    coldStartFallback: "/more",
    shellVisible: true,
    parameterModel: "none",
    sourceFile: "app/premium.tsx",
  },
  {
    id: "auth-sign-in",
    pathname: "/sign-in",
    routerHref: "/(auth)/sign-in",
    owner: null,
    presentation: "system-gate",
    coldStartFallback: "/",
    shellVisible: false,
    parameterModel: "none",
    sourceFile: "app/(auth)/sign-in.tsx",
  },
  {
    id: "auth-sign-up",
    pathname: "/sign-up",
    routerHref: "/(auth)/sign-up",
    owner: null,
    presentation: "system-gate",
    coldStartFallback: "/",
    shellVisible: false,
    parameterModel: "none",
    sourceFile: "app/(auth)/sign-up.tsx",
  },
  {
    id: "setup",
    pathname: "/setup",
    routerHref: "/setup",
    owner: null,
    presentation: "system-card",
    coldStartFallback: "/",
    shellVisible: false,
    parameterModel: "setup",
    sourceFile: "app/setup.tsx",
  },
  {
    id: "care-twin-qa",
    pathname: "/care-twin-qa",
    routerHref: "/care-twin-qa",
    owner: null,
    presentation: "system-card",
    coldStartFallback: "/",
    shellVisible: false,
    parameterModel: "external-qa",
    sourceFile: "app/care-twin-qa.tsx",
  },
] as const satisfies readonly AppRouteContract[];

export type AppRoutePath = (typeof APP_ROUTE_CONTRACTS)[number]["pathname"];

const ROUTE_BY_PATH = new Map<string, (typeof APP_ROUTE_CONTRACTS)[number]>(
  APP_ROUTE_CONTRACTS.map((route) => [route.pathname, route]),
);

type ShellVisibleRoute = Extract<
  (typeof APP_ROUTE_CONTRACTS)[number],
  { readonly shellVisible: true }
>;

export type QuickLogOriginPath = ShellVisibleRoute["pathname"];
export const QUICK_LOG_ORIGIN_PATHS: readonly QuickLogOriginPath[] =
  Object.freeze(
    APP_ROUTE_CONTRACTS.filter(
      (route): route is ShellVisibleRoute => route.shellVisible,
    ).map((route) => route.pathname),
  );
const QUICK_LOG_ORIGIN_SET = new Set<string>(QUICK_LOG_ORIGIN_PATHS);

export const CURRENT_NAVIGATION_LAYOUT_SOURCE_FILES = [
  "app/_layout.tsx",
  "app/(auth)/_layout.tsx",
  "app/(tabs)/_layout.tsx",
] as const;

export const NOT_FOUND_ROUTE_SOURCE_FILE = "app/+not-found.tsx";

export const NAVIGATION_ROUTER_SOURCE_FILES = [
  "app/(auth)/sign-in.tsx",
  "app/(auth)/sign-up.tsx",
  "app/(tabs)/_layout.tsx",
  "app/(tabs)/calendar.tsx",
  "app/(tabs)/health.tsx",
  "app/(tabs)/index.tsx",
  "app/(tabs)/log.tsx",
  "app/(tabs)/more.tsx",
  "app/(tabs)/pack.tsx",
  "app/(tabs)/records.tsx",
  "app/(tabs)/story.tsx",
  "app/+not-found.tsx",
  "app/_layout.tsx",
  "app/adventure.tsx",
  "app/calendar-month.tsx",
  "app/care-twin-qa.tsx",
  "app/fastlog.tsx",
  "app/legal.tsx",
  "app/portrait.tsx",
  "app/premium.tsx",
  "app/privacy.tsx",
  "app/profile.tsx",
  "app/reminders.tsx",
  "app/setup.tsx",
  "app/trends.tsx",
  "app/woofguide.tsx",
  "components/auth-ui.tsx",
  "components/board/BoardPrimitives.tsx",
  "components/board/OwnerOpsBoundary.tsx",
  "components/logging/useQuickLogController.ts",
] as const;

export const LEGACY_DIRECT_FAST_LOG_SOURCE_FILES = [
  "app/(tabs)/_layout.tsx",
  "app/(tabs)/index.tsx",
  "app/(tabs)/log.tsx",
  "app/calendar-month.tsx",
] as const;

export const LEGACY_DYNAMIC_ROUTER_CALL_COUNTS = {
  "app/(tabs)/calendar.tsx": 2,
  "app/(tabs)/health.tsx": 3,
  "app/(tabs)/index.tsx": 4,
  "app/(tabs)/more.tsx": 16,
  "app/(tabs)/pack.tsx": 2,
  "app/(tabs)/records.tsx": 4,
  "app/(tabs)/story.tsx": 6,
  "app/adventure.tsx": 4,
  "app/calendar-month.tsx": 1,
  "app/care-twin-qa.tsx": 4,
  "app/fastlog.tsx": 1,
  "app/profile.tsx": 1,
  "app/woofguide.tsx": 2,
  "components/board/BoardPrimitives.tsx": 1,
  "components/logging/useQuickLogController.ts": 3,
} as const;

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u;
const UNSAFE_ORIGIN_CHARACTER = /[%?#\\\s]/u;
const CARE_EVENT_TYPE_SET = new Set<string>(CARE_EVENT_TYPES);
const MORE_SECTION_SET = new Set([
  "career",
  "household",
  "access",
  "care-pass",
  "diet",
]);
const LEGAL_DOC_SET = new Set(["privacy", "terms"]);

export type LogRouteParams =
  | {
      readonly entry: string;
      readonly returnTo?: QuickLogOriginPath;
      readonly type?: never;
      readonly detail?: never;
      readonly intent?: never;
      readonly walk?: never;
      readonly alone?: never;
    }
  | {
      readonly type: CareEventType;
      readonly detail: "1";
      readonly intent: string;
      readonly returnTo?: QuickLogOriginPath;
      readonly entry?: never;
      readonly walk?: never;
      readonly alone?: never;
    }
  | {
      readonly walk: "finish";
      readonly returnTo?: QuickLogOriginPath;
      readonly entry?: never;
      readonly type?: never;
      readonly detail?: never;
      readonly intent?: never;
      readonly alone?: never;
    }
  | {
      readonly alone: "active";
      readonly returnTo?: QuickLogOriginPath;
      readonly entry?: never;
      readonly type?: never;
      readonly detail?: never;
      readonly intent?: never;
      readonly walk?: never;
    }
  | {
      readonly returnTo?: QuickLogOriginPath;
      readonly entry?: never;
      readonly type?: never;
      readonly detail?: never;
      readonly intent?: never;
      readonly walk?: never;
      readonly alone?: never;
    };

export interface FastLogRouteParams {
  readonly origin?: QuickLogOriginPath;
}

export interface HealthRouteParams {
  readonly tab?: "health" | "bile";
}

export interface MoreRouteParams {
  readonly section?: "career" | "household" | "access" | "care-pass" | "diet";
  readonly focus?: string;
}

export interface LegalRouteParams {
  readonly doc?: "privacy" | "terms";
}

export interface WoofGuideRouteParams {
  readonly prompt?: string;
}

export type SetupRouteParams =
  | {
      readonly mode: "manage";
      readonly returnTo: "/more";
    }
  | {
      readonly mode?: never;
      readonly returnTo?: never;
    };

export interface AppRouteParamsByPath {
  readonly "/": never;
  readonly "/story": never;
  readonly "/adventure": never;
  readonly "/calendar": never;
  readonly "/calendar-month": never;
  readonly "/reminders": never;
  readonly "/fastlog": FastLogRouteParams;
  readonly "/log": LogRouteParams;
  readonly "/health": HealthRouteParams;
  readonly "/trends": never;
  readonly "/records": never;
  readonly "/more": MoreRouteParams;
  readonly "/pack": never;
  readonly "/profile": never;
  readonly "/portrait": never;
  readonly "/woofguide": WoofGuideRouteParams;
  readonly "/privacy": never;
  readonly "/legal": LegalRouteParams;
  readonly "/premium": never;
  readonly "/sign-in": never;
  readonly "/sign-up": never;
  readonly "/setup": SetupRouteParams;
  readonly "/care-twin-qa": never;
}

export type AppRouteParseResult =
  | {
      readonly ok: true;
      readonly params: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly error:
        | "unknown-route"
        | "invalid-params-object"
        | "unknown-param"
        | "invalid-param"
        | "external-params";
    };

export type KnownAppRouteResolution = (typeof APP_ROUTE_CONTRACTS)[number] & {
  readonly kind: "known";
};

export interface UnknownAppRouteResolution {
  readonly kind: "unknown";
  readonly owner: null;
  readonly presentation: "not-found";
  readonly coldStartFallback: "/";
}

export function resolveAppRoute(
  pathname: unknown,
): KnownAppRouteResolution | UnknownAppRouteResolution {
  if (typeof pathname === "string") {
    const route = ROUTE_BY_PATH.get(pathname);
    if (route) return { kind: "known", ...route };
  }
  return {
    kind: "unknown",
    owner: null,
    presentation: "not-found",
    coldStartFallback: "/",
  };
}

export function parseQuickLogOrigin(value: unknown): QuickLogOriginPath | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("//") ||
    CONTROL_CHARACTER.test(value) ||
    UNSAFE_ORIGIN_CHARACTER.test(value) ||
    !QUICK_LOG_ORIGIN_SET.has(value)
  ) {
    return null;
  }
  return value as QuickLogOriginPath;
}

function isParamRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedParamRecord(value: unknown): Record<string, unknown> | null {
  if (value === undefined) return {};
  return isParamRecord(value) ? value : null;
}

function hasOnlyKeys(
  params: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(params).every((key) => allowedSet.has(key));
}

function hasOwn(params: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(params, key);
}

function validCanonicalSafeInteger(value: unknown): value is string {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/u.test(value))
    return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0;
}

function validOpaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    [...value].length >= 1 &&
    [...value].length <= 128 &&
    !CONTROL_CHARACTER.test(value)
  );
}

function validPrompt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    [...value].length >= 1 &&
    [...value].length <= 240 &&
    !CONTROL_CHARACTER.test(value)
  );
}

function success(params: Record<string, string>): AppRouteParseResult {
  return { ok: true, params };
}

function rejected(
  error: Exclude<AppRouteParseResult, { ok: true }>["error"],
): AppRouteParseResult {
  return { ok: false, error };
}

function parseNoParams(params: Record<string, unknown>): AppRouteParseResult {
  return Object.keys(params).length === 0
    ? success({})
    : rejected("unknown-param");
}

function parseFastLogParams(
  params: Record<string, unknown>,
): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["origin"])) return rejected("unknown-param");
  if (!hasOwn(params, "origin")) return success({});
  const origin = parseQuickLogOrigin(params.origin);
  return origin ? success({ origin }) : rejected("invalid-param");
}

function parseHealthParams(
  params: Record<string, unknown>,
): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["tab"])) return rejected("unknown-param");
  if (!hasOwn(params, "tab")) return success({});
  return params.tab === "health" || params.tab === "bile"
    ? success({ tab: params.tab })
    : rejected("invalid-param");
}

function parseMoreParams(params: Record<string, unknown>): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["section", "focus"]))
    return rejected("unknown-param");
  const parsed: Record<string, string> = {};
  if (hasOwn(params, "section")) {
    if (
      typeof params.section !== "string" ||
      !MORE_SECTION_SET.has(params.section)
    ) {
      return rejected("invalid-param");
    }
    parsed.section = params.section;
  }
  if (hasOwn(params, "focus")) {
    if (!validCanonicalSafeInteger(params.focus))
      return rejected("invalid-param");
    parsed.focus = params.focus;
  }
  return success(parsed);
}

function parseLegalParams(
  params: Record<string, unknown>,
): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["doc"])) return rejected("unknown-param");
  if (!hasOwn(params, "doc")) return success({});
  return typeof params.doc === "string" && LEGAL_DOC_SET.has(params.doc)
    ? success({ doc: params.doc })
    : rejected("invalid-param");
}

function parseWoofGuideParams(
  params: Record<string, unknown>,
): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["prompt"])) return rejected("unknown-param");
  if (!hasOwn(params, "prompt")) return success({});
  return validPrompt(params.prompt)
    ? success({ prompt: params.prompt })
    : rejected("invalid-param");
}

function parseSetupParams(
  params: Record<string, unknown>,
): AppRouteParseResult {
  if (!hasOnlyKeys(params, ["mode", "returnTo"]))
    return rejected("unknown-param");
  if (Object.keys(params).length === 0) return success({});
  return params.mode === "manage" && params.returnTo === "/more"
    ? success({ mode: "manage", returnTo: "/more" })
    : rejected("invalid-param");
}

function parseLogParams(params: Record<string, unknown>): AppRouteParseResult {
  if (
    !hasOnlyKeys(params, [
      "entry",
      "type",
      "detail",
      "intent",
      "walk",
      "alone",
      "returnTo",
    ])
  ) {
    return rejected("unknown-param");
  }

  const entryVariant = hasOwn(params, "entry");
  const careVariant =
    hasOwn(params, "type") ||
    hasOwn(params, "detail") ||
    hasOwn(params, "intent");
  const walkVariant = hasOwn(params, "walk");
  const aloneVariant = hasOwn(params, "alone");
  const variantCount = [
    entryVariant,
    careVariant,
    walkVariant,
    aloneVariant,
  ].filter(Boolean).length;
  if (variantCount > 1) return rejected("invalid-param");

  const parsed: Record<string, string> = {};
  if (entryVariant) {
    if (!validOpaqueId(params.entry)) return rejected("invalid-param");
    parsed.entry = params.entry;
  } else if (careVariant) {
    if (
      typeof params.type !== "string" ||
      !CARE_EVENT_TYPE_SET.has(params.type) ||
      params.detail !== "1" ||
      !validCanonicalSafeInteger(params.intent)
    ) {
      return rejected("invalid-param");
    }
    parsed.type = params.type;
    parsed.detail = "1";
    parsed.intent = params.intent;
  } else if (walkVariant) {
    if (params.walk !== "finish") return rejected("invalid-param");
    parsed.walk = "finish";
  } else if (aloneVariant) {
    if (params.alone !== "active") return rejected("invalid-param");
    parsed.alone = "active";
  }

  if (hasOwn(params, "returnTo")) {
    const returnTo = parseQuickLogOrigin(params.returnTo);
    if (!returnTo) return rejected("invalid-param");
    parsed.returnTo = returnTo;
  }
  return success(parsed);
}

export function parseAppRouteParams(
  pathname: unknown,
  input: unknown = {},
): AppRouteParseResult {
  const resolution = resolveAppRoute(pathname);
  if (resolution.kind === "unknown") return rejected("unknown-route");
  const params = normalizedParamRecord(input);
  if (!params) return rejected("invalid-params-object");

  switch (resolution.parameterModel) {
    case "none":
      return parseNoParams(params);
    case "log":
      return parseLogParams(params);
    case "fastlog":
      return parseFastLogParams(params);
    case "health":
      return parseHealthParams(params);
    case "more":
      return parseMoreParams(params);
    case "legal":
      return parseLegalParams(params);
    case "woofguide":
      return parseWoofGuideParams(params);
    case "setup":
      return parseSetupParams(params);
    case "external-qa":
      return Object.keys(params).length === 0
        ? success({})
        : rejected("external-params");
  }
}

type RouteContractForPath<Path extends AppRoutePath> = Extract<
  (typeof APP_ROUTE_CONTRACTS)[number],
  { readonly pathname: Path }
>;

type RouterHrefPath<Path extends AppRoutePath> =
  RouteContractForPath<Path>["routerHref"];

type AppObjectHref<Path extends AppRoutePath> =
  AppRouteParamsByPath[Path] extends never
    ? { readonly pathname: RouterHrefPath<Path> }
    : {
        readonly pathname: RouterHrefPath<Path>;
        readonly params?: AppRouteParamsByPath[Path];
      };

export function buildAppHref<Path extends AppRoutePath>(
  pathname: Path,
  params?: AppRouteParamsByPath[Path],
): AppObjectHref<Path> {
  const resolution = resolveAppRoute(pathname);
  if (resolution.kind === "unknown") {
    throw new Error(`Unknown navigation route: ${String(pathname)}`);
  }
  const parsed = parseAppRouteParams(pathname, params);
  if (!parsed.ok) {
    throw new Error(
      `Invalid navigation params for ${pathname}: ${parsed.error}`,
    );
  }
  if (Object.keys(parsed.params).length === 0) {
    return { pathname: resolution.routerHref } as AppObjectHref<Path>;
  }
  return {
    pathname: resolution.routerHref,
    params: parsed.params,
  } as AppObjectHref<Path>;
}
