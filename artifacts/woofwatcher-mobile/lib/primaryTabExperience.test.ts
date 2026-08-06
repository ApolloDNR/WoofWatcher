import assert from "node:assert/strict";
import { test } from "node:test";

import * as moreDirectory from "./moreDirectory.ts";
import * as primaryTabExperience from "./primaryTabExperience.ts";

test("the visible next-Plan control opens the real routine editor in one tap", () => {
  const buildControl = (primaryTabExperience as unknown as {
    buildNextPlanVisibleControl?: (
      input: {
        kind: "edit";
        title: string;
        detail: string;
        actionLabel: string;
        routineId: string;
      },
      effects: { addRoutine: () => void; editRoutine: (routineId: string) => void },
    ) => {
      id: string;
      eyebrow: string;
      visibleTapCount: number;
      onPress: () => void;
    };
  }).buildNextPlanVisibleControl;
  assert.equal(typeof buildControl, "function");

  const edits: string[] = [];
  let adds = 0;
  const control = buildControl!(
    {
      kind: "edit",
      title: "Dinner",
      detail: "7:00 PM",
      actionLabel: "Open",
      routineId: "routine_dinner",
    },
    {
      addRoutine: () => { adds += 1; },
      editRoutine: (routineId) => edits.push(routineId),
    },
  );

  assert.deepEqual(
    { id: control.id, eyebrow: control.eyebrow, taps: control.visibleTapCount },
    { id: "next-plan", eyebrow: "Next Mission", taps: 1 },
  );
  control.onPress();
  assert.deepEqual(edits, ["routine_dinner"]);
  assert.equal(adds, 0);
});

test("the rendered Health status controls open canonical Log detail destinations", () => {
  const buildControls = (primaryTabExperience as unknown as {
    buildVisibleHealthStatusControls?: <T extends {
      label: string;
      status: string;
      detail: string;
      routeType: string;
      actionLabel: string;
    }>(
      rows: readonly T[],
      effects: {
        openLogDetail: (destination: {
          pathname: "/log";
          params: Readonly<{ type: string; detail: "1" }>;
        }) => void;
      },
    ) => Array<T & { visibleTapCount: number; onPress: () => void }>;
  }).buildVisibleHealthStatusControls;
  assert.equal(typeof buildControls, "function");

  const destinations: unknown[] = [];
  const controls = buildControls!(
    [
      { label: "Activity", status: "Good", detail: "Active daily", routeType: "walk", actionLabel: "Log activity" },
      { label: "Appetite", status: "Watch", detail: "1 reduced meal", routeType: "meal", actionLabel: "Log appetite" },
      { label: "Stool", status: "Normal", detail: "Solid", routeType: "potty", actionLabel: "Log potty" },
      { label: "Hydration", status: "Good", detail: "Hydrated", routeType: "water", actionLabel: "Log water" },
      { label: "Hidden fifth row", status: "Watch", detail: "Later", routeType: "symptom", actionLabel: "Log details" },
    ],
    { openLogDetail: (destination) => destinations.push(destination) },
  );

  assert.deepEqual(controls.map((control) => control.label), ["Activity", "Appetite", "Stool", "Hydration"]);
  assert.ok(controls.every((control) => control.visibleTapCount === 1));
  controls[1]?.onPress();
  assert.deepEqual(destinations, [
    { pathname: "/log", params: { type: "meal", detail: "1" } },
  ]);
});

test("the More rows actually rendered by the directory open canonical Dog Profile and Privacy destinations", () => {
  const executeDestination = (moreDirectory as unknown as {
    executeMoreDirectoryDestination?: (
      destination: moreDirectory.MoreDirectoryDestination,
      navigate: (route: string) => void,
    ) => void;
  }).executeMoreDirectoryDestination;
  assert.equal(typeof executeDestination, "function");

  const visibleItems = moreDirectory.MORE_DIRECTORY_GROUPS.flatMap((group) => group.items);
  const dogProfile = visibleItems.find((item) => item.id === "dog-profile");
  const privacy = visibleItems.find((item) => item.id === "privacy");
  assert.equal(dogProfile?.label, "Dog Profile");
  assert.equal(privacy?.label, "Privacy & Data");
  assert.deepEqual(["More", dogProfile?.label], ["More", "Dog Profile"]);
  assert.deepEqual(["More", privacy?.label], ["More", "Privacy & Data"]);

  const routes: string[] = [];
  executeDestination!(dogProfile!.destination, (route) => routes.push(route));
  executeDestination!(privacy!.destination, (route) => routes.push(route));
  assert.deepEqual(routes, [
    "/more?section=dog-profile",
    "/more?section=privacy",
  ]);
});

test("Home and Log visible actions keep their executable one-tap outcomes", () => {
  const navigations: string[] = [];
  const views: string[] = [];
  const effects = {
    navigate: (route: string) => navigations.push(route),
    selectLogView: (view: "history") => views.push(view),
  };

  primaryTabExperience.executePrimaryTabTaskPath("fast-log", effects);
  primaryTabExperience.executePrimaryTabTaskPath("fast-log-from-log", effects);
  primaryTabExperience.executePrimaryTabTaskPath("log-history", effects);

  assert.deepEqual(navigations, ["/fastlog", "/fastlog"]);
  assert.deepEqual(views, ["history"]);
});
