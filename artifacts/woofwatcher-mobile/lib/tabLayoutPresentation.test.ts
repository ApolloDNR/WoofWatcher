import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

import * as mobileLayout from "./mobileLayout.ts";

function evaluateTabLayout({ keyboardVisible }: { keyboardVisible: boolean }) {
  const file = new URL("../app/(tabs)/_layout.tsx", import.meta.url);
  const source = readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file.pathname,
  }).outputText;
  const module = { exports: {} as Record<string, (...args: any[]) => any> };
  const AnimatedView = Symbol("AnimatedView");
  const BottomTabBar = Symbol("BottomTabBar");
  const react = {
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      return { type, props: { ...(props ?? {}), children } };
    },
  };
  const Tabs = Object.assign(() => null, { Screen: () => null });
  const requireModule = (request: string) => {
    if (request === "react") {
      return {
        __esModule: true,
        default: react,
        useEffect: () => undefined,
        useRef: <T>(value: T) => ({ current: value }),
      };
    }
    if (request === "expo-router") return { Tabs };
    if (request === "@expo/vector-icons") {
      return { Ionicons: { glyphMap: {} } };
    }
    if (request === "expo-haptics") {
      return { selectionAsync: () => undefined };
    }
    if (request === "@react-navigation/bottom-tabs") return { BottomTabBar };
    if (request === "react-native") {
      return {
        Platform: { OS: "ios" },
        StyleSheet: { absoluteFill: {}, create: <T>(value: T) => value },
        View: "View",
      };
    }
    if (request === "react-native-keyboard-controller") {
      return {
        useKeyboardState: (
          selector: (state: { isVisible: boolean }) => unknown,
        ) => selector({ isVisible: keyboardVisible }),
        useReanimatedKeyboardAnimation: () => ({
          progress: { value: keyboardVisible ? 1 : 0 },
        }),
      };
    }
    if (request === "react-native-reanimated") {
      return {
        __esModule: true,
        default: { View: AnimatedView },
        useAnimatedStyle: (factory: () => unknown) => factory(),
      };
    }
    if (request === "react-native-safe-area-context") {
      return {
        useSafeAreaInsets: () => ({ bottom: 34, left: 59, right: 47, top: 0 }),
      };
    }
    if (request === "@/components/motion/GameFeel") {
      return { useBounce: () => ({ bounce: () => undefined, style: {} }) };
    }
    if (request === "@/hooks/useColors") {
      return {
        useColors: () => ({
          background: "#F7F1E1",
          brandNavy: "#081424",
          cream: "#F7F1E1",
        }),
      };
    }
    if (request === "@/lib/mobileLayout") return mobileLayout;
    throw new Error(`Unexpected tab-layout dependency: ${request}`);
  };
  const run = new Function("require", "module", "exports", output);
  run(requireModule, module, module.exports);

  return { AnimatedView, BottomTabBar, exports: module.exports };
}

test("the keyboard presentation removes the complete tab bar from touch and accessibility flow", () => {
  const hidden = evaluateTabLayout({ keyboardVisible: true });
  const hiddenBar = hidden.exports.KeyboardAwareTabBar({ marker: "tabs" });

  assert.equal(hiddenBar.type, hidden.AnimatedView);
  assert.equal(hiddenBar.props.pointerEvents, "none");
  assert.equal(hiddenBar.props.accessibilityElementsHidden, true);
  assert.equal(
    hiddenBar.props.importantForAccessibility,
    "no-hide-descendants",
  );
  assert.deepEqual(hiddenBar.props.style[1], {
    opacity: 0,
    transform: [{ translateY: 120 }],
  });
  assert.equal(hiddenBar.props.children[1].type, hidden.BottomTabBar);
  assert.equal(hiddenBar.props.children[1].props.marker, "tabs");

  const visible = evaluateTabLayout({ keyboardVisible: false });
  const visibleBar = visible.exports.KeyboardAwareTabBar({ marker: "tabs" });
  assert.equal(visibleBar.props.pointerEvents, "box-none");
  assert.equal(visibleBar.props.accessibilityElementsHidden, false);
  assert.equal(visibleBar.props.importantForAccessibility, "auto");
  assert.deepEqual(visibleBar.props.style[1], {
    opacity: 1,
    transform: [{ translateY: 0 }],
  });
});

test("the floating tab bar covers the bottom gutter so content cannot peek underneath it", () => {
  const layout = evaluateTabLayout({ keyboardVisible: false });
  const bar = layout.exports.KeyboardAwareTabBar({ marker: "tabs" });
  const bottomGutter = bar.props.children[0];

  assert.equal(bottomGutter.type, "View");
  assert.equal(bottomGutter.props.pointerEvents, "none");
  assert.deepEqual(bottomGutter.props.style, {
    backgroundColor: "#F7F1E1",
    bottom: 0,
    height: 12,
    left: 0,
    position: "absolute",
    right: 0,
  });
});

test("the rendered tab bar consumes metric-derived bottom and landscape safe-area padding", () => {
  const layout = evaluateTabLayout({ keyboardVisible: false });
  const root = layout.exports.default();
  const tabs = root.props.children[0];
  const tabBarStyle = tabs.props.screenOptions.tabBarStyle;

  assert.equal(tabBarStyle.paddingBottom, 22);
  assert.equal(tabBarStyle.paddingLeft, 43);
  assert.equal(tabBarStyle.paddingRight, 31);
  assert.equal("paddingHorizontal" in tabBarStyle, false);
});
