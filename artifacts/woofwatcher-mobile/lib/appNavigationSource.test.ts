import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  APP_ROUTE_CONTRACTS,
  CURRENT_NAVIGATION_LAYOUT_SOURCE_FILES,
  LEGACY_DIRECT_FAST_LOG_SOURCE_FILES,
  LEGACY_DYNAMIC_ROUTER_CALL_COUNTS,
  NAVIGATION_ROUTER_SOURCE_FILES,
  NOT_FOUND_ROUTE_SOURCE_FILE,
} from "./appNavigation.ts";
import {
  hasNavigationSource,
  scanNavigationSource,
} from "../scripts/navigation-source-scan.ts";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const mobileRoot = path.join(repoRoot, "artifacts/woofwatcher-mobile");

const EXPECTED_ROUTER_SOURCES = [
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

const EXPECTED_DIRECT_FAST_LOG_SOURCES = [
  "app/(tabs)/_layout.tsx",
  "app/(tabs)/index.tsx",
  "app/(tabs)/log.tsx",
  "app/calendar-month.tsx",
] as const;

const EXPECTED_DYNAMIC_ROUTER_CALL_COUNTS = {
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

async function sourceFilesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFilesBelow(absolute);
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [absolute] : [];
    }),
  );
  return nested.flat();
}

test("route manifest references one existing current source per canonical route", async () => {
  for (const route of APP_ROUTE_CONTRACTS) {
    const source = path.join(mobileRoot, route.sourceFile);
    assert.equal(
      (await stat(source)).isFile(),
      true,
      `${route.pathname} source is missing: ${route.sourceFile}`,
    );
  }
});

test("current root, auth, tabs, and not-found topology is explicit before route migration", async () => {
  assert.deepEqual(CURRENT_NAVIGATION_LAYOUT_SOURCE_FILES, [
    "app/_layout.tsx",
    "app/(auth)/_layout.tsx",
    "app/(tabs)/_layout.tsx",
  ]);
  assert.equal(NOT_FOUND_ROUTE_SOURCE_FILE, "app/+not-found.tsx");

  for (const sourceFile of [
    ...CURRENT_NAVIGATION_LAYOUT_SOURCE_FILES,
    NOT_FOUND_ROUTE_SOURCE_FILE,
  ]) {
    assert.equal(
      (await stat(path.join(mobileRoot, sourceFile))).isFile(),
      true,
      `current navigation topology source is missing: ${sourceFile}`,
    );
  }
});

test("source scanner distinguishes direct Fast Log launches, static object hrefs, and dynamic calls", () => {
  const source = `
    router.push("/fastlog" as never);
    router.replace({ pathname: "/log", params: { entry: id } });
    router.navigate(nextRoute);
    const copy = "/fastlog";
  `;
  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 1,
    dynamicRouterCallCount: 1,
    staticRouterCallCount: 2,
  });
});

test("source scanner does not treat comments, copy, or longer paths as launch calls", () => {
  const source = `
    // router.push("/fastlog");
    const copy = "Open /fastlog";
    router.push("/fastlogger");
    router.push({ pathname: "/fastlogger" });
  `;
  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 0,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 2,
  });
});

test("source scanner counts router and Link Fast Log query and fragment literals after cooking", () => {
  const source = String.raw`
    import { Link as RouterLink } from "expo-router";

    router.push("/fastlog?origin=%2Flog");
    router.replace("/fastlog#recent");
    router.navigate("/fast\x6cog\u003forigin=%2Flog");
    router.dismissTo("/fastlog\x23recent");

    <RouterLink href="/fastlog?origin=%2Flog" />;
    <RouterLink href={"/fastlog#recent"} />;
    <RouterLink href={"/fast\x6cog\u003forigin=%2Flog"} />;
    <RouterLink href={"/fastlog\x23recent"} />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 8,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 8,
  });
});

test("source scanner counts canonical absolute Fast Log object hrefs with suffixes and params", () => {
  const source = String.raw`
    import { Link as RouterLink, router as rootRouter } from "expo-router";
    import * as Navigation from "expo-router";

    rootRouter.push({ pathname: "/fastlog?origin=%2Flog" });
    rootRouter.replace({ pathname: "/fastlog#recent" });
    rootRouter.navigate({ pathname: "/fast\x6cog\u003forigin=%2Flog" });
    rootRouter.dismissTo({
      pathname: "/fastlog",
      params: { origin: "/log" },
    });
    <RouterLink href={{ pathname: "/fastlog#recent" }} />;
    <Navigation.Link
      href={{ pathname: "/fast\x6cog", params: { origin: "/log" } }}
    />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 6,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 6,
  });
});

// Characterizes the installed expo-router@6.0.24 linkTo order:
// resolveHref(object) -> shouldLinkExternally -> segment resolver -> path parser.
test("source scanner keeps scheme-relative Fast Log hrefs external before slash normalization", () => {
  const source = String.raw`
    import { Link as RouterLink, router as rootRouter } from "expo-router";
    import * as Navigation from "expo-router";

    rootRouter.push("//fastlog?origin=%2Flog");
    rootRouter.replace("///fastlog#recent");
    rootRouter.navigate("/\x2ffast\x6cog\u003forigin=%2Flog");
    rootRouter.dismissTo({ pathname: "//fastlog#recent" });
    rootRouter.push({ pathname: "/\x2f/fastlog?origin=%2Flog" });
    <RouterLink href="//fastlog#recent" />;
    <Navigation.Link href={"/\x2ffastlog\u003forigin=%2Flog"} />;
    <RouterLink href={{ pathname: "///fastlog#recent" }} />;

    rootRouter.push("https://example.com/fastlog?origin=%2Flog");
    rootRouter.replace("woof://fastlog#recent");
    <Navigation.Link href="https://example.com/fastlog#recent" />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 0,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 11,
  });
});

test("source scanner keeps dot-relative Fast Log hrefs dynamic across Router and Link aliases", () => {
  const source = String.raw`
    import { Link as RouterLink, router as rootRouter } from "expo-router";
    import * as Navigation from "expo-router";

    rootRouter.push("./fastlog#recent");
    rootRouter.replace(".\x2ffastlog\u003forigin=%2Flog");
    rootRouter.navigate({ pathname: "./fastlog#recent" });
    <RouterLink href="./fastlog#recent" />;
    <Navigation.Link href={".\x2ffastlog\u003forigin=%2Flog"} />;
    <RouterLink href={{ pathname: ".\x2ffastlog#recent" }} />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 0,
    dynamicRouterCallCount: 6,
    staticRouterCallCount: 0,
  });
});

test("source scanner makes parser-normalized internal hrefs dynamic", () => {
  const source = String.raw`
    import { Link as RouterLink, router as rootRouter } from "expo-router";
    import * as Navigation from "expo-router";

    rootRouter.push("\\fastlog?origin=%2Flog");
    rootRouter.replace("/today/../fastlog#recent");
    rootRouter.navigate("/fastlog/.?origin=%2Flog");
    rootRouter.dismissTo("/fastlog//?origin=%2Flog");
    rootRouter.push(" /fastlog?origin=%2Flog");
    rootRouter.replace("/fastlog#recent ");
    rootRouter.navigate("\t/fastlog?origin=%2Flog");
    rootRouter.dismissTo("/fastlog?origin=%2Flog\n");
    rootRouter.push("/%66astlog?origin=%2Flog");
    rootRouter.replace("/%2Ffastlog#recent");
    rootRouter.navigate("/fastlog%2F?origin=%2Flog");
    rootRouter.push("fastlog?origin=%2Flog");

    rootRouter.push({ pathname: "\\fastlog?origin=%2Flog" });
    rootRouter.replace({ pathname: "/today/../fastlog#recent" });
    <Navigation.Link href={"\\fastlog#recent"} />;
    <RouterLink href="/today/../fastlog#recent" />;
    <RouterLink href="/fastlog/.?origin=%2Flog" />;
    <Navigation.Link href={"/fastlog//?origin=%2Flog"} />;
    <RouterLink href={{ pathname: " /fastlog?origin=%2Flog" }} />;
    <Navigation.Link href={"\0/fastlog#recent"} />;
    <Navigation.Link href={{ pathname: "/%66astlog#recent" }} />;
    <RouterLink href={{ pathname: "/fastlog/?origin=%2Flog" }} />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 0,
    dynamicRouterCallCount: 22,
    staticRouterCallCount: 0,
  });
});

test("source scanner keeps object pathname interpolation dynamic", () => {
  const source = String.raw`
    import { Link as RouterLink, router as rootRouter } from "expo-router";
    import * as Navigation from "expo-router";

    rootRouter.push({ pathname: "/[slug]", params: { slug: "fastlog" } });
    rootRouter.replace({
      pathname: "/fastlog/[segment]",
      params: { segment: ".." },
    });
    <RouterLink href={{ pathname: "/[slug]", params: { slug: nextSlug } }} />;
    <Navigation.Link
      href={{ pathname: "/\x5bslug\x5d", params: { slug: "fastlog" } }}
    />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 0,
    dynamicRouterCallCount: 4,
    staticRouterCallCount: 0,
  });
});

test("source scanner keeps clear external and clean longer paths static non-direct", () => {
  const source = String.raw`
    router.push("https://example.com/fastlog?origin=%2Flog");
    router.push("https:\x2f\x2fexample.com/fastlog#recent");
    router.push("/fastlogger?origin=%2Flog");
    router.push("/fastlog/child#recent");
    router.push({ pathname: "https://example.com/fastlog#recent" });
    router.push({ pathname: "/fastlogger", params: { origin: "/log" } });
    router.push({ pathname: "/fast\x6cog", params: { origin: "/log" } });

    <Link href="https://example.com/fastlog?origin=%2Flog" />;
    <Link href="/fastlogger?origin=%2Flog" />;
    <Link href="/fastlog/child#recent" />;
    <Link href={{ pathname: "/fastlogger", params: { origin: "/log" } }} />;
    <Link href={{ pathname: "/fast\x6cog", params: { origin: "/log" } }} />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 2,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 12,
  });
});

test("source scanner compares cooked literal values and ignores literal/comment decoys", () => {
  const source = [
    String.raw`router.push("/fast\x6cog");`,
    String.raw`router.replace('/fast\u006cog' as never);`,
    `const doubleQuotedDecoy = "router.push('/fastlog')";`,
    'const templateDecoy = `router.replace("/fastlog")`;',
    `// router.navigate("/fastlog");`,
    `/* router.dismissTo("/fastlog"); */`,
  ].join("\n");

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 2,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 2,
  });
});

test("source scanner treats only one unambiguous top-level literal pathname as static", () => {
  const source = `
    router.push({ pathname: "/fastlog", params: { entry: id } });
    router.push({ params: { pathname: "/fastlog" } });
    router.push({ pathname: "/fastlog", pathname: "/records" });
    router.push({ pathname: "/fastlog", ...overrides });
    router.push({ ...baseHref, pathname: "/fastlog" });
    router.push({ ["pathname"]: "/fastlog" });
    router.push({ pathname: "/fastlog", [field]: value });
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 1,
    dynamicRouterCallCount: 6,
    staticRouterCallCount: 1,
  });
});

test("source scanner follows Expo Router aliases and computed navigation calls", () => {
  const source = `
    import {
      router as rootRouter,
      useRouter as useNavigation,
    } from "expo-router";

    const nav = useNavigation();
    const navAlias = nav;
    const pushAlias = nav.push;
    const { replace: replaceAlias, navigate: navigateAlias } = nav;

    nav["push"]("/fastlog");
    navAlias[\`dismissTo\`]({ pathname: "/fastlog" });
    pushAlias("/fastlog");
    replaceAlias({ pathname: "/fastlog" });
    navigateAlias(nextRoute);
    rootRouter[method]("/fastlog");
    nav.back();
    nav.canGoBack();
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 4,
    dynamicRouterCallCount: 2,
    staticRouterCallCount: 4,
  });
});

test("source scanner includes aliased Link hrefs and fails closed on ambiguous JSX", () => {
  const source = String.raw`
    import { Link as RouterLink } from "expo-router";
    const LinkAlias = RouterLink;

    <RouterLink href={"/fast\x6cog"}>Open</RouterLink>;
    <LinkAlias href={{ pathname: "/fastlog", params: { origin: "/" } }} />;
    <RouterLink href="/fast&#x6c;og" />;
    <RouterLink href={nextRoute} />;
    <RouterLink {...linkProps} href="/fastlog" />;
    <RouterLink href="/fastlog" {...linkProps} />;
    <RouterLink href={{ pathname: "/fastlog", ...hrefOverrides }} />;
    <RouterLink href={{ params: { pathname: "/fastlog" } }} />;
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 2,
    dynamicRouterCallCount: 6,
    staticRouterCallCount: 2,
  });
});

test("destinationless back calls stay outside href debt while dismissTo is inspected", () => {
  const source = `
    router.back();
    router.canGoBack();
    router.dismissAll();
    router.dismissTo("/fastlog");
  `;

  assert.deepEqual(scanNavigationSource(source), {
    directFastLogLaunchCount: 1,
    dynamicRouterCallCount: 0,
    staticRouterCallCount: 1,
  });
});

test("source scanner parses TypeScript and TSX with their real source kinds", () => {
  assert.deepEqual(
    scanNavigationSource(
      `router.push(<string>"/fastlog");`,
      "navigation-source.ts",
    ),
    {
      directFastLogLaunchCount: 1,
      dynamicRouterCallCount: 0,
      staticRouterCallCount: 1,
    },
  );
  assert.deepEqual(
    scanNavigationSource(
      `<Link href={{ pathname: "/fastlog" }} />;`,
      "navigation-source.tsx",
    ),
    {
      directFastLogLaunchCount: 1,
      dynamicRouterCallCount: 0,
      staticRouterCallCount: 1,
    },
  );
});

test("router-bearing source ledger is exact so new uncontracted navigation cannot appear silently", async () => {
  assert.deepEqual(NAVIGATION_ROUTER_SOURCE_FILES, EXPECTED_ROUTER_SOURCES);

  const sourceFiles = [
    ...(await sourceFilesBelow(path.join(mobileRoot, "app"))),
    ...(await sourceFilesBelow(path.join(mobileRoot, "components"))),
  ];
  const routerFiles: string[] = [];
  for (const absolute of sourceFiles) {
    const source = await readFile(absolute, "utf8");
    if (hasNavigationSource(source, absolute)) {
      routerFiles.push(
        path.relative(mobileRoot, absolute).split(path.sep).join("/"),
      );
    }
  }
  routerFiles.sort();

  assert.deepEqual(routerFiles, EXPECTED_ROUTER_SOURCES);
});

test("legacy direct Fast Log debt is exact and cannot expand before typed-origin migration", async () => {
  assert.deepEqual(
    LEGACY_DIRECT_FAST_LOG_SOURCE_FILES,
    EXPECTED_DIRECT_FAST_LOG_SOURCES,
  );

  const directLaunchFiles: string[] = [];
  for (const sourceFile of NAVIGATION_ROUTER_SOURCE_FILES) {
    const source = await readFile(path.join(mobileRoot, sourceFile), "utf8");
    const count = scanNavigationSource(
      source,
      sourceFile,
    ).directFastLogLaunchCount;
    const expectedCount = EXPECTED_DIRECT_FAST_LOG_SOURCES.includes(
      sourceFile as (typeof EXPECTED_DIRECT_FAST_LOG_SOURCES)[number],
    )
      ? 1
      : 0;
    assert.equal(
      count,
      expectedCount,
      `${sourceFile} changed its direct /fastlog debt`,
    );
    if (count > 0) {
      directLaunchFiles.push(sourceFile);
    }
  }
  directLaunchFiles.sort();

  assert.deepEqual(directLaunchFiles, EXPECTED_DIRECT_FAST_LOG_SOURCES);
});

test("legacy dynamic router-call debt is counted per file and cannot expand silently", async () => {
  assert.deepEqual(
    LEGACY_DYNAMIC_ROUTER_CALL_COUNTS,
    EXPECTED_DYNAMIC_ROUTER_CALL_COUNTS,
  );

  for (const sourceFile of NAVIGATION_ROUTER_SOURCE_FILES) {
    const source = await readFile(path.join(mobileRoot, sourceFile), "utf8");
    const expectedCount =
      EXPECTED_DYNAMIC_ROUTER_CALL_COUNTS[
        sourceFile as keyof typeof EXPECTED_DYNAMIC_ROUTER_CALL_COUNTS
      ] ?? 0;
    assert.equal(
      scanNavigationSource(source, sourceFile).dynamicRouterCallCount,
      expectedCount,
      `${sourceFile} changed its dynamic router-call debt`,
    );
  }
});
