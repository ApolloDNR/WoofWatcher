# WoofWatcher Premium Navigation and UX Plan

**Status:** Independently approved for staged execution

**Approved implementation base:** `86a69a099fdeaa1adabf8b67573827f0e10437f1`

**Canonical app:** `artifacts/woofwatcher-mobile`

**Execution rule:** Deliver one reviewed slice at a time. Do not collapse route contracts, topology, authentication continuation, visual polish, and native proof into one change.

## Product standard

WoofWatcher should feel obvious to a child or senior without becoming simplistic for a power user. A user must always know:

1. where they are;
2. what the primary action is;
3. how to go back;
4. what will happen after a tap;
5. whether an action changes care data;
6. how to recover from a cold start, deep link, authentication gate, modal dismissal, or interrupted transition.

The target is a calm, premium care product: four stable destinations, one globally available logging action, predictable back behavior, native gestures where they are expected, strong accessibility semantics, and no dead-end screen. Existing brand tokens, type, colors, geometry, game-feel primitives, avatar art, and route-specific visual language remain the source of truth. Navigation work must not flatten those surfaces into generic scaffolding.

## Non-negotiable information architecture

The primary owners are:

- **Today**
- **Plan**
- **Health**
- **More**

**Quick Log is an action, not a fifth destination.** It is available from the approved care surfaces but does not own persistent tab state.

### Canonical route ownership

| Public path         | Owner     | Role                | Presentation              | Cold-start fallback | Care shell |
| ------------------- | --------- | ------------------- | ------------------------- | ------------------- | ---------- |
| `/`                 | Today     | owner primary       | primary tab               | `/`                 | visible    |
| `/story`            | Today     | owner secondary     | owner card, custom header | `/`                 | visible    |
| `/adventure`        | Today     | owner secondary     | owner card, native header | `/`                 | visible    |
| `/calendar`         | Plan      | owner primary       | primary tab               | `/calendar`         | visible    |
| `/calendar-month`   | Plan      | owner secondary     | owner card, custom header | `/calendar`         | visible    |
| `/reminders`        | Plan      | owner secondary     | owner card, custom header | `/calendar`         | visible    |
| `/fastlog`          | Quick Log | root action         | root modal                | `/`                 | hidden     |
| `/log`              | Quick Log | root action/history | root card, custom header  | `/`                 | visible    |
| `/health`           | Health    | owner primary       | primary tab               | `/health`           | visible    |
| `/trends`           | Health    | owner secondary     | owner card, custom header | `/health`           | visible    |
| `/records`          | Health    | owner secondary     | owner card, custom header | `/health`           | visible    |
| `/more`             | More      | owner primary       | primary tab               | `/more`             | visible    |
| `/pack`             | More      | owner secondary     | owner card, custom header | `/more`             | visible    |
| `/profile`          | More      | owner secondary     | owner card, custom header | `/more`             | visible    |
| `/portrait`         | More      | owner secondary     | owner card, custom header | `/more`             | visible    |
| `/woofguide`        | More      | owner secondary     | owner card, native header | `/more`             | visible    |
| `/privacy`          | More      | owner secondary     | owner card, custom header | `/more`             | visible    |
| `/legal`            | More      | owner secondary     | owner card, custom header | `/more`             | visible    |
| `/premium`          | More      | owner secondary     | owner card, native header | `/more`             | visible    |
| `/sign-in`          | system    | authentication gate | system gate               | `/`                 | hidden     |
| `/sign-up`          | system    | authentication gate | system gate               | `/`                 | hidden     |
| `/setup`            | system    | setup/management    | system card               | `/`                 | hidden     |
| `/care-twin-qa`     | system    | internal QA         | system card               | `/`                 | hidden     |
| unknown / not found | system    | recovery            | not found                 | `/`                 | hidden     |

Unknown public paths must resolve explicitly as:

```ts
{
  kind: "unknown",
  owner: null,
  presentation: "not-found",
  coldStartFallback: "/",
}
```

They must never be silently classified as Today.

Expo route groups are implementation details, not URL segments. The contract
therefore models the public auth paths `/sign-in` and `/sign-up` separately
from their internal Expo Router hrefs `/(auth)/sign-in` and
`/(auth)/sign-up`.

## Slice 1 — contracts, not topology

Slice 1 introduces a pure, Node-testable navigation contract. It does not move a route file, alter a Stack or Tabs layout, change authentication, or migrate call sites.

The contract owns:

- canonical public pathname;
- stable route identifier;
- owner or `null` for system routes;
- presentation identifier;
- cold-start fallback;
- decoded parameter schema;
- allowed return/origin context;
- shell visibility;
- current source file so the existing route manifest can be verified;
- typed object href construction with raw decoded values.

The allowed presentation identifiers are:

```text
primary-tab
secondary-tab
owner-card-native-header
owner-card-custom-header
root-card-native-header
root-card-custom-header
root-modal
system-gate
system-card
not-found
```

`secondary-tab` and `root-card-native-header` remain legal exhaustive contract values even if no current route uses them. That keeps future root/owner Stack consumers total instead of encoding current implementation accidents.

### Exact Quick Log origin set

`/fastlog` may be opened only with a validated origin from this exact ordered set:

```ts
[
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
];
```

`/fastlog` itself is never an origin. Authentication, setup, QA, not-found,
and internal group paths are never origins. The exported origin array is
derived from every `shellVisible` route in the route contract; it is not a
second independently maintained list.

Origin validation consumes values Expo Router has already decoded. It must:

- require one scalar string;
- require exact equality with the allowlist;
- reject arrays and duplicate query values;
- reject `%`, `?`, `#`, `//`, backslash, leading/trailing whitespace, whitespace within a path, and control characters;
- never call `decodeURIComponent`;
- never trim into validity;
- fail closed to no origin.

### Typed decoded parameter contracts

Every parser consumes already-decoded scalar values. Any unknown key, duplicate value represented as an array, invalid variant combination, non-scalar, or invalid value rejects the whole parameter object.

#### `/log`

Empty history is valid. Otherwise exactly one mutually exclusive launch variant is valid:

1. `{ entry }`
   - opaque decoded identifier;
   - 1–128 characters;
   - rejects control and NUL characters;
2. `{ type, detail: "1", intent }`
   - `type` must be one of the exact normalized care-domain event types;
   - aliases and fallback normalization are not accepted at the navigation boundary;
   - `intent` is a canonical non-negative decimal safe integer;
3. `{ walk: "finish" }`;
4. `{ alone: "active" }`.

Each variant may also carry one optional validated `returnTo` Quick Log origin. No other mixture is valid.

#### `/fastlog`

- optional `origin`;
- origin must be from the exact Quick Log origin set.

#### `/health`

- optional `tab`;
- valid values: `"health"` or `"bile"`.

#### `/more`

- optional `section`;
- valid values: `"career"`, `"household"`, `"access"`, `"care-pass"`, or `"diet"`;
- optional `focus`, a canonical non-negative decimal safe integer.

#### `/legal`

- optional `doc`;
- valid values: `"privacy"` or `"terms"`.

#### `/woofguide`

- optional scalar `prompt`;
- at most 240 decoded characters;
- control characters rejected;
- empty string rejected when the key is supplied.

#### `/setup`

The management continuation is exactly:

```ts
{ mode: "manage", returnTo: "/more" }
```

Setup remains a system route and never becomes owned by More.

#### QA

The existing QA parameter model remains a separate system-only contract. Product-route parsers must not absorb, reinterpret, or normalize `qaReturn`, `qaSurface`, `qaTitle`, or other evidence-capture parameters. QA migration is a dedicated later compatibility step.

### Typed href rule

Href builders return Expo-compatible object shapes:

```ts
{
  pathname: "/log",
  params: { entry: "opaque decoded value" },
}
```

Builders do not concatenate query strings and do not call `encodeURIComponent`. Expo Router receives the decoded value and performs one encoding pass.

### Source and manifest guardrails

Slice 1 adds:

- a route-manifest test proving every current canonical route has one registered source file;
- uniqueness and coverage checks for route IDs and public paths;
- a source scanner with controlled-fixture tests for static object/string hrefs, dynamic router calls, and direct `/fastlog` launches;
- a checked-in migration ledger of current router-bearing product files;
- an exact current-debt inventory for direct `/fastlog` launch sites.

The ledger is a change detector, not an approval of the old call sites. Later migration slices reduce it to zero. Slice 1 must not edit those screens merely to make the scanner green.

## Slice 2 — pathless owner-stack topology

Only after Slice 1 is approved, reorganize the route implementation under pathless owner groups while preserving public URLs.

Target shape:

```text
app/
  _layout.tsx
  (auth)/
  (tabs)/
    _layout.tsx
    (today)/
      _layout.tsx
      index.tsx
      story.tsx
      adventure.tsx
    (plan)/
      _layout.tsx
      calendar.tsx
      calendar-month.tsx
      reminders.tsx
    (health)/
      _layout.tsx
      health.tsx
      trends.tsx
      records.tsx
    (more)/
      _layout.tsx
      more.tsx
      pack.tsx
      profile.tsx
      portrait.tsx
      woofguide.tsx
      privacy.tsx
      legal.tsx
      premium.tsx
  log.tsx
  fastlog.tsx
  setup.tsx
  care-twin-qa.tsx
  +not-found.tsx
```

Required `unstable_settings.initialRouteName` values:

| Layout             | Initial child |
| ------------------ | ------------- |
| root               | `(tabs)`      |
| tabs               | `(today)`     |
| Today owner Stack  | `index`       |
| Plan owner Stack   | `calendar`    |
| Health owner Stack | `health`      |
| More owner Stack   | `more`        |

Each persistent tab owns one Stack. Switching tabs preserves the owner primary semantics while `popToTopOnBlur: true` prevents a user from returning to a stale maze. Secondary screens use native Stack cards. A route that paints a custom `BoardRouteHeader` may hide the native title while retaining native card gesture behavior.

Root `/log` is a card above tabs. Root `/fastlog` is a modal above tabs. Their public paths do not change.

No route move is accepted without:

- manifest equality before and after;
- cold-start tests for every public path;
- web-refresh tests for every public path;
- native deep-link tests for every public path;
- exact back-path tests;
- proof that no duplicate route or ambiguous group path exists.

## Slice 3 — centralized navigation coordinator and source migration

Replace direct string navigation with typed intents from the Slice 1 contract.

### Cross-owner invariant

Cross-owner navigation must use Expo Router 6 public behavior equivalent to:

```ts
{
  withAnchor: true;
}
```

This is the public equivalent of `overrideInitialScreen: false`; no private router APIs are allowed.

The coordinator must:

1. identify the destination owner;
2. activate that owner with its primary route as anchor;
3. if already mounted, request the target owner registry to `popToTop`;
4. wait until the destination owner is active;
5. verify the target owner Stack is exactly `[primary]`;
6. push the requested secondary leaf;
7. remain at primary or fail closed if the invariant cannot be proven.

The owner Stack registry is explicit and typed. It does not discover or mutate private Expo state.

`popToTopOnBlur: true` remains a defense in depth, not the only reset mechanism.

### Presentation consumer

Root and owner Stack options must be derived exhaustively from the route presentation contract. A new presentation ID must produce a compile or test failure until both consumers define it.

No screen may set contradictory presentation behavior ad hoc after migration.

### Back fallback matrix

History back remains first choice. When no usable history exists:

- Today secondaries fall back to `/`;
- Plan secondaries fall back to `/calendar`;
- Health secondaries fall back to `/health`;
- More secondaries fall back to `/more`;
- Portrait and Legal fall back to `/more` when usable history is absent;
  normal history may still return to Profile or Privacy when that is where
  the user arrived from;
- root Log falls back to its validated return origin, otherwise `/`;
- Fast Log dismisses to its validated underlying origin, otherwise `/`;
- unknown routes replace with `/`.

Every custom back button must use the same coordinator policy as the native gesture fallback.

## Slice 4 — authentication continuation and system routes

Authentication interception uses one typed, one-use pending destination. It stores:

- canonical path;
- already-decoded validated params;
- requested presentation;
- validated origin/return context;
- a generation or nonce that prevents stale reuse.

Raw href strings are never persisted.

After authentication:

1. consume the pending destination once;
2. replace to its canonical owner primary or root base;
3. wait until authentication UI is absent;
4. wait until the canonical target Stack invariant is true;
5. push the requested leaf with the owner anchor;
6. clear the pending destination even on failure.

Examples:

- `/records` restores as `[health, records]`;
- `/log` and `/fastlog` restore as `[(tabs), leaf]`;
- invalid or expired destinations restore to `/`.

Setup is a system flow. Management mode may return to `/more`, but the setup route itself never enters the More Stack.

QA remains system-only, preserves its exact existing proof contract, and never changes tab ownership or shell visibility.

## Slice 5 — Care shell and Fast Log interaction model

### CareShellHost

`CareShellHost` is rendered as a sibling overlay after and above the root Stack. It must not live inside only one tab screen.

Visibility is derived solely from the resolved public-path route contract:

- visible on all approved care surfaces, including root `/log`;
- hidden on `/fastlog`, auth, setup, QA, and not-found;
- unknown routes fail closed to hidden.

Segment position comes from owner state, not from screen-local guesses. Quick Log is rendered as the action affordance, not a fifth selected segment.

The shell must respect:

- safe areas;
- keyboard visibility;
- Dynamic Type;
- Reduce Motion;
- minimum 48-point hit targets;
- screen-reader ordering and explicit selected state;
- no overlap with sheets, dialogs, or destructive confirmation controls.

### Fast Log lifecycle

`/fastlog` is a root modal. On iOS, dismissal proof is the modal swipe-down/dismiss gesture, not a left-edge card pop.

If Fast Log was opened from `/log`:

- `/log` is the valid origin;
- “View Full Log” dismisses the modal to the existing `/log`;
- it must not replace or push a duplicate `/log`;
- detail/recent-entry actions dismiss, wait for the existing `/log` to regain focus, then set typed parameters on that screen.

If Fast Log was opened from another valid origin:

- detail/recent-entry actions replace the modal with exactly one `/log` card above that origin.

Fast Log never uses itself as an origin. Invalid origin state falls back safely to `/`.

## Slice 6 — premium interaction and accessibility polish

After structure is proven, polish motion and controls without changing navigation semantics:

- one consistent press-depth and release response from shared GameFeel primitives;
- short, interruptible transitions;
- no JS-thread layout animation where a transform can be used;
- Reduce Motion covers entrance, repeated, decorative, and state-change motion;
- one purposeful haptic per completed care action, never per decorative tap;
- skeleton/loading, empty, offline, storage-error, sync-conflict, and retry states remain navigable;
- avatars never block route controls or announce decorative layers;
- every route has one visually dominant primary action and restrained secondary actions;
- large text reflows instead of clipping or shrinking;
- focus order follows reading and action order;
- selected tabs and segments expose native selected semantics;
- destructive actions remain separated from primary care flows.

Preserve the existing pixel-world warmth, tokenized radii, surface colors, Fredoka/Fraunces/Inter hierarchy, Board primitives, and established care scenes.

## Verification matrix

Every later implementation slice must state exact commands, counts, and observed behavior.

### Contract verification

- route path and ID uniqueness;
- complete owner and presentation coverage;
- unknown-path fail-closed result;
- exact Quick Log origin allowlist;
- duplicate/array/unknown parameter rejection;
- one-of `/log` variants;
- exact care type acceptance;
- safe-integer canonical decimal acceptance;
- one-encoding-pass href objects;
- current source manifest existence;
- current router-source ledger;
- exact direct Fast Log debt inventory.

### Navigation behavior verification

For every public route on iOS, Android, and web:

- cold start;
- deep link;
- web refresh;
- back button;
- iOS edge gesture for card routes;
- Android hardware back;
- owner switch from primary and secondary screens;
- repeated same-destination taps;
- cross-owner reset;
- auth-interrupted continuation;
- not-found recovery;
- Dynamic Type and Reduce Motion.

Special proofs:

- iOS Fast Log swipe-down returns to the exact origin;
- `/log` → Fast Log → View Full Log does not duplicate Log;
- `/records` auth continuation results in `[health, records]`;
- no route leaves a user under a hidden, stale secondary;
- CareShellHost stays visible on `/log` and hidden on `/fastlog` and system routes.

### Quality gates

- focused navigation tests;
- full mobile static suite;
- mobile TypeScript check;
- `git diff --check`;
- source scan;
- production export/smoke build in the topology slice;
- real viewport and native-device interaction evidence in polish slices;
- independent review of every frozen commit range.

## Delivery discipline

- One source writer per slice.
- RED evidence before production implementation.
- Review a committed, frozen diff.
- Fix Critical and Important findings before the next slice.
- Never hand-edit generated clients.
- Never touch account-deletion/security work from a navigation slice.
- Never push from an implementation slice unless the controller explicitly authorizes it.
- Preserve unrelated user work and dirty-tree changes.
- Do not declare “premium” from typecheck alone: the final claim requires route behavior, gesture, accessibility, motion, and device proof.
