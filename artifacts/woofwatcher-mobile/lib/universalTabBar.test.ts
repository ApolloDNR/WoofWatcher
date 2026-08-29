import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const MOBILE_ROOT = join(process.cwd(), "artifacts", "woofwatcher-mobile");
const TAB_LAYOUT_PATH = join(MOBILE_ROOT, "app", "(tabs)", "_layout.tsx");
const TAB_BUTTON_PATH = join(
  MOBILE_ROOT,
  "components",
  "navigation",
  "UniversalTabButton.tsx",
);

function readSource(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

test("declares the exact universal primary and compatibility tab models", async () => {
  const model = await import("./universalTabBar.ts");

  assert.deepEqual(model.UNIVERSAL_PRIMARY_TABS, [
    { name: "index", label: "Home", parent: "home" },
    { name: "log", label: "Log", parent: "log" },
    { name: "calendar", label: "Plans", parent: "plans" },
    { name: "health", label: "Health", parent: "health" },
    { name: "more", label: "More", parent: "more" },
  ]);
  assert.deepEqual(model.UNIVERSAL_COMPATIBILITY_TABS, [
    "pack",
    "story",
    "records",
  ]);

  const names = model.UNIVERSAL_PRIMARY_TABS.map((tab) => tab.name);
  const labels = model.UNIVERSAL_PRIMARY_TABS.map((tab) => tab.label);
  const parents = model.UNIVERSAL_PRIMARY_TABS.map((tab) => tab.parent);
  assert.equal(new Set(names).size, 5, "visible route names stay unique");
  assert.equal(new Set(labels).size, 5, "visible labels stay unique");
  assert.equal(new Set(parents).size, 5, "canonical parents stay unique");
  for (const retiredLabel of ["Plan", "Today", "Pack", "Story"] as const) {
    assert.equal(labels.includes(retiredLabel), false, retiredLabel);
  }
  assert.deepEqual(
    model.UNIVERSAL_COMPATIBILITY_TABS.filter((name) => names.includes(name)),
    [],
    "hidden compatibility routes never become visible tabs",
  );
});

test("focused Plans, Health, and More child presses replace exactly once with their roots", async () => {
  const model = await import("./universalTabBar.ts");
  const handleUniversalTabPress = Reflect.get(
    model,
    "handleUniversalTabPress",
  ) as unknown;
  assert.equal(
    typeof handleUniversalTabPress,
    "function",
    "the tab model should expose its focused-child press contract",
  );

  for (const { input, root } of [
    {
      input: {
        tabName: "calendar",
        focused: true,
        pathname: "/calendar",
        plansItem: "routine:morning-walk",
        healthSection: "overview",
        moreSection: "root",
      },
      root: "/calendar",
    },
    {
      input: {
        tabName: "calendar",
        focused: true,
        pathname: "/calendar",
        plansSection: "reminders",
        healthSection: "overview",
        moreSection: "root",
      },
      root: "/calendar",
    },
    {
      input: {
        tabName: "health",
        focused: true,
        pathname: "/health",
        healthSection: "records",
        moreSection: "root",
      },
      root: "/health",
    },
    {
      input: {
        tabName: "more",
        focused: true,
        pathname: "/more",
        healthSection: "overview",
        moreSection: "avatar-studio",
      },
      root: "/more",
    },
  ] as const) {
    const effects: string[] = [];
    const handled = (
      handleUniversalTabPress as (
        input: typeof input,
        effects: {
          preventDefault: () => void;
          replace: (pathname: string) => void;
        },
      ) => boolean
    )(input, {
      preventDefault: () => effects.push("prevent-default"),
      replace: (pathname) => effects.push(`replace:${pathname}`),
    });

    assert.equal(handled, true, JSON.stringify(input));
    assert.deepEqual(
      effects,
      ["prevent-default", `replace:${root}`],
      JSON.stringify(input),
    );
  }
});

test("root and unfocused tab presses remain Expo-owned without a second action", async () => {
  const model = await import("./universalTabBar.ts");
  const handleUniversalTabPress = Reflect.get(
    model,
    "handleUniversalTabPress",
  ) as (
    input: {
      tabName: string;
      focused: boolean;
      pathname: string;
      moreSection: string;
    },
    effects: {
      preventDefault: () => void;
      replace: (pathname: string) => void;
    },
  ) => boolean;
  assert.equal(typeof handleUniversalTabPress, "function");

  for (const input of [
    {
      tabName: "calendar",
      focused: true,
      pathname: "/calendar",
      healthSection: "overview",
      moreSection: "root",
    },
    {
      tabName: "more",
      focused: true,
      pathname: "/more",
      moreSection: "root",
    },
    {
      tabName: "health",
      focused: false,
      pathname: "/health",
      healthSection: "records",
      moreSection: "root",
    },
    {
      tabName: "health",
      focused: true,
      pathname: "/health",
      healthSection: "overview",
      moreSection: "root",
    },
  ] as const) {
    const effects: string[] = [];
    assert.equal(
      handleUniversalTabPress(input, {
        preventDefault: () => effects.push("prevent-default"),
        replace: (pathname) => effects.push(`replace:${pathname}`),
      }),
      false,
      JSON.stringify(input),
    );
    assert.deepEqual(effects, [], JSON.stringify(input));
  }
});

test("keeps all five primary and three compatibility route files available", () => {
  for (const route of [
    "index",
    "log",
    "calendar",
    "health",
    "more",
    "pack",
    "story",
    "records",
  ] as const) {
    assert.equal(
      existsSync(join(MOBILE_ROOT, "app", "(tabs)", `${route}.tsx`)),
      true,
      `${route} route file should exist`,
    );
  }
  assert.equal(
    existsSync(TAB_BUTTON_PATH),
    true,
    "the shared universal tab button should exist",
  );
});

test("maps the canonical model to Expo tabs with one bounded stateful-root listener factory", () => {
  const layout = readSource(TAB_LAYOUT_PATH);

  assert.match(layout, /UNIVERSAL_PRIMARY_TABS/);
  assert.match(layout, /UNIVERSAL_COMPATIBILITY_TABS/);
  assert.match(layout, /UNIVERSAL_PRIMARY_TABS\.map\(\(tab\)\s*=>/);
  assert.match(layout, /name=\{tab\.name\}/);
  assert.match(layout, /title:\s*tab\.label/);
  assert.match(layout, /tabBarButton:\s*\(buttonProps\)\s*=>/);
  assert.match(layout, /<UniversalTabButton/);
  assert.match(layout, /\{\.\.\.buttonProps\}/);
  assert.match(layout, /label=\{tab\.label\}/);
  assert.match(layout, /UNIVERSAL_COMPATIBILITY_TABS\.map/);
  assert.match(layout, /href:\s*null/);
  assert.equal(
    layout.match(/href:\s*null/g)?.length ?? 0,
    1,
    "one bounded compatibility mapping hides exactly the three modeled routes",
  );

  const compatibilityStart = layout.indexOf("UNIVERSAL_COMPATIBILITY_TABS.map");
  assert.notEqual(compatibilityStart, -1);
  assert.doesNotMatch(
    layout.slice(compatibilityStart),
    /tabBarButton/,
    "hidden compatibility screens must not install the visible button",
  );

  assert.match(layout, /initialRouteName:\s*"index"/);
  assert.match(layout, /backBehavior="history"/);
  assert.doesNotMatch(layout, /tab\.name\s*===\s*["']index["']/);
  assert.doesNotMatch(
    layout,
    /CenterToday|centerSlot|fabWrap|router\.push|\/fastlog/,
  );
  assert.doesNotMatch(layout, /screenListeners/);
  assert.equal(
    layout.match(/tabPress:/g)?.length ?? 0,
    1,
    "one shared listener factory serves the three stateful tab roots",
  );
  assert.match(
    layout,
    /tab\.name === "more" \|\|[\s\S]{0,100}tab\.name === "calendar" \|\|[\s\S]{0,100}tab\.name === "health"[\s\S]{0,220}tabPress:[\s\S]{0,220}handleUniversalTabPress/,
  );
  assert.match(layout, /plansItem:\s*activePlansItem/);
  assert.match(layout, /plansSection:\s*activePlansSection/);
  assert.match(layout, /healthSection:\s*activeHealthSection/);
  assert.match(layout, /moreSection:\s*activeMoreSection/);
  assert.match(layout, /focused:\s*navigation\.isFocused\(\)/);
  assert.match(
    layout,
    /replace:\s*\(nextPathname\)[\s\S]{0,260}requestRegisteredAvatarDraftExit[\s\S]{0,260}router\.replace\(nextPathname\)/,
  );
});

test("keeps visible tab labels readable and preserves Expo icon tint", () => {
  const layout = readSource(TAB_LAYOUT_PATH);

  assert.match(layout, /tabBarShowLabel:\s*chrome\.showVisualLabels/);
  assert.match(layout, /tabBarAllowFontScaling:\s*true/);
  assert.match(layout, /maxFontSizeMultiplier=\{MAX_TAB_LABEL_FONT_SCALE\}/);
  assert.match(layout, /fontScale/);
  assert.match(layout, /viewportWidth:\s*width/);
  assert.match(layout, /numberOfLines=\{1\}/);
  assert.match(layout, /fontSize:\s*(?:1[4-9]|[2-9]\d)/);
  assert.match(layout, /lineHeight:\s*(?:1[8-9]|[2-9]\d)/);
  assert.match(layout, /tabBarActiveTintColor:\s*colors\.forest/);
  assert.match(layout, /tabBarInactiveTintColor:\s*colors\.mutedForeground/);
  assert.match(layout, /<TabIcon[\s\S]*color=\{color\}/);
});

test("the universal button preserves Expo behavior, web links, and one visible child tree", () => {
  const button = readSource(TAB_BUTTON_PATH);

  assert.match(button, /import type \{ Tabs \} from "expo-router"/);
  assert.doesNotMatch(button, /@react-navigation\/bottom-tabs/);
  assert.match(button, /ComponentProps<typeof Tabs\.Screen>/);
  assert.match(button, /Parameters<TabButtonRenderer>\[0\]/);
  assert.match(button, /export type UniversalTabButtonProps/);
  assert.equal(button.match(/<Pressable\b/g)?.length ?? 0, 1);
  assert.equal(button.match(/\{children\}/g)?.length ?? 0, 1);
  assert.doesNotMatch(button, /<Text\b|props\.children[\s\S]*props\.children/);
  assert.doesNotMatch(
    button,
    /useRouter|router\.(?:push|replace|navigate)|from "expo-router"(?!;)/,
  );

  assert.match(button, /accessibilityLabel=\{/);
  assert.match(button, /accessibilityRole=\{/);
  assert.match(button, /accessibilityState=\{/);
  assert.match(button, /aria-label=\{/);
  assert.match(button, /aria-selected=\{selected\}/);
  assert.match(button, /testID=\{testID\}/);
  assert.match(button, /onLongPress=\{onLongPress\}/);
  assert.match(button, /MIN_MOBILE_TOUCH_TARGET/);
  assert.match(button, /minWidth:\s*MIN_MOBILE_TOUCH_TARGET/);
  assert.match(button, /minHeight:\s*MIN_MOBILE_TOUCH_TARGET/);

  assert.match(button, /props\["aria-selected"\]\s*===\s*true/);
  assert.match(button, /accessibilityState\?\.selected\s*===\s*true/);
  assert.match(button, /borderRadius:/);
  assert.match(button, /backgroundColor:\s*selected\s*\?/);
  assert.match(button, /borderColor:\s*selected\s*\?/);
  assert.match(button, /setPressed\(true\)/);
  assert.match(button, /setPressed\(false\)/);
  assert.match(button, /opacity:\s*pressed\s*\?/);
  assert.match(button, /scale:\s*pressed\s*\?/);

  assert.match(button, /Platform\.OS\s*!==\s*"web"/);
  assert.equal(button.match(/Haptics\.selectionAsync\(\)/g)?.length ?? 0, 1);
  assert.match(
    button,
    /Haptics\.selectionAsync\(\)\.catch\(\(\)\s*=>\s*\{\}\)/,
  );
  assert.match(button, /onPressIn\?\.\(event\)/);
  assert.match(button, /onPressOut\?\.\(event\)/);
  assert.match(button, /onPress\?\.\(event\)/);

  assert.match(button, /href/);
  assert.match(button, /preventDefault\(\)/);
  assert.match(button, /metaKey|altKey|ctrlKey|shiftKey/);
  assert.match(button, /button\s*===\s*0/);
  assert.match(button, /currentTarget/);
  assert.match(button, /props\.style|\bstyle\b/);
});
