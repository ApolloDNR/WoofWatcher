import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type ElementNode = {
  props: Record<string, any>;
  type: unknown;
};

function evaluateBoardPrimitives() {
  const file = new URL(
    "../components/board/BoardPrimitives.tsx",
    import.meta.url,
  );
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
  const module = {
    exports: {} as Record<string, (...args: any[]) => ElementNode>,
  };
  const Pressable = Symbol("Pressable");
  const PressScale = Symbol("PressScale");
  const react = {
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      return { type, props: { ...(props ?? {}), children } };
    },
  };
  const requireModule = (request: string) => {
    if (request === "react") {
      return {
        __esModule: true,
        default: react,
        useEffect: () => undefined,
        useRef: <T>(value: T) => ({ current: value }),
        useState: <T>(initial: T | (() => T)) => [
          typeof initial === "function" ? (initial as () => T)() : initial,
          () => undefined,
        ],
      };
    }
    if (request === "@expo/vector-icons") return { Ionicons: "Ionicons" };
    if (request === "expo-router") {
      return {
        useLocalSearchParams: () => ({}),
        useRouter: () => ({ push: () => undefined }),
      };
    }
    if (request === "react-native") {
      return {
        Pressable,
        StyleSheet: { create: <T>(value: T) => value },
        Text: "Text",
        View: "View",
      };
    }
    if (request === "react-native-reanimated") {
      return {
        __esModule: true,
        default: { View: "AnimatedView" },
        useAnimatedStyle: (factory: () => unknown) => factory(),
        useReducedMotion: () => false,
        useSharedValue: (value: unknown) => ({ value }),
        withSpring: (value: unknown) => value,
      };
    }
    if (request === "@/components/motion/GameFeel") {
      return {
        enterUp: () => undefined,
        MeterPip: "MeterPip",
        PressScale,
        SPRING: { default: {} },
      };
    }
    if (request === "@/components/PixelIcon") return { PixelIcon: "PixelIcon" };
    if (request === "@/hooks/useColors") {
      return {
        useColors: () => ({
          amber: "#8A5A0C",
          amberSoft: "#F6EAD1",
          background: "#F7F1E1",
          border: "#E8DFC7",
          card: "#FDF9EE",
          copper: "#C85A2A",
          forest: "#33582F",
          foreground: "#2A2519",
          meterTrack: "#EDE5CF",
          muted: "#EDE5CF",
          mutedForeground: "#6E6753",
          navy: "#081424",
          pixelUi: {
            borderWidth: 1,
            radius: { card: 8 },
            shadow: { elevation: 1, opacity: 0.04, radius: 6, y: 2 },
            statusSegments: 7,
          },
          primary: "#33582F",
          primaryForeground: "#F9F4E4",
          sage: "#4D8A56",
          sageSoft: "#E2EFDD",
          secondary: "#E6EDDA",
          stone: "#EDE5CF",
        }),
      };
    }
    if (request === "@/lib/haptics") return { hapticSelect: () => undefined };
    if (request === "@/lib/mobileLayout") {
      return { MIN_MOBILE_TOUCH_TARGET: 48, MOBILE_INLINE_HIT_SLOP: 10 };
    }
    throw new Error(`Unexpected BoardPrimitives dependency: ${request}`);
  };
  const run = new Function("require", "module", "exports", output);
  run(requireModule, module, module.exports);
  return { exports: module.exports, Pressable, PressScale };
}

function descendants(node: unknown): ElementNode[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as ElementNode;
  return [element, ...descendants(element.props.children)];
}

function resolvedMinHeight(style: unknown): number {
  return (Array.isArray(style) ? style.flat(Infinity) : [style])
    .filter(Boolean)
    .reduce(
      (height, entry) =>
        typeof entry === "object" && typeof entry.minHeight === "number"
          ? entry.minHeight
          : height,
      0,
    );
}

test("shared segment chips and compact action buttons keep 48pt interactive bounds", () => {
  const board = evaluateBoardPrimitives();
  const segments = board.exports.BoardSegmentTabs({
    active: "schedule",
    onChange: () => undefined,
    segments: [{ key: "schedule", label: "Schedule" }],
  });
  const segment = descendants(segments).find(
    (element) => element.type === board.Pressable,
  );
  assert.ok(segment, "segment control should render a pressable chip");
  assert.ok(
    resolvedMinHeight(segment.props.style) >= 48,
    "segment chip should preserve the app's 48pt mobile target",
  );
  const segmentRenderer = (segment.props.children as unknown[]).find(
    (child) => typeof child === "function",
  ) as ((state: { pressed: boolean }) => ElementNode) | undefined;
  assert.ok(segmentRenderer, "segment target should render compact artwork");
  assert.equal(
    resolvedMinHeight(segmentRenderer({ pressed: false }).props.style),
    36,
    "segment artwork should stay visually compact inside its target",
  );

  const action = board.exports.BoardActionButton({
    compact: true,
    label: "Done",
    onPress: () => undefined,
  });
  assert.equal(action.type, board.PressScale);
  assert.ok(
    resolvedMinHeight(action.props.containerStyle) >= 48,
    "compact action should preserve the app's 48pt mobile target",
  );
  assert.equal(
    resolvedMinHeight(action.props.style),
    36,
    "compact action artwork should stay visually compact inside its target",
  );
});
