import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCanonicalDestination } from "./navigationOwnership.ts";

test("canonical primary routes keep one predictable owner and Fast Log stays Log-owned", () => {
  const cases = [
    {
      input: { pathname: "/", params: { unexpected: "do-not-reflect" } },
      expected: { parent: "home", pathname: "/", replace: false },
    },
    {
      input: { pathname: "/log", params: { unexpected: "do-not-reflect" } },
      expected: { parent: "log", pathname: "/log", replace: false },
    },
    {
      input: { pathname: "/fastlog", params: { unexpected: "do-not-reflect" } },
      expected: { parent: "log", pathname: "/fastlog", replace: false },
    },
    {
      input: {
        pathname: "/calendar",
        params: { unexpected: "do-not-reflect" },
      },
      expected: { parent: "plans", pathname: "/calendar", replace: false },
    },
  ] as const;

  for (const { input, expected } of cases) {
    assert.deepEqual(
      resolveCanonicalDestination(input),
      expected,
      input.pathname,
    );
  }
});

test("Plans accepts only the explicit Reminder Center section and validated item IDs", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/calendar",
      params: {
        section: "reminders",
        item: "routine:morning.1",
        unexpected: "do-not-reflect",
      },
    }),
    {
      parent: "plans",
      pathname: "/calendar",
      params: { section: "reminders", item: "routine:morning.1" },
      replace: false,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/calendar",
      params: { section: "unknown", item: "routine:morning.1" },
    }),
    { parent: "plans", pathname: "/calendar", replace: true },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/calendar",
      params: {
        section: [123] as unknown as string[],
        item: "routine:morning.1",
      },
    }),
    { parent: "plans", pathname: "/calendar", replace: true },
  );
});

test("Health accepts only its closed sections and legacy tab aliases", () => {
  for (const section of [
    "overview",
    "health-watch",
    "bile-watch",
    "medications",
    "diet",
    "trends",
    "records",
    "dog-id",
    "care-pass",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/health",
        params: { section, ignored: "never-reflected" },
      }),
      {
        parent: "health",
        pathname: "/health",
        params: { section },
        replace: false,
      },
      section,
    );
  }

  assert.deepEqual(resolveCanonicalDestination({ pathname: "/health" }), {
    parent: "health",
    pathname: "/health",
    replace: false,
  });
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: { tab: "health" },
    }),
    {
      parent: "health",
      pathname: "/health",
      params: { section: "overview" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: { tab: ["bile", "health"] },
    }),
    {
      parent: "health",
      pathname: "/health",
      params: { section: "bile-watch" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: { section: ["diet", "records"], tab: "bile", leak: "no" },
    }),
    {
      parent: "health",
      pathname: "/health",
      params: { section: "diet" },
      replace: false,
    },
  );

  for (const params of [
    { section: "records<script>" },
    { section: ["unknown", "records"] },
    { tab: "unknown" },
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({ pathname: "/health", params }),
      {
        parent: "health",
        pathname: "/health",
        replace: true,
      },
    );
  }
});

test("canonical Records preserves only validated own entry and report identifiers", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: {
        section: "records",
        entry: ["entry_1", "ignored"],
        report: "report:weekly",
        item: "never-reflected",
      },
    }),
    {
      parent: "health",
      pathname: "/health",
      params: {
        section: "records",
        entry: "entry_1",
        report: "report:weekly",
      },
      replace: false,
    },
  );

  const inherited = Object.create({
    entry: "entry_inherited",
    report: "report_inherited",
  }) as Record<string, string>;
  inherited.section = "records";
  assert.deepEqual(
    resolveCanonicalDestination({ pathname: "/health", params: inherited }),
    {
      parent: "health",
      pathname: "/health",
      params: { section: "records" },
      replace: false,
    },
  );

  for (const invalid of [
    "",
    ".starts-with-punctuation",
    "contains space",
    "safe<script>",
    `a${"b".repeat(80)}`,
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/health",
        params: { section: "records", entry: invalid, report: invalid },
      }),
      {
        parent: "health",
        pathname: "/health",
        params: { section: "records" },
        replace: false,
      },
      invalid,
    );
  }
});

test("non-Records Health sections never retain Records identifiers", () => {
  for (const section of [
    "overview",
    "health-watch",
    "bile-watch",
    "medications",
    "diet",
    "trends",
    "dog-id",
    "care-pass",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/health",
        params: { section, entry: "entry_1", report: "report_1" },
      }),
      {
        parent: "health",
        pathname: "/health",
        params: { section },
        replace: false,
      },
      section,
    );
  }
});

test("More accepts only its closed sections and maps legacy aliases to their owners", () => {
  for (const section of [
    "dog-profile",
    "avatar-studio",
    "care-team",
    "care-team-supplies",
    "story-progress",
    "adventure",
    "woofguide",
    "settings",
    "privacy",
    "legal",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section, ignored: "never-reflected" },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section },
        replace: false,
      },
      section,
    );
  }

  assert.deepEqual(resolveCanonicalDestination({ pathname: "/more" }), {
    parent: "more",
    pathname: "/more",
    replace: false,
  });
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: { section: "root" },
    }),
    { parent: "more", pathname: "/more", replace: false },
  );

  const aliases = [
    [
      "diet",
      {
        parent: "health",
        pathname: "/health",
        params: { section: "diet" },
        replace: true,
      },
    ],
    [
      "care-pass",
      {
        parent: "health",
        pathname: "/health",
        params: { section: "care-pass" },
        replace: true,
      },
    ],
    [
      "carepass",
      {
        parent: "health",
        pathname: "/health",
        params: { section: "care-pass" },
        replace: true,
      },
    ],
    [
      "household",
      {
        parent: "more",
        pathname: "/more",
        params: { section: "care-team" },
        replace: true,
      },
    ],
    [
      "access",
      {
        parent: "more",
        pathname: "/more",
        params: { section: "care-team" },
        replace: true,
      },
    ],
    [
      "career",
      {
        parent: "more",
        pathname: "/more",
        params: { section: "story-progress" },
        replace: true,
      },
    ],
  ] as const;

  for (const [section, expected] of aliases) {
    assert.deepEqual(
      resolveCanonicalDestination({ pathname: "/more", params: { section } }),
      expected,
      section,
    );
  }
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: { section: ["household", "diet"], leak: "no" },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "care-team" },
      replace: true,
    },
  );

  for (const section of ["unknown", "legal<script>", ""] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section, leak: "no" },
      }),
      { parent: "more", pathname: "/more", replace: true },
      section,
    );
  }
});

test("canonical More children preserve only their section-owned query payload", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: {
        section: ["care-team-supplies", "privacy"],
        item: ["travel-leash", "ignored"],
        entry: "never-reflected",
        prompt: "never-reflected",
      },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "care-team-supplies", item: "travel-leash" },
      replace: false,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: {
        section: "story-progress",
        entry: ["entry.2", "ignored"],
        walk: "walk:active",
        item: "never-reflected",
        doc: "terms",
      },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: {
        section: "story-progress",
        entry: "entry.2",
        walk: "walk:active",
      },
      replace: false,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: {
        section: "woofguide",
        prompt: "🐕‍🦺 Café care",
        doc: "privacy",
      },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "woofguide", prompt: "🐕‍🦺 Café care" },
      replace: false,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: {
        section: "legal",
        doc: ["terms", "privacy"],
        prompt: "never-reflected",
      },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "legal", doc: "terms" },
      replace: false,
    },
  );
});

test("canonical More drops child payload from every non-owning section", () => {
  for (const section of [
    "root",
    "dog-profile",
    "avatar-studio",
    "care-team",
    "adventure",
    "settings",
    "privacy",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: {
          section,
          item: "travel-leash",
          entry: "entry.2",
          walk: "walk:active",
          prompt: "care prompt",
          doc: "terms",
        },
      }),
      section === "root"
        ? { parent: "more", pathname: "/more", replace: false }
        : {
            parent: "more",
            pathname: "/more",
            params: { section },
            replace: false,
          },
      section,
    );
  }

  const crossSectionCases = [
    ["care-team-supplies", { entry: "entry.2", walk: "walk:active" }],
    ["story-progress", { item: "travel-leash", prompt: "care prompt" }],
    ["woofguide", { item: "travel-leash", doc: "privacy" }],
    ["legal", { entry: "entry.2", prompt: "care prompt" }],
  ] as const;
  for (const [section, extraParams] of crossSectionCases) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section, ...extraParams },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section },
        replace: false,
      },
      section,
    );
  }
});

test("canonical More applies identifier boundaries and rejects inherited or malformed payload", () => {
  const maxIdentifier = `a${"b".repeat(79)}`;
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: { section: "care-team-supplies", item: maxIdentifier },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "care-team-supplies", item: maxIdentifier },
      replace: false,
    },
  );

  for (const invalid of [
    `a${"b".repeat(80)}`,
    ".starts-with-punctuation",
    "contains space",
    "safe<script>",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: {
          section: "story-progress",
          entry: invalid,
          walk: invalid,
        },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "story-progress" },
        replace: false,
      },
      invalid,
    );
  }

  for (const [section, inheritedPayload] of [
    ["care-team-supplies", { item: "travel-leash" }],
    ["story-progress", { entry: "entry.2", walk: "walk:active" }],
    ["woofguide", { prompt: "care prompt" }],
    ["legal", { doc: "terms" }],
  ] as const) {
    const inherited = Object.create(inheritedPayload) as Record<string, string>;
    inherited.section = section;
    assert.deepEqual(
      resolveCanonicalDestination({ pathname: "/more", params: inherited }),
      {
        parent: "more",
        pathname: "/more",
        params: { section },
        replace: false,
      },
      section,
    );
  }

  for (const malformed of [[123], [{}], [["travel-leash"]]] as const) {
    for (const [section, key] of [
      ["care-team-supplies", "item"],
      ["story-progress", "entry"],
      ["story-progress", "walk"],
      ["woofguide", "prompt"],
      ["legal", "doc"],
    ] as const) {
      assert.deepEqual(
        resolveCanonicalDestination({
          pathname: "/more",
          params: {
            section,
            [key]: malformed as unknown as string[],
          },
        }),
        {
          parent: "more",
          pathname: "/more",
          params: { section },
          replace: false,
        },
        `${section}:${key}`,
      );
    }
  }
});

test("canonical WoofGuide enforces Unicode prompt boundaries and contextual join controls", () => {
  for (const prompt of [
    "Café care",
    "🐕 care",
    "🐕‍🦺 care",
    "a\u200cb",
    "a\u200db",
    "🐕".repeat(280),
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section: "woofguide", prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide", prompt },
        replace: false,
      },
      prompt,
    );
  }

  for (const prompt of [
    "🐕".repeat(281),
    "line one\nline two",
    "care\u0000prompt",
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
    "a\u200c\u200db",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section: "woofguide", prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: false,
      },
      prompt,
    );
  }
});

test("canonical Legal accepts only its own closed document enum", () => {
  for (const doc of ["privacy", "terms"] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section: "legal", doc },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "legal", doc },
        replace: false,
      },
    );
  }

  for (const doc of [
    "cookies",
    ["cookies", "terms"],
    [123],
    [{}],
    [["terms"]],
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section: "legal", doc: doc as unknown as string },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "legal" },
        replace: false,
      },
    );
  }
});

test("legacy route files replace to their exact canonical parent", () => {
  const cases = [
    [
      { pathname: "/reminders" },
      {
        parent: "plans",
        pathname: "/calendar",
        params: { section: "reminders" },
        replace: true,
      },
    ],
    [
      { pathname: "/records" },
      {
        parent: "health",
        pathname: "/health",
        params: { section: "records" },
        replace: true,
      },
    ],
    [
      { pathname: "/trends" },
      {
        parent: "health",
        pathname: "/health",
        params: { section: "trends" },
        replace: true,
      },
    ],
    [
      { pathname: "/pack" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "care-team-supplies" },
        replace: true,
      },
    ],
    [
      { pathname: "/story" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "story-progress" },
        replace: true,
      },
    ],
    [
      { pathname: "/profile" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "dog-profile" },
        replace: true,
      },
    ],
    [
      { pathname: "/portrait" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "avatar-studio" },
        replace: true,
      },
    ],
    [
      { pathname: "/adventure" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "adventure" },
        replace: true,
      },
    ],
    [
      { pathname: "/woofguide" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    ],
    [
      { pathname: "/privacy" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "privacy" },
        replace: true,
      },
    ],
    [
      { pathname: "/legal" },
      {
        parent: "more",
        pathname: "/more",
        params: { section: "legal" },
        replace: true,
      },
    ],
  ] as const;

  for (const [input, expected] of cases) {
    assert.deepEqual(
      resolveCanonicalDestination(input),
      expected,
      input.pathname,
    );
  }
});

test("legacy routes preserve only validated identifiers and normalize arrays to their first scalar", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/reminders",
      params: { item: ["routine:morning.1", "ignored"], entry: "leak" },
    }),
    {
      parent: "plans",
      pathname: "/calendar",
      params: { section: "reminders", item: "routine:morning.1" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/records",
      params: {
        entry: "entry_1",
        report: ["report:weekly", "ignored"],
        item: "leak",
      },
    }),
    {
      parent: "health",
      pathname: "/health",
      params: { section: "records", entry: "entry_1", report: "report:weekly" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/pack",
      params: { item: "travel-leash", walk: "leak" },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "care-team-supplies", item: "travel-leash" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/story",
      params: {
        entry: ["entry.2", "ignored"],
        walk: "walk:active",
        report: "leak",
      },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: {
        section: "story-progress",
        entry: "entry.2",
        walk: "walk:active",
      },
      replace: true,
    },
  );

  const eightyCharacterIdentifier = `a${"b".repeat(79)}`;
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/pack",
      params: { item: eightyCharacterIdentifier },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: {
        section: "care-team-supplies",
        item: eightyCharacterIdentifier,
      },
      replace: true,
    },
  );

  for (const item of [
    `a${"b".repeat(80)}`,
    ".starts-with-punctuation",
    "contains space",
    "safe<script>",
    ["invalid value", "valid-second-value"],
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/reminders",
        params: { item, leak: "no" },
      }),
      {
        parent: "plans",
        pathname: "/calendar",
        params: { section: "reminders" },
        replace: true,
      },
    );
  }
});

test("WoofGuide and Legal preserve only bounded closed query values", () => {
  const maxPrompt = "P".repeat(280);
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/woofguide",
      params: { prompt: [maxPrompt, "ignored"], unsafe: "never-reflected" },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "woofguide", prompt: maxPrompt },
      replace: true,
    },
  );

  for (const prompt of [
    "P".repeat(281),
    "line one\nline two",
    "tab\tcharacter",
    "",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt, leak: "no" },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    );
  }

  for (const doc of ["privacy", "terms"] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/legal",
        params: { doc, leak: "no" },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "legal", doc },
        replace: true,
      },
    );
  }
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/legal",
      params: { doc: ["terms", "privacy"], leak: "no" },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "legal", doc: "terms" },
      replace: true,
    },
  );
  for (const doc of ["cookies", ["cookies", "terms"]] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/legal",
        params: { doc, leak: "no" },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "legal" },
        replace: true,
      },
    );
  }
});

test("unknown paths fall back to Home without reflecting path or query input", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/<script>alert(1)</script>",
      params: { section: "legal", prompt: "reflect me", item: "reflect-me" },
    }),
    { parent: "home", pathname: "/", replace: true },
  );
});

test("object prototype property names are never recognized as routes, tabs, or sections", () => {
  for (const pathname of ["toString", "__proto__", "constructor"] as const) {
    assert.deepEqual(resolveCanonicalDestination({ pathname }), {
      parent: "home",
      pathname: "/",
      replace: true,
    });
  }

  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: { tab: "toString" },
    }),
    { parent: "health", pathname: "/health", replace: true },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: { section: "constructor" },
    }),
    { parent: "more", pathname: "/more", replace: true },
  );
});

test("query values must be own properties before they can affect a destination", () => {
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/reminders",
      params: Object.create({ item: "routine:inherited" }),
    }),
    {
      parent: "plans",
      pathname: "/calendar",
      params: { section: "reminders" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/woofguide",
      params: Object.create({ prompt: "inherited prompt" }),
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "woofguide" },
      replace: true,
    },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/more",
      params: Object.create({ section: "diet" }),
    }),
    { parent: "more", pathname: "/more", replace: false },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: Object.create({ tab: "bile" }),
    }),
    { parent: "health", pathname: "/health", replace: false },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/legal",
      params: Object.create({ doc: "terms" }),
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "legal" },
      replace: true,
    },
  );
});

test("malformed scalar arrays and object values are treated as absent query input", () => {
  const malformedValues = [[123], [{}], [["diet"]]] as const;

  for (const value of malformedValues) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/more",
        params: { section: value as unknown as string[] },
      }),
      { parent: "more", pathname: "/more", replace: false },
    );
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/reminders",
        params: { item: value as unknown as string[] },
      }),
      {
        parent: "plans",
        pathname: "/calendar",
        params: { section: "reminders" },
        replace: true,
      },
    );
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt: value as unknown as string[] },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    );
  }

  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/health",
      params: { section: {} as unknown as string },
    }),
    { parent: "health", pathname: "/health", replace: false },
  );
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/legal",
      params: { doc: { value: "terms" } as unknown as string },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "legal" },
      replace: true,
    },
  );
});

test("WoofGuide preserves printable Unicode prompts and counts Unicode code points", () => {
  for (const prompt of ["Café care", "🐕 care", "🐕‍🦺 care"] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide", prompt },
        replace: true,
      },
    );
  }

  const maxUnicodePrompt = "🐕".repeat(280);
  assert.deepEqual(
    resolveCanonicalDestination({
      pathname: "/woofguide",
      params: { prompt: maxUnicodePrompt },
    }),
    {
      parent: "more",
      pathname: "/more",
      params: { section: "woofguide", prompt: maxUnicodePrompt },
      replace: true,
    },
  );

  for (const prompt of [
    "🐕".repeat(281),
    "line one\nline two",
    "line one\rline two",
    "control\u0000character",
    "delete\u007fcharacter",
    "line\u2028separator",
    "paragraph\u2029separator",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    );
  }
});

test("WoofGuide rejects invisible and bidirectional Unicode format controls", () => {
  for (const formatControl of [
    "\u00ad",
    "\u200b",
    "\u200e",
    "\u202e",
    "\u2066",
    "\ufeff",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt: `care${formatControl}prompt` },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    );
  }
});

test("WoofGuide accepts join controls only between printable non-whitespace code points", () => {
  for (const prompt of ["a\u200cb", "a\u200db", "🐕\u200d🦺 care"] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide", prompt },
        replace: true,
      },
    );
  }

  for (const prompt of [
    "\u200c",
    "\u200d",
    "\u200cstart",
    "\u200dstart",
    "end\u200c",
    "end\u200d",
    "a \u200cb",
    "a\u200c b",
    "a \u200db",
    "a\u200d b",
    "a\u200c\u200db",
    "a\u00ad\u200db",
    "a\n\u200db",
    "a\u200d\nb",
  ] as const) {
    assert.deepEqual(
      resolveCanonicalDestination({
        pathname: "/woofguide",
        params: { prompt },
      }),
      {
        parent: "more",
        pathname: "/more",
        params: { section: "woofguide" },
        replace: true,
      },
    );
  }
});
