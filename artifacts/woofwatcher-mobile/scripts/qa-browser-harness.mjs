import navigationManifestModule from "./universal-navigation-manifest.js";

const { UNIVERSAL_NAVIGATION_MANIFEST, UNIVERSAL_NAVIGATION_QA_ROUTES } =
  navigationManifestModule;

export const QA_OWNER_ONLY_ROUTE_PREFIXES = Object.freeze([
  "/sign-in",
  "/sign-up",
  "/care-twin-qa",
  "/premium",
]);

function isOwnerOnlyRoute(route) {
  const pathname = new URL(route, "https://woofwatcher.qa").pathname;
  return QA_OWNER_ONLY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Keep these route requirements explicit even when they also appear in the
// runtime supplement. The Set below deduplicates them, while this guard makes a
// future manifest refactor unable to silently drop either screenshot surface.
export const QA_STANDALONE_CONSUMER_ROUTES = Object.freeze([
  "/fastlog",
  "/calendar-month",
]);

export const QA_EXECUTABLE_CONSUMER_ROUTES = Object.freeze(
  [
    ...new Set([
      ...UNIVERSAL_NAVIGATION_QA_ROUTES,
      ...UNIVERSAL_NAVIGATION_MANIFEST.runtimeSupplementalRoutes,
      ...QA_STANDALONE_CONSUMER_ROUTES,
    ]),
  ].filter((route) => !isOwnerOnlyRoute(route)),
);

function filenamePart(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function screenshotNameForRoute(route) {
  const url = new URL(route, "https://woofwatcher.qa");
  const pathname =
    url.pathname === "/"
      ? "home"
      : filenamePart(url.pathname.replace(/^\/+/, ""));
  const query = [...url.searchParams.entries()]
    .map(([key, value]) => `${filenamePart(key)}-${filenamePart(value)}`)
    .join("--");
  return query ? `${pathname}--${query}` : pathname;
}

export function settleMsForRoute(route) {
  if (route === "/") return 4500;
  if (/avatar-studio|portrait/.test(route)) return 4000;
  if (/trends|story-progress|\/story(?:\?|$)/.test(route)) return 3800;
  if (/fastlog|sign-in|setup|premium|woofguide/.test(route)) return 3000;
  return 3500;
}

export const QA_SCREENSHOT_ROUTES = Object.freeze(
  QA_EXECUTABLE_CONSUMER_ROUTES.map((route) =>
    Object.freeze({
      name: screenshotNameForRoute(route),
      route,
      settle: settleMsForRoute(route),
    }),
  ),
);

const screenshotNames = QA_SCREENSHOT_ROUTES.map(({ name }) => name);
if (new Set(screenshotNames).size !== screenshotNames.length) {
  throw new Error("QA screenshot routes must have unique output names");
}

export function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`BASE_URL must use http or https: ${value}`);
  }
  return parsed.href.replace(/\/+$/, "");
}

export function routeUrl(baseUrl, route) {
  return `${normalizeBaseUrl(baseUrl)}${route}`;
}

export async function assertConsumerCandidatePreview(page, baseUrl) {
  const identityUrl = routeUrl(baseUrl, "/candidate-identity.json");
  const response = await page.request.get(identityUrl, { timeout: 15_000 });
  if (!response.ok()) {
    throw new Error(
      `QA requires an exact consumer candidate preview (${identityUrl} returned ${response.status()}). Build with smoke-web-export.js --candidate first.`,
    );
  }
  const identity = await response.json();
  if (
    identity?.kind !== "woofwatcher-web-candidate" ||
    identity?.buildProfile !== "production" ||
    identity?.ownerOpsVisible !== false ||
    typeof identity?.sourceCommit !== "string" ||
    typeof identity?.sourceTree !== "string"
  ) {
    throw new Error(
      "QA preview identity is not a production consumer candidate with owner tooling disabled.",
    );
  }
  return identity;
}

export function createPageDiagnostics(page) {
  const errors = {};
  let currentStep = "boot";

  const record = (message, step = currentStep) => {
    (errors[step] ??= []).push(String(message).slice(0, 500));
  };

  page.on("pageerror", (error) => {
    record(`pageerror: ${String(error)}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      record(`console: ${message.text()}`);
    }
  });
  page.on("dialog", (dialog) => {
    record(`unexpected ${dialog.type()} dialog: ${dialog.message()}`);
    void dialog.dismiss().catch((error) => {
      record(`could not dismiss unexpected dialog: ${String(error)}`);
    });
  });

  return {
    errors,
    record,
    setStep(step) {
      currentStep = step;
    },
  };
}

export function browserErrorCount(errors) {
  return Object.values(errors).reduce(
    (count, messages) => count + new Set(messages).size,
    0,
  );
}

export function screenshotSweepFailed({ errors, misses }) {
  return misses.length > 0 || browserErrorCount(errors) > 0;
}

export function printBrowserErrors(errors) {
  for (const [step, messages] of Object.entries(errors)) {
    for (const message of new Set(messages)) {
      console.error("ERROR", step, message);
    }
  }
}

export async function waitForStablePage(page, settle) {
  await page.waitForTimeout(settle);
  await page.evaluate(async () => {
    if (!document.fonts?.ready) return;
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  });
}

export async function scrollToReviewTail(page) {
  return page.evaluate(() => {
    const element = [...document.querySelectorAll("*")].find(
      (candidate) =>
        candidate.scrollHeight > candidate.clientHeight + 300 &&
        candidate.clientHeight > 400,
    );
    if (element) {
      element.scrollTop = element.scrollHeight;
      return true;
    }
    window.scrollTo(0, document.body.scrollHeight);
    return false;
  });
}
