import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

type Effect = () => void | (() => void);

type EvaluatedModule = Record<string, (...args: any[]) => any>;

function evaluateTsx(
  file: URL,
  requireModule: (request: string) => unknown,
  timers = createTimerHarness(),
): { exports: EvaluatedModule; timers: ReturnType<typeof createTimerHarness> } {
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
  const module = { exports: {} as EvaluatedModule };
  const run = new Function(
    "require",
    "module",
    "exports",
    "setTimeout",
    "clearTimeout",
    "setInterval",
    "clearInterval",
    output,
  );

  run(
    requireModule,
    module,
    module.exports,
    timers.setTimeout,
    timers.clearTimeout,
    timers.setInterval,
    timers.clearInterval,
  );

  return { exports: module.exports, timers };
}

function createTimerHarness() {
  let nextId = 1;
  const timeouts = new Set<number>();
  const timeoutDurations = new Map<number, number>();
  const intervals = new Set<number>();
  return {
    timeouts,
    timeoutDurations,
    intervals,
    setTimeout: (_callback: () => void, delay = 0) => {
      const id = nextId++;
      timeouts.add(id);
      timeoutDurations.set(id, delay);
      return id;
    },
    clearTimeout: (id: number) => {
      timeoutDurations.delete(id);
      return timeouts.delete(id);
    },
    setInterval: () => {
      const id = nextId++;
      intervals.add(id);
      return id;
    },
    clearInterval: (id: number) => intervals.delete(id),
  };
}

function createAppStateHarness(initialState = "active") {
  type Listener = (state: string) => void;
  const listeners = new Set<Listener>();
  const appState = {
    currentState: initialState,
    addEventListener(_event: "change", listener: Listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };

  return {
    appState,
    emit(state: string) {
      appState.currentState = state;
      listeners.forEach((listener) => listener(state));
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function createRerenderReactHarness() {
  type HookSlot = {
    cleanup?: () => void;
    deps?: readonly unknown[];
    effect?: Effect;
    memo?: unknown;
    nextDeps?: readonly unknown[];
    pending?: boolean;
    ref?: { current: unknown };
    state?: unknown;
  };

  const slotsByInstance = new Map<string, HookSlot[]>();
  const elements: Array<{ type: unknown; props: Record<string, unknown> }> = [];
  let slots: HookSlot[] = [];
  let cursor = 0;

  const selectInstance = (instance: string) => {
    slots = slotsByInstance.get(instance) ?? [];
    slotsByInstance.set(instance, slots);
  };

  const dependenciesChanged = (
    previous: readonly unknown[] | undefined,
    next: readonly unknown[] | undefined,
  ) =>
    !previous ||
    !next ||
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]));

  const react = {
    Fragment: Symbol("Fragment"),
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      const element = { type, props: { ...(props ?? {}), children } };
      elements.push(element);
      return element;
    },
  };

  return {
    beginRender(instance = "root") {
      selectInstance(instance);
      cursor = 0;
      elements.length = 0;
    },
    elements,
    flushEffects() {
      for (const slot of slots) {
        if (!slot.pending || !slot.effect) continue;
        slot.cleanup?.();
        const cleanup = slot.effect();
        slot.cleanup = typeof cleanup === "function" ? cleanup : undefined;
        slot.deps = slot.nextDeps;
        slot.pending = false;
      }
    },
    module: {
      __esModule: true,
      default: react,
      useEffect(effect: Effect, deps?: readonly unknown[]) {
        const slot = (slots[cursor++] ??= {});
        slot.effect = effect;
        slot.nextDeps = deps;
        slot.pending = dependenciesChanged(slot.deps, deps);
      },
      useMemo<T>(factory: () => T, deps?: readonly unknown[]) {
        const slot = (slots[cursor++] ??= {});
        if (dependenciesChanged(slot.deps, deps)) {
          slot.memo = factory();
          slot.deps = deps;
        }
        return slot.memo as T;
      },
      useRef<T>(value: T) {
        const slot = (slots[cursor++] ??= {});
        slot.ref ??= { current: value };
        return slot.ref as { current: T };
      },
      useState<T>(initial: T | (() => T)) {
        const slot = (slots[cursor++] ??= {});
        if (!("state" in slot)) {
          slot.state =
            typeof initial === "function" ? (initial as () => T)() : initial;
        }
        const setState = (next: T | ((value: T) => T)) => {
          slot.state =
            typeof next === "function"
              ? (next as (value: T) => T)(slot.state as T)
              : next;
        };
        return [slot.state as T, setState] as const;
      },
    },
    unmount() {
      slotsByInstance.forEach((instanceSlots) => {
        instanceSlots.forEach((slot) => slot.cleanup?.());
      });
    },
  };
}

function createReactHarness() {
  const effects: Effect[] = [];
  const elements: Array<{ type: unknown; props: Record<string, unknown> }> = [];
  const react = {
    Fragment: Symbol("Fragment"),
    createElement(
      type: unknown,
      props: Record<string, unknown> | null,
      ...children: unknown[]
    ) {
      const element = { type, props: { ...(props ?? {}), children } };
      elements.push(element);
      return element;
    },
  };

  return {
    effects,
    elements,
    module: {
      __esModule: true,
      default: react,
      useEffect(effect: Effect) {
        effects.push(effect);
      },
      useMemo<T>(factory: () => T) {
        return factory();
      },
      useRef<T>(value: T) {
        return { current: value };
      },
      useState<T>(initial: T | (() => T)) {
        const value =
          typeof initial === "function" ? (initial as () => T)() : initial;
        return [value, () => undefined] as const;
      },
    },
  };
}

function createReanimatedHarness(reducedMotion = false) {
  const sharedValuesByInstance = new Map<string, Array<{ value: unknown }>>();
  let sharedValues: Array<{ value: unknown }> = [];
  let cancelCount = 0;
  let repeatCount = 0;
  let sharedValueCursor = 0;
  const identity = <T>(value: T) => value;
  const easing = {
    in: () => identity,
    inOut: () => identity,
    linear: identity,
    out: () => identity,
    quad: identity,
    sin: identity,
  };

  return {
    beginRender(instance = "root") {
      sharedValues = sharedValuesByInstance.get(instance) ?? [];
      sharedValuesByInstance.set(instance, sharedValues);
      sharedValueCursor = 0;
    },
    get cancelCount() {
      return cancelCount;
    },
    get repeatCount() {
      return repeatCount;
    },
    module: {
      __esModule: true,
      default: { Image: "AnimatedImage", View: "AnimatedView" },
      Easing: easing,
      FadeIn: {},
      FadeOut: {},
      cancelAnimation() {
        cancelCount += 1;
      },
      interpolate(_value: number, _input: number[], output: number[]) {
        return output[0];
      },
      useAnimatedStyle<T>(factory: () => T) {
        return factory();
      },
      useReducedMotion() {
        return reducedMotion;
      },
      useSharedValue(value: unknown) {
        const shared =
          sharedValues[sharedValueCursor] ??
          (sharedValues[sharedValueCursor] = { value });
        sharedValueCursor += 1;
        return shared;
      },
      withDelay: (_delay: number, value: unknown) => value,
      withRepeat(value: unknown) {
        repeatCount += 1;
        return value;
      },
      withSequence: (...values: unknown[]) => values.at(-1),
      withSpring: identity,
      withTiming: identity,
    },
    get sharedValues() {
      return sharedValues;
    },
  };
}

const track = {
  key: "tail-wag",
  frameCount: 4,
  fps: 8,
  loop: true,
  slotSize: 32,
};

const spriteAsset = {
  columns: 4,
  frameHeight: 32,
  frameWidth: 32,
  rows: 1,
  source: { uri: "sprite.png" },
};

const roomPlan = {
  activityLabel: "Resting",
  animation: "idle",
  breathLift: 4,
  breathScale: 0.02,
  hudTone: "steady",
  moodLabel: "Content",
  paceMs: 2400,
  recommendedActionLabel: "Keep the rhythm",
  scenePhase: "idle",
  showCareAura: false,
  showHearts: false,
  showSleep: false,
  spriteAction: "tail-wag",
  spriteTrack: track,
  tapVerb: "pet",
  zone: "rug",
};

const roamingPlan = {
  anchor: { zone: "rug", xPct: 20, yPct: 30, scale: 0.9 },
  legs: [
    {
      kind: "walk",
      from: { zone: "rug", xPct: 20, yPct: 30, scale: 0.9 },
      to: { zone: "bed", xPct: 70, yPct: 55, scale: 1.1 },
      durationMs: 1200,
      facing: "right",
    },
  ],
  totalMs: 1200,
};

function createRoomRequire(
  reactModule: unknown,
  reanimatedModule: unknown,
  SpriteSheetPlayer: symbol,
  options: {
    appState?: ReturnType<typeof createAppStateHarness>;
    hasRoomLayer?: boolean;
    roamPlan?: typeof roamingPlan;
  } = {},
) {
  return (request: string) => {
    if (request === "react") return reactModule;
    if (request === "react-native") {
      return {
        AppState: options.appState?.appState ?? createAppStateHarness().appState,
        Platform: { OS: "web" },
        Pressable: "Pressable",
        StyleSheet: {
          absoluteFill: {},
          absoluteFillObject: {
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          },
          create: <T>(value: T) => value,
          hairlineWidth: 1,
        },
        Text: "Text",
        View: "View",
      };
    }
    if (request === "react-native-reanimated") return reanimatedModule;
    if (request === "expo-haptics") {
      return {
        ImpactFeedbackStyle: { Light: "light" },
        impactAsync: async () => undefined,
      };
    }
    if (request === "expo-linear-gradient") {
      return { LinearGradient: "LinearGradient" };
    }
    if (request === "@/components/PixelIcon") {
      return { PixelIcon: "PixelIcon" };
    }
    if (request === "@/components/SpriteSheetPlayer") {
      return { SpriteSheetPlayer };
    }
    if (request === "@/hooks/useColors") {
      return {
        useColors: () => ({
          border: "#aaa",
          brandNavy: "#081a2a",
          muted: "#ddd",
        }),
      };
    }
    if (request === "@/lib/careTwinAssets") {
      return {
        getCareTwinLayerReadiness: () => ({
          roomReady: options.hasRoomLayer !== false,
        }),
        getCareTwinRoomLayer: () =>
          options.hasRoomLayer === false
            ? null
            : { source: { uri: "room.png" } },
        getCareTwinSpriteAsset: () => spriteAsset,
      };
    }
    if (request === "@/lib/careTwinStage") {
      return { zoneForSpriteAction: () => "rug" };
    }
    if (request === "@/lib/careTwinChoreography") {
      return {
        deriveCareTwinChoreography: () => ({
          ambient: [{ action: "look-around", chance: 1, durationMs: 1000 }],
          ambientCadenceMs: 1800,
          reactionDurationMs: 1200,
        }),
        motionRecipeForSpriteAction: () => ({
          bodyBobPx: 1,
          bodySwayPx: 1,
          scalePulse: 1,
          shadowOpacityPulse: 0.1,
          shadowScalePulse: 0.1,
          tiltDeg: 1,
        }),
      };
    }
    if (request === "@/lib/avatarLifeEngine") {
      return {
        CARE_TWIN_SPRITE_MANIFEST: { "tail-wag": track },
        buildCareTwinRoomAccessibilityLabel: () => "Phoenix room",
        deriveCareTwinScene: () => roomPlan,
      };
    }
    if (request === "@/lib/avatarRoomRuntime") {
      return { deriveAvatarRoomRuntime: () => null };
    }
    if (request === "@/lib/careTwinRoam") {
      return {
        careTwinCanRoam: () => Boolean(options.roamPlan),
        deriveCareTwinRoamPlan: () => options.roamPlan ?? null,
        resolveRoamingTwinSpriteAction: () => "tail-wag",
      };
    }
    if (request === "@/lib/pixelRendering") return { pixelImageStyle: {} };
    if (request === "@/lib/petIdentity") {
      return {
        buildCareTwinAwayIdentityCopy: () => "Phoenix is away",
        buildCareTwinLiveTitle: () => "Phoenix live",
        buildCareTwinPetActionLabel: () => "Pet Phoenix",
      };
    }
    if (request.startsWith("@/assets/")) return { uri: request };
    throw new Error(`Unexpected LivingPhoenixRoom dependency: ${request}`);
  };
}

test("SpriteSheetPlayer initially holds frame zero when paused", () => {
  const react = createReactHarness();
  const reanimated = createReanimatedHarness();
  const { exports } = evaluateTsx(
    new URL("../components/SpriteSheetPlayer.tsx", import.meta.url),
    (request) => {
      if (request === "react") return react.module;
      if (request === "react-native") {
        return {
          StyleSheet: { create: (value: unknown) => value },
          View: "View",
        };
      }
      if (request === "react-native-reanimated") return reanimated.module;
      if (request === "@/lib/pixelRendering") return { pixelImageStyle: {} };
      throw new Error(`Unexpected SpriteSheetPlayer dependency: ${request}`);
    },
  );

  exports.SpriteSheetPlayer({ asset: spriteAsset, playing: false, track });
  const cleanups = react.effects
    .map((effect) => effect())
    .filter(Boolean) as Array<() => void>;

  assert.equal(reanimated.repeatCount, 0);
  assert.ok(reanimated.cancelCount >= 2);
  assert.equal(reanimated.sharedValues[0]?.value, 0);

  cleanups.forEach((cleanup) => cleanup());
  assert.ok(reanimated.cancelCount >= 3);
});

test("SpriteSheetPlayer pauses and resumes from its current frame without snapping", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const { exports } = evaluateTsx(
    new URL("../components/SpriteSheetPlayer.tsx", import.meta.url),
    (request) => {
      if (request === "react") return react.module;
      if (request === "react-native") {
        return {
          StyleSheet: { create: (value: unknown) => value },
          View: "View",
        };
      }
      if (request === "react-native-reanimated") return reanimated.module;
      if (request === "@/lib/pixelRendering") return { pixelImageStyle: {} };
      throw new Error(`Unexpected SpriteSheetPlayer dependency: ${request}`);
    },
  );
  const props = { asset: spriteAsset, playing: true, track };

  react.beginRender();
  reanimated.beginRender();
  exports.SpriteSheetPlayer(props);
  react.flushEffects();
  reanimated.sharedValues[0]!.value = 2.25;

  react.beginRender();
  reanimated.beginRender();
  exports.SpriteSheetPlayer({ ...props, playing: false });
  react.flushEffects();
  assert.equal(
    reanimated.sharedValues[0]!.value,
    2.25,
    "pausing must preserve the visible frame",
  );

  react.beginRender();
  reanimated.beginRender();
  exports.SpriteSheetPlayer(props);
  react.flushEffects();
  assert.equal(
    reanimated.sharedValues[0]!.value,
    6.25,
    "resuming should animate one complete modulo cycle from the paused frame",
  );

  react.unmount();
});

test("SpriteSheetPlayer restarts a same-speed strip when only its track key changes", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const { exports } = evaluateTsx(
    new URL("../components/SpriteSheetPlayer.tsx", import.meta.url),
    (request) => {
      if (request === "react") return react.module;
      if (request === "react-native") {
        return {
          StyleSheet: { create: (value: unknown) => value },
          View: "View",
        };
      }
      if (request === "react-native-reanimated") return reanimated.module;
      if (request === "@/lib/pixelRendering") return { pixelImageStyle: {} };
      throw new Error(`Unexpected SpriteSheetPlayer dependency: ${request}`);
    },
  );

  react.beginRender();
  reanimated.beginRender();
  exports.SpriteSheetPlayer({ asset: spriteAsset, playing: true, track });
  react.flushEffects();
  assert.equal(reanimated.repeatCount, 1);

  reanimated.sharedValues[0]!.value = 2.25;
  react.beginRender();
  reanimated.beginRender();
  exports.SpriteSheetPlayer({
    asset: spriteAsset,
    playing: true,
    track: { ...track, key: "idle-breathe" },
  });
  react.flushEffects();

  assert.equal(
    reanimated.repeatCount,
    2,
    "a new strip with identical timing must still start its frame clock",
  );
  assert.equal(reanimated.sharedValues[0]!.value, 4);
  react.unmount();
});

function renderRoom(options: {
  active?: boolean;
  includeReaction?: boolean;
  lowMotion?: boolean;
}) {
  const react = createReactHarness();
  const reanimated = createReanimatedHarness();
  const timers = createTimerHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer),
    timers,
  );

  exports.LivingPhoenixRoom({
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    reaction:
      options.includeReaction === false
        ? null
        : {
            icon: "heart",
            id: 7,
            label: "Nice care",
            spriteAction: "tail-wag",
          },
    speech: "Ready",
    ...options,
  });
  const cleanups = react.effects
    .map((effect) => effect())
    .filter(Boolean) as Array<() => void>;
  const spritePlayers = react.elements.filter(
    (element) => element.type === SpriteSheetPlayer,
  );

  return { cleanups, reanimated, spritePlayers, timers };
}

test("a reaction dismissal timer survives the state rerender it triggers", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const timers = createTimerHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer),
    timers,
  );
  const props = {
    active: true,
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    reaction: {
      icon: "heart",
      id: 7,
      label: "Nice care",
      spriteAction: "tail-wag",
    },
    speech: "Ready",
  };

  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom(props);
  react.flushEffects();
  assert.ok([...timers.timeoutDurations.values()].includes(1200));

  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom(props);
  react.flushEffects();
  assert.ok(
    [...timers.timeoutDurations.values()].includes(1200),
    "the reaction state rerender must not cancel its own dismissal timer",
  );

  react.unmount();
  assert.ok(![...timers.timeoutDurations.values()].includes(1200));
});

test("pausing the living room preserves its ambient pose through a scroll", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const timers = createTimerHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer),
    timers,
  );
  const props = {
    active: true,
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    speech: "Ready",
  };

  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom(props);
  react.flushEffects();
  reanimated.sharedValues[1]!.value = 0.45;
  reanimated.sharedValues[2]!.value = 0.37;
  reanimated.sharedValues[3]!.value = 0.62;

  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom({ ...props, active: false });
  react.flushEffects();

  assert.equal(reanimated.sharedValues[1]!.value, 0.45, "breath phase");
  assert.equal(reanimated.sharedValues[2]!.value, 0.37, "walk phase");
  assert.equal(reanimated.sharedValues[3]!.value, 0.62, "shimmer phase");

  react.unmount();
});

test("the roaming twin preserves its pose through a pause and resumes its current leg", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const timers = createTimerHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer, {
      roamPlan: roamingPlan,
    }),
    timers,
  );
  const roomProps = {
    active: true,
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    speech: "Ready",
    transparentScene: true,
  };

  react.beginRender("room");
  reanimated.beginRender("room");
  exports.LivingPhoenixRoom(roomProps);
  react.flushEffects();
  const roomPressable = react.elements.find(
    (element) =>
      element.type === "Pressable" &&
      typeof element.props.onLayout === "function",
  );
  assert.ok(roomPressable, "the room should expose its stage layout handler");
  (roomPressable.props.onLayout as (event: unknown) => void)({
    nativeEvent: { layout: { width: 300, height: 200 } },
  });

  react.beginRender("room");
  reanimated.beginRender("room");
  exports.LivingPhoenixRoom(roomProps);
  react.flushEffects();
  const roamingRig = react.elements.find(
    (element) =>
      typeof element.type === "function" &&
      element.type.name === "RoamingTwinRig",
  );
  assert.ok(
    roamingRig,
    "the laid-out immersive room should render its roaming rig",
  );
  const renderRig = (motionActive: boolean) => {
    react.beginRender("roaming-rig");
    reanimated.beginRender("roaming-rig");
    (roamingRig.type as (props: Record<string, unknown>) => unknown)({
      ...roamingRig.props,
      motionActive,
    });
    react.flushEffects();
  };

  renderRig(true);
  reanimated.sharedValues[0]!.value = 123;
  reanimated.sharedValues[1]!.value = 87;
  reanimated.sharedValues[2]!.value = 0.97;

  renderRig(false);
  assert.equal(reanimated.sharedValues[0]!.value, 123, "horizontal position");
  assert.equal(reanimated.sharedValues[1]!.value, 87, "vertical position");
  assert.equal(reanimated.sharedValues[2]!.value, 0.97, "depth");

  renderRig(true);
  assert.equal(reanimated.sharedValues[0]!.value, 210, "resumed leg x target");
  assert.ok(
    Math.abs(Number(reanimated.sharedValues[1]!.value) - 110) < 0.000_001,
    "resumed leg y target",
  );
  assert.equal(
    reanimated.sharedValues[2]!.value,
    1.1,
    "resumed leg depth target",
  );

  react.unmount();
});

test("an inactive living room schedules no work and renders a paused static sprite", () => {
  const result = renderRoom({ active: false });

  assert.equal(result.timers.intervals.size, 0);
  assert.equal(result.timers.timeouts.size, 0);
  assert.equal(result.reanimated.repeatCount, 0);
  assert.ok(result.spritePlayers.length > 0);
  assert.ok(
    result.spritePlayers.every((element) => element.props.playing === false),
  );

  result.cleanups.forEach((cleanup) => cleanup());
});

test("backgrounding the app pauses scene work and every sprite frame clock", () => {
  const react = createRerenderReactHarness();
  const reanimated = createReanimatedHarness();
  const timers = createTimerHarness();
  const appState = createAppStateHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer, {
      appState,
    }),
    timers,
  );
  const props = {
    active: true,
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    speech: "Ready",
  };

  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom(props);
  react.flushEffects();
  assert.equal(appState.listenerCount, 1);

  appState.emit("background");
  react.beginRender();
  reanimated.beginRender();
  exports.LivingPhoenixRoom(props);
  react.flushEffects();

  const spritePlayers = react.elements.filter(
    (element) => element.type === SpriteSheetPlayer,
  );
  assert.ok(spritePlayers.length > 0);
  assert.ok(
    spritePlayers.every((element) => element.props.playing === false),
  );
  assert.equal(timers.intervals.size, 0);
  assert.equal(timers.timeouts.size, 0);

  react.unmount();
  assert.equal(appState.listenerCount, 0);
});

test("the fallback room backdrop stays edge-locked instead of drifting with the dog", () => {
  const react = createReactHarness();
  const reanimated = createReanimatedHarness();
  const SpriteSheetPlayer = Symbol("SpriteSheetPlayer");
  const { exports } = evaluateTsx(
    new URL("../components/LivingPhoenixRoom.tsx", import.meta.url),
    createRoomRequire(react.module, reanimated.module, SpriteSheetPlayer, {
      hasRoomLayer: false,
    }),
  );

  exports.LivingPhoenixRoom({
    active: true,
    energy: 80,
    motion: { label: "Calm" },
    mood: "calm",
    nextLabel: "Dinner",
    presenceLabel: "Home",
    speech: "Ready",
  });
  const scene = react.elements.find(
    (element) =>
      element.type === "AnimatedImage" &&
      String((element.props.source as { uri?: string })?.uri).includes(
        "phoenix-room-storybook-day",
      ),
  );
  assert.ok(scene, "the fallback room scene should render");
  const sceneStyles = scene.props.style as Array<Record<string, unknown>>;
  assert.equal(sceneStyles[0]?.left, 0);
  assert.equal(sceneStyles[0]?.right, 0);
  assert.equal(
    sceneStyles.some((style) => Boolean(style?.transform)),
    false,
    "the full-bleed backdrop must not inherit the dog motion transform",
  );
});

test("ambient behavior waits quietly between one-shot beats instead of polling", () => {
  const result = renderRoom({ includeReaction: false });

  assert.equal(result.timers.intervals.size, 0);
  assert.ok(
    [...result.timers.timeoutDurations.values()].some(
      (duration) => duration >= 3200,
    ),
    "ambient behavior should schedule one calm future beat",
  );

  result.cleanups.forEach((cleanup) => cleanup());
});

test("low-motion mode stops perpetual scene and sprite loops without changing the active default", () => {
  const lowMotion = renderRoom({ lowMotion: true });
  const defaultMotion = renderRoom({ includeReaction: false });

  assert.equal(lowMotion.timers.intervals.size, 0);
  assert.equal(lowMotion.reanimated.repeatCount, 0);
  assert.ok(
    lowMotion.spritePlayers.every((element) => element.props.playing === false),
  );

  assert.equal(defaultMotion.timers.intervals.size, 0);
  assert.ok(
    [...defaultMotion.timers.timeoutDurations.values()].some(
      (duration) => duration >= 3200,
    ),
  );
  assert.ok(defaultMotion.reanimated.repeatCount >= 3);
  assert.ok(
    defaultMotion.spritePlayers.every(
      (element) => element.props.playing === true,
    ),
  );

  lowMotion.cleanups.forEach((cleanup) => cleanup());
  defaultMotion.cleanups.forEach((cleanup) => cleanup());
});
