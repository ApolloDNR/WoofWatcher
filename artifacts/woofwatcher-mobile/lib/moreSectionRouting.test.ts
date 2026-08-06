import assert from "node:assert/strict";
import { test } from "node:test";

async function readRoutingModule() {
  return import("./moreSectionRouting.ts");
}

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
