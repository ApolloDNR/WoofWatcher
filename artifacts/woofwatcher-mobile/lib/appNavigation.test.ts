import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_PRESENTATION_CONTRACTS,
  APP_ROUTE_CONTRACTS,
  QUICK_LOG_ORIGIN_PATHS,
  buildAppHref,
  parseAppRouteParams,
  parseQuickLogOrigin,
  resolveAppRoute,
} from "./appNavigation.ts";

const EXPECTED_ROUTES = [
  ["/", "/", "today", "primary-tab", "/", true, "app/(tabs)/index.tsx"],
  [
    "/story",
    "/story",
    "today",
    "owner-card-custom-header",
    "/",
    true,
    "app/(tabs)/story.tsx",
  ],
  [
    "/adventure",
    "/adventure",
    "today",
    "owner-card-native-header",
    "/",
    true,
    "app/adventure.tsx",
  ],
  [
    "/calendar",
    "/calendar",
    "plan",
    "primary-tab",
    "/calendar",
    true,
    "app/(tabs)/calendar.tsx",
  ],
  [
    "/calendar-month",
    "/calendar-month",
    "plan",
    "owner-card-custom-header",
    "/calendar",
    true,
    "app/calendar-month.tsx",
  ],
  [
    "/reminders",
    "/reminders",
    "plan",
    "owner-card-custom-header",
    "/calendar",
    true,
    "app/reminders.tsx",
  ],
  [
    "/fastlog",
    "/fastlog",
    "quick-log",
    "root-modal",
    "/",
    false,
    "app/fastlog.tsx",
  ],
  [
    "/log",
    "/log",
    "quick-log",
    "root-card-custom-header",
    "/",
    true,
    "app/(tabs)/log.tsx",
  ],
  [
    "/health",
    "/health",
    "health",
    "primary-tab",
    "/health",
    true,
    "app/(tabs)/health.tsx",
  ],
  [
    "/trends",
    "/trends",
    "health",
    "owner-card-custom-header",
    "/health",
    true,
    "app/trends.tsx",
  ],
  [
    "/records",
    "/records",
    "health",
    "owner-card-custom-header",
    "/health",
    true,
    "app/(tabs)/records.tsx",
  ],
  [
    "/more",
    "/more",
    "more",
    "primary-tab",
    "/more",
    true,
    "app/(tabs)/more.tsx",
  ],
  [
    "/pack",
    "/pack",
    "more",
    "owner-card-custom-header",
    "/more",
    true,
    "app/(tabs)/pack.tsx",
  ],
  [
    "/profile",
    "/profile",
    "more",
    "owner-card-custom-header",
    "/more",
    true,
    "app/profile.tsx",
  ],
  [
    "/portrait",
    "/portrait",
    "more",
    "owner-card-custom-header",
    "/more",
    true,
    "app/portrait.tsx",
  ],
  [
    "/woofguide",
    "/woofguide",
    "more",
    "owner-card-native-header",
    "/more",
    true,
    "app/woofguide.tsx",
  ],
  [
    "/privacy",
    "/privacy",
    "more",
    "owner-card-custom-header",
    "/more",
    true,
    "app/privacy.tsx",
  ],
  [
    "/legal",
    "/legal",
    "more",
    "owner-card-custom-header",
    "/more",
    true,
    "app/legal.tsx",
  ],
  [
    "/premium",
    "/premium",
    "more",
    "owner-card-native-header",
    "/more",
    true,
    "app/premium.tsx",
  ],
  [
    "/sign-in",
    "/(auth)/sign-in",
    null,
    "system-gate",
    "/",
    false,
    "app/(auth)/sign-in.tsx",
  ],
  [
    "/sign-up",
    "/(auth)/sign-up",
    null,
    "system-gate",
    "/",
    false,
    "app/(auth)/sign-up.tsx",
  ],
  ["/setup", "/setup", null, "system-card", "/", false, "app/setup.tsx"],
  [
    "/care-twin-qa",
    "/care-twin-qa",
    null,
    "system-card",
    "/",
    false,
    "app/care-twin-qa.tsx",
  ],
] as const;

const CARE_EVENT_TYPES = [
  "meal",
  "treat",
  "water",
  "walk",
  "potty",
  "play",
  "training",
  "mood",
  "medication",
  "weight",
  "vomit",
  "symptom",
  "incident",
  "grooming",
  "alone",
  "note",
] as const;

function assertRejected(pathname: string, params: unknown): void {
  const result = parseAppRouteParams(pathname, params);
  assert.equal(
    result.ok,
    false,
    `${pathname} params should reject: ${JSON.stringify(params)}`,
  );
}

test("route contracts pin every canonical path, owner, presentation, fallback, shell, and current source", () => {
  assert.deepEqual(
    APP_ROUTE_CONTRACTS.map((route) => [
      route.pathname,
      route.routerHref,
      route.owner,
      route.presentation,
      route.coldStartFallback,
      route.shellVisible,
      route.sourceFile,
    ]),
    EXPECTED_ROUTES,
  );

  assert.equal(
    new Set(APP_ROUTE_CONTRACTS.map((route) => route.id)).size,
    APP_ROUTE_CONTRACTS.length,
  );
  assert.equal(
    new Set(APP_ROUTE_CONTRACTS.map((route) => route.pathname)).size,
    APP_ROUTE_CONTRACTS.length,
  );
});

test("presentation contracts are exhaustive across current and future root and owner stack consumers", () => {
  assert.deepEqual(Object.keys(APP_PRESENTATION_CONTRACTS), [
    "primary-tab",
    "secondary-tab",
    "owner-card-native-header",
    "owner-card-custom-header",
    "root-card-native-header",
    "root-card-custom-header",
    "root-modal",
    "system-gate",
    "system-card",
    "not-found",
  ]);

  assert.deepEqual(APP_PRESENTATION_CONTRACTS["owner-card-native-header"], {
    navigator: "owner-stack",
    presentation: "card",
    header: "native",
  });
  assert.deepEqual(APP_PRESENTATION_CONTRACTS["root-modal"], {
    navigator: "root-stack",
    presentation: "modal",
    header: "custom",
  });
});

test("known routes resolve exactly and unknown routes fail closed instead of becoming Today", () => {
  const records = resolveAppRoute("/records");
  assert.equal(records.kind, "known");
  if (records.kind === "known") {
    assert.equal(records.owner, "health");
    assert.equal(records.presentation, "owner-card-custom-header");
    assert.equal(records.coldStartFallback, "/health");
  }

  assert.deepEqual(resolveAppRoute("/records?tab=care"), {
    kind: "unknown",
    owner: null,
    presentation: "not-found",
    coldStartFallback: "/",
  });
  const signIn = resolveAppRoute("/sign-in");
  assert.equal(signIn.kind, "known");
  if (signIn.kind === "known") {
    assert.equal(signIn.routerHref, "/(auth)/sign-in");
    assert.equal(signIn.owner, null);
  }
  assert.deepEqual(resolveAppRoute("/(auth)/sign-in"), {
    kind: "unknown",
    owner: null,
    presentation: "not-found",
    coldStartFallback: "/",
  });
  assert.deepEqual(resolveAppRoute("/missing"), {
    kind: "unknown",
    owner: null,
    presentation: "not-found",
    coldStartFallback: "/",
  });
  assert.deepEqual(resolveAppRoute(["/"]), {
    kind: "unknown",
    owner: null,
    presentation: "not-found",
    coldStartFallback: "/",
  });
});

test("Quick Log origins are the exact approved care-surface set", () => {
  assert.deepEqual(QUICK_LOG_ORIGIN_PATHS, [
    "/",
    "/story",
    "/adventure",
    "/calendar",
    "/calendar-month",
    "/reminders",
    "/log",
    "/health",
    "/trends",
    "/records",
    "/more",
    "/pack",
    "/profile",
    "/portrait",
    "/woofguide",
    "/privacy",
    "/legal",
    "/premium",
  ]);

  for (const origin of QUICK_LOG_ORIGIN_PATHS) {
    assert.equal(parseQuickLogOrigin(origin), origin);
  }

  assert.deepEqual(
    QUICK_LOG_ORIGIN_PATHS,
    APP_ROUTE_CONTRACTS.filter((route) => route.shellVisible).map(
      (route) => route.pathname,
    ),
  );
});

test("Quick Log origin validation consumes one already-decoded exact scalar and fails closed", () => {
  for (const invalid of [
    "/fastlog",
    "/setup",
    "/care-twin-qa",
    "/sign-in",
    "/(auth)/sign-in",
    "/missing",
    "/log?entry=one",
    "/more#household",
    "/%6cog",
    "//log",
    String.raw`\log`,
    " /log",
    "/log ",
    "/lo g",
    "/log\u0000",
    "",
    null,
    undefined,
    ["/log"],
  ]) {
    assert.equal(
      parseQuickLogOrigin(invalid),
      null,
      `invalid origin accepted: ${String(invalid)}`,
    );
  }
});

test("/log accepts empty history or exactly one decoded launch variant", () => {
  assert.deepEqual(parseAppRouteParams("/log", {}), { ok: true, params: {} });
  assert.deepEqual(parseAppRouteParams("/log", { returnTo: "/records" }), {
    ok: true,
    params: { returnTo: "/records" },
  });
  assert.deepEqual(
    parseAppRouteParams("/log", { entry: "care entry / 50%", returnTo: "/" }),
    {
      ok: true,
      params: { entry: "care entry / 50%", returnTo: "/" },
    },
  );
  assert.deepEqual(
    parseAppRouteParams("/log", { type: "meal", detail: "1", intent: "0" }),
    {
      ok: true,
      params: { type: "meal", detail: "1", intent: "0" },
    },
  );
  assert.deepEqual(parseAppRouteParams("/log", { walk: "finish" }), {
    ok: true,
    params: { walk: "finish" },
  });
  assert.deepEqual(parseAppRouteParams("/log", { alone: "active" }), {
    ok: true,
    params: { alone: "active" },
  });

  for (const type of CARE_EVENT_TYPES) {
    assert.equal(
      parseAppRouteParams("/log", { type, detail: "1", intent: "42" }).ok,
      true,
    );
  }
});

test("/log rejects aliases, malformed numbers, duplicate values, mixed variants, and unknown keys", () => {
  const invalid = [
    { entry: "" },
    { entry: "x".repeat(129) },
    { entry: "entry\u0000id" },
    { entry: ["one", "two"] },
    { type: "meds", detail: "1", intent: "1" },
    { type: "Meal", detail: "1", intent: "1" },
    { type: " meal", detail: "1", intent: "1" },
    { type: "meal", detail: "true", intent: "1" },
    { type: "meal", detail: "1", intent: "-1" },
    { type: "meal", detail: "1", intent: "01" },
    { type: "meal", detail: "1", intent: "1.0" },
    { type: "meal", detail: "1", intent: String(Number.MAX_SAFE_INTEGER + 1) },
    { type: ["meal"], detail: "1", intent: "1" },
    { type: "meal", detail: "1" },
    { entry: "one", walk: "finish" },
    { walk: "finish", alone: "active" },
    { walk: "finish", extra: "value" },
    { returnTo: "/fastlog" },
  ];

  for (const params of invalid) assertRejected("/log", params);
});

test("route-specific parsers accept only their exact decoded schemas", () => {
  assert.deepEqual(parseAppRouteParams("/fastlog", {}), {
    ok: true,
    params: {},
  });
  assert.deepEqual(parseAppRouteParams("/fastlog", { origin: "/log" }), {
    ok: true,
    params: { origin: "/log" },
  });
  assertRejected("/fastlog", { origin: ["/log"] });
  assertRejected("/fastlog", { origin: "/fastlog" });

  assert.deepEqual(parseAppRouteParams("/health", { tab: "health" }), {
    ok: true,
    params: { tab: "health" },
  });
  assert.deepEqual(parseAppRouteParams("/health", { tab: "bile" }), {
    ok: true,
    params: { tab: "bile" },
  });
  assertRejected("/health", { tab: ["health", "bile"] });
  assertRejected("/health", { tab: "summary" });

  assert.deepEqual(
    parseAppRouteParams("/more", { section: "career", focus: "123" }),
    {
      ok: true,
      params: { section: "career", focus: "123" },
    },
  );
  assert.deepEqual(parseAppRouteParams("/more", { focus: "0" }), {
    ok: true,
    params: { focus: "0" },
  });
  for (const section of [
    "career",
    "household",
    "access",
    "care-pass",
    "diet",
  ]) {
    assert.equal(parseAppRouteParams("/more", { section }).ok, true);
  }
  assertRejected("/more", { section: "billing" });
  assertRejected("/more", { focus: "01" });

  assert.deepEqual(parseAppRouteParams("/legal", { doc: "privacy" }), {
    ok: true,
    params: { doc: "privacy" },
  });
  assert.deepEqual(parseAppRouteParams("/legal", { doc: "terms" }), {
    ok: true,
    params: { doc: "terms" },
  });
  assertRejected("/legal", { doc: ["privacy"] });
  assertRejected("/legal", { doc: "cookies" });
});

test("WoofGuide prompt validation counts decoded characters and rejects controls", () => {
  assert.deepEqual(
    parseAppRouteParams("/woofguide", { prompt: "Why is Phoenix restless?" }),
    {
      ok: true,
      params: { prompt: "Why is Phoenix restless?" },
    },
  );
  assert.equal(
    parseAppRouteParams("/woofguide", { prompt: "🐕".repeat(240) }).ok,
    true,
  );
  assertRejected("/woofguide", { prompt: "🐕".repeat(241) });
  assertRejected("/woofguide", { prompt: "" });
  assertRejected("/woofguide", { prompt: "unsafe\u001ftext" });
  assertRejected("/woofguide", { prompt: ["one", "two"] });
});

test("setup management params remain an exact system-only pair", () => {
  assert.deepEqual(parseAppRouteParams("/setup", {}), { ok: true, params: {} });
  assert.deepEqual(
    parseAppRouteParams("/setup", { mode: "manage", returnTo: "/more" }),
    {
      ok: true,
      params: { mode: "manage", returnTo: "/more" },
    },
  );
  assertRejected("/setup", { mode: "manage" });
  assertRejected("/setup", { returnTo: "/more" });
  assertRejected("/setup", { mode: "manage", returnTo: "/" });
});

test("unparameterized product routes reject hidden query state and QA stays a separate model", () => {
  assert.deepEqual(parseAppRouteParams("/records", {}), {
    ok: true,
    params: {},
  });
  assertRejected("/records", { tab: "care" });
  assertRejected("/", { qaReturn: "care-twin-qa" });
  assertRejected("/care-twin-qa", { qaSurface: "route-visual-consistency" });

  const qa = APP_ROUTE_CONTRACTS.find(
    (route) => route.pathname === "/care-twin-qa",
  );
  assert.equal(qa?.parameterModel, "external-qa");
});

test("typed href objects preserve decoded values for Expo Router's single encoding pass", () => {
  assert.deepEqual(buildAppHref("/"), { pathname: "/" });
  assert.deepEqual(
    buildAppHref("/log", { entry: "meal / 50%", returnTo: "/records" }),
    {
      pathname: "/log",
      params: { entry: "meal / 50%", returnTo: "/records" },
    },
  );
  assert.deepEqual(
    buildAppHref("/more", { section: "household", focus: "123" }),
    {
      pathname: "/more",
      params: { section: "household", focus: "123" },
    },
  );
  assert.deepEqual(buildAppHref("/sign-in"), {
    pathname: "/(auth)/sign-in",
  });

  assert.throws(
    () => buildAppHref("/log", { entry: ["one"] } as never),
    /Invalid navigation params/,
  );
  assert.throws(
    () => buildAppHref("/missing" as never, {}),
    /Unknown navigation route/,
  );
});
