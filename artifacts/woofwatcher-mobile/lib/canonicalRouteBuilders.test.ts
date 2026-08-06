import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalFastLogRoute,
  canonicalHealthRoute,
  canonicalHomeRoute,
  canonicalLogRoute,
  canonicalMoreRoute,
  canonicalPlansRoute,
  canonicalizeOwnedRoute,
  replaceWithCanonicalHome,
} from "./canonicalRouteBuilders.ts";

test("builds canonical tab and section routes without legacy aliases", () => {
  assert.equal(canonicalHomeRoute(), "/");
  assert.equal(canonicalLogRoute(), "/log");
  assert.equal(canonicalFastLogRoute(), "/fastlog");
  assert.equal(canonicalPlansRoute(), "/calendar");
  assert.equal(canonicalHealthRoute("records"), "/health?section=records");
  assert.equal(canonicalMoreRoute("privacy"), "/more?section=privacy");
});

test("release-boundary navigation replaces exactly once with canonical Home", () => {
  const calls: string[] = [];
  const router = {
    back: () => calls.push("back"),
    replace: (route: string) => calls.push(`replace:${route}`),
  };

  replaceWithCanonicalHome(router);

  assert.deepEqual(calls, ["replace:/"]);
});

test("normalizes indirect legacy callers through the canonical ownership resolver", () => {
  assert.equal(canonicalizeOwnedRoute("/records"), "/health?section=records");
  assert.equal(
    canonicalizeOwnedRoute("/reminders?item=routine%3Amorning.1&leak=no"),
    "/calendar?item=routine%3Amorning.1",
  );
  assert.equal(
    canonicalizeOwnedRoute("/health?tab=bile"),
    "/health?section=bile-watch",
  );
  assert.equal(
    canonicalizeOwnedRoute("/log?type=meal&detail=1"),
    "/log?type=meal&detail=1",
  );
});

test("leaves non-ownership QA routes intact instead of applying the resolver fallback", () => {
  assert.equal(canonicalizeOwnedRoute("/sign-in?returnTo=setup"), "/sign-in?returnTo=setup");
  assert.equal(
    canonicalizeOwnedRoute("/care-twin-qa?qaSurface=care-twin-state-lab"),
    "/care-twin-qa?qaSurface=care-twin-state-lab",
  );
});

test("serializes only validated canonical Health and More parameters", () => {
  assert.equal(
    canonicalizeOwnedRoute("/health?section=records&entry=entry_1&leak=secret"),
    "/health?section=records&entry=entry_1",
  );
  assert.equal(
    canonicalizeOwnedRoute("/health?section=trends&entry=leak"),
    "/health?section=trends",
  );
  assert.equal(
    canonicalizeOwnedRoute("/more?section=privacy&item=leak"),
    "/more?section=privacy",
  );
  assert.equal(
    canonicalizeOwnedRoute("/more?section=care-team-supplies&item=bad%20value&leak=secret"),
    "/more?section=care-team-supplies",
  );
});
