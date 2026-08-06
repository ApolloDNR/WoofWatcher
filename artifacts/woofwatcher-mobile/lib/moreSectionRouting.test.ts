import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = existsSync(join(process.cwd(), "artifacts", "woofwatcher-mobile"))
  ? join(process.cwd(), "artifacts", "woofwatcher-mobile")
  : process.cwd();
const readSource = (...parts: string[]) => {
  const path = join(MOBILE_ROOT, ...parts);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

async function readRoutingModule() {
  return import("./moreSectionRouting.ts");
}

test("More section navigation delegates one history entry to Expo Router", async () => {
  const routing = await readRoutingModule();
  const navigateToMoreSection = Reflect.get(
    routing,
    "navigateToMoreSection",
  ) as unknown;
  assert.equal(
    typeof navigateToMoreSection,
    "function",
    "More routing should expose its Expo-owned navigation boundary",
  );

  const routerEntries: unknown[] = [];
  const browserEntries: unknown[] = [];
  const previousWindow = Reflect.get(globalThis, "window");
  Reflect.set(globalThis, "window", {
    history: {
      pushState: (...args: unknown[]) => browserEntries.push(args),
    },
  });
  try {
    (
      navigateToMoreSection as (
        push: (destination: unknown) => void,
        section: string,
        ownedParams?: { doc: "privacy" | "terms" },
      ) => void
    )((destination) => routerEntries.push(destination), "legal", {
      doc: "terms",
    });
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Reflect.set(globalThis, "window", previousWindow);
    }
  }

  assert.deepEqual(routerEntries, [
    { pathname: "/more", params: { section: "legal", doc: "terms" } },
  ]);
  assert.deepEqual(browserEntries, []);

  for (const owner of [
    readSource("app", "(tabs)", "more.tsx"),
    readSource("components", "more", "MoreSectionRouter.tsx"),
  ]) {
    assert.match(owner, /navigateToMoreSection/);
    assert.doesNotMatch(owner, /window\.history|pushState/);
  }
});

test("maps every canonical More section to one closed substantive owner", async () => {
  const { MORE_SECTION_TARGETS } = await readRoutingModule();
  assert.deepEqual(MORE_SECTION_TARGETS, {
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
  });
  assert.doesNotMatch(
    JSON.stringify(MORE_SECTION_TARGETS),
    /\/(?:pack|story|profile|portrait|adventure|woofguide|privacy|legal)/,
  );
});

test("exposes only the validated payload owned by the selected More target", async () => {
  const { resolveMoreSectionRoute } = await readRoutingModule();
  const cases = [
    [
      {
        section: "care-team-supplies",
        item: ["travel-leash", "ignored"],
        entry: "never-reflected",
      },
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: { section: "care-team-supplies", item: "travel-leash" },
          replace: false,
        },
        section: "care-team-supplies",
        target: {
          kind: "care-team-supplies",
          section: "care-team-supplies",
        },
        itemId: "travel-leash",
      },
    ],
    [
      {
        section: "story-progress",
        entry: "entry.2",
        walk: ["walk:active", "ignored"],
        doc: "terms",
      },
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: {
            section: "story-progress",
            entry: "entry.2",
            walk: "walk:active",
          },
          replace: false,
        },
        section: "story-progress",
        target: { kind: "story-progress" },
        entryId: "entry.2",
        walkId: "walk:active",
      },
    ],
    [
      { section: "woofguide", prompt: "🐕‍🦺 Café care", doc: "terms" },
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: { section: "woofguide", prompt: "🐕‍🦺 Café care" },
          replace: false,
        },
        section: "woofguide",
        target: { kind: "woofguide" },
        prompt: "🐕‍🦺 Café care",
      },
    ],
    [
      { section: "legal", doc: "privacy", prompt: "never-reflected" },
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: { section: "legal", doc: "privacy" },
          replace: false,
        },
        section: "legal",
        target: { kind: "legal" },
        legalDocument: "privacy",
      },
    ],
  ] as const;

  for (const [params, expected] of cases) {
    assert.deepEqual(resolveMoreSectionRoute(params), expected, params.section);
  }
});

test("converges More aliases and Health escapes without reflecting extra payload", async () => {
  const { resolveMoreSectionRoute } = await readRoutingModule();
  for (const section of ["household", "access"] as const) {
    assert.deepEqual(
      resolveMoreSectionRoute({ section, item: "never-reflected" }),
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: { section: "care-team" },
          replace: true,
        },
        section: "care-team",
        target: { kind: "care-team-supplies", section: "care-team" },
      },
      section,
    );
  }
  assert.deepEqual(
    resolveMoreSectionRoute({
      section: "career",
      entry: "never-reflected",
      walk: "never-reflected",
    }),
    {
      destination: {
        parent: "more",
        pathname: "/more",
        params: { section: "story-progress" },
        replace: true,
      },
      section: "story-progress",
      target: { kind: "story-progress" },
    },
  );

  for (const [section, healthSection] of [
    ["diet", "diet"],
    ["care-pass", "care-pass"],
    ["carepass", "care-pass"],
  ] as const) {
    assert.deepEqual(
      resolveMoreSectionRoute({ section, item: "never-reflected" }),
      {
        destination: {
          parent: "health",
          pathname: "/health",
          params: { section: healthSection },
          replace: true,
        },
        section: "root",
        target: { kind: "root" },
      },
      section,
    );
  }
});

test("fails closed on unknown, inherited, malformed, and cross-section payload", async () => {
  const { resolveMoreSectionRoute } = await readRoutingModule();
  assert.deepEqual(
    resolveMoreSectionRoute({
      section: "unknown",
      item: "travel-leash",
      prompt: "care prompt",
    }),
    {
      destination: { parent: "more", pathname: "/more", replace: true },
      section: "root",
      target: { kind: "root" },
    },
  );

  const inherited = Object.create({
    item: "travel-leash",
    entry: "entry.2",
    walk: "walk:active",
    prompt: "care prompt",
    doc: "terms",
  }) as Record<string, string>;
  inherited.section = "legal";
  assert.deepEqual(resolveMoreSectionRoute(inherited), {
    destination: {
      parent: "more",
      pathname: "/more",
      params: { section: "legal" },
      replace: false,
    },
    section: "legal",
    target: { kind: "legal" },
  });

  for (const malformed of [[123], [{}], [["travel-leash"]]] as const) {
    assert.deepEqual(
      resolveMoreSectionRoute({
        section: "care-team-supplies",
        item: malformed as unknown as string[],
      }),
      {
        destination: {
          parent: "more",
          pathname: "/more",
          params: { section: "care-team-supplies" },
          replace: false,
        },
        section: "care-team-supplies",
        target: {
          kind: "care-team-supplies",
          section: "care-team-supplies",
        },
      },
    );
  }

  assert.deepEqual(
    resolveMoreSectionRoute({
      section: "privacy",
      item: "travel-leash",
      entry: "entry.2",
      walk: "walk:active",
      prompt: "care prompt",
      doc: "terms",
    }),
    {
      destination: {
        parent: "more",
        pathname: "/more",
        params: { section: "privacy" },
        replace: false,
      },
      section: "privacy",
      target: { kind: "privacy" },
    },
  );
});

test("keeps identifier, prompt, and legal-document boundaries centralized", async () => {
  const { resolveMoreSectionRoute } = await readRoutingModule();
  const maxIdentifier = `a${"b".repeat(79)}`;
  assert.equal(
    resolveMoreSectionRoute({
      section: "care-team-supplies",
      item: maxIdentifier,
    }).itemId,
    maxIdentifier,
  );
  assert.equal(
    resolveMoreSectionRoute({
      section: "care-team-supplies",
      item: `a${"b".repeat(80)}`,
    }).itemId,
    undefined,
  );

  for (const prompt of [
    "Café care",
    "🐕 care",
    "🐕‍🦺 care",
    "a\u200cb",
    "a\u200db",
    "🐕".repeat(280),
  ] as const) {
    assert.equal(
      resolveMoreSectionRoute({ section: "woofguide", prompt }).prompt,
      prompt,
    );
  }
  for (const prompt of [
    "🐕".repeat(281),
    "line one\nline two",
    "care\u00adprompt",
    "care\u200bprompt",
    "care\u200eprompt",
    "care\u202eprompt",
    "care\u2066prompt",
    "care\ufeffprompt",
    "\u200cstart",
    "end\u200d",
    "a \u200cb",
    "a\u200d b",
  ] as const) {
    assert.equal(
      resolveMoreSectionRoute({ section: "woofguide", prompt }).prompt,
      undefined,
      prompt,
    );
  }

  for (const doc of ["privacy", "terms"] as const) {
    assert.equal(
      resolveMoreSectionRoute({ section: "legal", doc }).legalDocument,
      doc,
    );
  }
  for (const doc of ["cookies", ["cookies", "terms"]] as const) {
    assert.equal(
      resolveMoreSectionRoute({
        section: "legal",
        doc: doc as unknown as string,
      }).legalDocument,
      undefined,
    );
  }
});

test("renders every closed More target through the one canonical router", () => {
  const router = readSource("components", "more", "MoreSectionRouter.tsx");
  assert.match(router, /MORE_SECTION_TARGETS/);
  for (const kind of ["root", "dog-profile", "avatar-studio", "care-team-supplies", "story-progress", "adventure", "woofguide", "settings", "privacy", "legal"]) {
    assert.ok(router.includes(`case "${kind}"`), kind);
  }
  assert.match(router, /<DogProfileScreen\s+surface="tabbed"/);
  assert.match(router, /<AvatarStudioScreen\s+surface="tabbed"/);
  assert.match(router, /<CareTeamSuppliesScreen\s+section=\{target\.section\}\s+itemId=\{itemId\}\s+onBack=\{onBack\}/);
  assert.match(router, /<StoryProgressScreen[\s\S]*entryId=\{entryId\}[\s\S]*walkId=\{walkId\}[\s\S]*onOpenAdventure=\{\(\) => pushMore\("adventure"\)\}/);
  assert.match(router, /navigateToMoreSection/);
  assert.doesNotMatch(router, /useLocalSearchParams|resolveCanonicalDestination/);
});

test("keeps every legacy More path as a replace-only resolver bridge", () => {
  const cases = [
    [["app", "(tabs)", "pack.tsx"], "/pack"],
    [["app", "(tabs)", "story.tsx"], "/story"],
    [["app", "profile.tsx"], "/profile"],
    [["app", "portrait.tsx"], "/portrait"],
    [["app", "adventure.tsx"], "/adventure"],
    [["app", "woofguide.tsx"], "/woofguide"],
    [["app", "privacy.tsx"], "/privacy"],
    [["app", "legal.tsx"], "/legal"],
  ] as const;
  for (const [parts, legacyPath] of cases) {
    const route = readSource(...parts);
    assert.match(route, /useLocalSearchParams/, legacyPath);
    assert.match(route, /resolveCanonicalDestination/, legacyPath);
    assert.match(route, new RegExp(`pathname:\\s*"${legacyPath}"`), legacyPath);
    assert.match(route, /<Redirect\s+href=\{redirectHref\}\s*\/>/, legacyPath);
    assert.doesNotMatch(route, /useRouter|router\.(?:push|back|replace)|useCare|useAvatar|useState|StyleSheet|ScrollView|updateCareDoc|addEntry|deleteEntry/, legacyPath);
  }
});
