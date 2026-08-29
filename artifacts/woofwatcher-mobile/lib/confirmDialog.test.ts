import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

import ts from "typescript";

import {
  activateDeliberateConfirmation,
  createDeliberateConfirmationLatch,
  resetDeliberateConfirmation,
  transitionDeliberateConfirmation,
  trySettleDeliberateConfirmation,
} from "./deliberateConfirmation.ts";

type DialogButton = {
  text: string;
  style?: string;
  onPress?: () => void;
};

type DialogOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type WebRequest = {
  onConfirm: () => void;
  onCancel: () => void;
};

type ConfirmDialogModule = {
  confirmThroughSteps: (
    steps: readonly {
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel?: string;
      destructive?: boolean;
    }[],
    onConfirmed: () => void,
    onCancelled?: () => void,
  ) => void;
  registerWebDialogPresenter: (
    present: (request: WebRequest) => void,
  ) => () => void;
};

const CONFIRM_DIALOG_SOURCE = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "lib",
    "confirmDialog.ts",
  ),
  "utf8",
);

const STEPS = [
  {
    title: "First confirmation",
    message: "Continue to the next confirmation?",
    confirmLabel: "Continue",
  },
  {
    title: "Final confirmation",
    message: "Finish the destructive action?",
    confirmLabel: "Finish",
    destructive: true,
  },
] as const;

function loadConfirmDialog(input: {
  os: "android" | "ios" | "web";
  alert?: (
    title: string,
    message: string,
    buttons?: DialogButton[],
    options?: DialogOptions,
  ) => void;
  confirm?: (text: string) => boolean;
}): ConfirmDialogModule {
  const compiled = ts.transpileModule(CONFIRM_DIALOG_SOURCE, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const context = vm.createContext({
    console,
    globalThis: {
      confirm: input.confirm,
    },
    module,
    exports: module.exports,
    require: (specifier: string) => {
      assert.equal(specifier, "react-native");
      return {
        Alert: { alert: input.alert ?? (() => {}) },
        Platform: { OS: input.os },
      };
    },
  });
  vm.runInContext(compiled, context, { filename: "confirmDialog.js" });
  return module.exports as ConfirmDialogModule;
}

test("hosted web confirmation settles a multi-step flow exactly once", () => {
  const requests: WebRequest[] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({ os: "web" });
  dialog.registerWebDialogPresenter((request) => requests.push(request));

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.equal(requests.length, 1);
  requests[0]?.onConfirm();
  requests[0]?.onConfirm();
  assert.equal(requests.length, 2, "one answer must enqueue one next step");
  requests[1]?.onConfirm();
  requests[1]?.onConfirm();
  requests[1]?.onCancel();
  assert.deepEqual(events, ["confirmed"]);
});

test("the hosted transition latch rejects a double activation across real flow steps", () => {
  const requests: WebRequest[] = [];
  const events: string[] = [];
  const latch = createDeliberateConfirmationLatch<WebRequest>(400);
  const dialog = loadConfirmDialog({ os: "web" });
  let now = 1_000;

  dialog.registerWebDialogPresenter((request) => {
    if (requests.length === 0) {
      activateDeliberateConfirmation(latch, request, now);
    }
    requests.push(request);
  });
  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );

  const confirmCurrent = (): boolean => {
    const request = requests[0];
    if (!request || !trySettleDeliberateConfirmation(latch, request, now)) {
      return false;
    }
    requests.shift();
    request.onConfirm();
    const next = requests[0];
    if (next) transitionDeliberateConfirmation(latch, next, now);
    else resetDeliberateConfirmation(latch);
    return true;
  };

  assert.equal(confirmCurrent(), true);
  assert.equal(requests.length, 1);
  assert.equal(confirmCurrent(), false, "the same rapid gesture cannot accept step two");
  assert.deepEqual(events, []);

  now += 400;
  assert.equal(confirmCurrent(), true);
  assert.deepEqual(events, ["confirmed"]);
});

test("hosted web cancellation calls back once and blocks stale confirmation", () => {
  const requests: WebRequest[] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({ os: "web" });
  dialog.registerWebDialogPresenter((request) => requests.push(request));

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  requests[0]?.onCancel();
  requests[0]?.onCancel();
  requests[0]?.onConfirm();
  assert.deepEqual(events, ["cancelled"]);
  assert.equal(requests.length, 1);
});

test("a hosted presenter failure cancels the flow before propagating", () => {
  const events: string[] = [];
  const dialog = loadConfirmDialog({ os: "web" });
  dialog.registerWebDialogPresenter(() => {
    throw new Error("host unavailable");
  });

  assert.throws(
    () =>
      dialog.confirmThroughSteps(
        STEPS,
        () => events.push("confirmed"),
        () => events.push("cancelled"),
      ),
    /host unavailable/,
  );
  assert.deepEqual(events, ["cancelled"]);
});

test("a later hosted step failure cancels the multi-step flow once", () => {
  const requests: WebRequest[] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({ os: "web" });
  dialog.registerWebDialogPresenter((request) => {
    requests.push(request);
    if (requests.length === 2) throw new Error("second step unavailable");
  });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.throws(() => requests[0]?.onConfirm(), /second step unavailable/);
  requests[0]?.onCancel();
  assert.deepEqual(events, ["cancelled"]);
});

test("fallback web propagates confirm and cancel across multiple steps", () => {
  const answers = [true, false];
  const prompts: string[] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({
    os: "web",
    confirm: (text) => {
      prompts.push(text);
      return answers.shift() ?? false;
    },
  });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.equal(prompts.length, 2);
  assert.deepEqual(events, ["cancelled"]);
});

test("fallback web confirms only after every step is accepted", () => {
  const events: string[] = [];
  const dialog = loadConfirmDialog({ os: "web", confirm: () => true });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.deepEqual(events, ["confirmed"]);
});

test("native cancellation releases a multi-step flow exactly once", () => {
  const dialogs: DialogButton[][] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({
    os: "ios",
    alert: (_title, _message, buttons = []) => dialogs.push(buttons),
  });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.equal(dialogs.length, 1);
  dialogs[0]?.[1]?.onPress?.();
  dialogs[0]?.[1]?.onPress?.();
  assert.equal(dialogs.length, 2);
  dialogs[1]?.[0]?.onPress?.();
  dialogs[1]?.[0]?.onPress?.();
  dialogs[1]?.[1]?.onPress?.();
  assert.deepEqual(events, ["cancelled"]);
});

test("native system dismissal uses the cancellation path", () => {
  const buttons: DialogButton[][] = [];
  const options: DialogOptions[] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({
    os: "android",
    alert: (_title, _message, dialogButtons = [], dialogOptions = {}) => {
      buttons.push(dialogButtons);
      options.push(dialogOptions);
    },
  });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  assert.equal(options[0]?.cancelable, true);
  options[0]?.onDismiss?.();
  options[0]?.onDismiss?.();
  buttons[0]?.[1]?.onPress?.();
  assert.deepEqual(events, ["cancelled"]);
});

test("native confirmation advances each step once", () => {
  const dialogs: DialogButton[][] = [];
  const events: string[] = [];
  const dialog = loadConfirmDialog({
    os: "ios",
    alert: (_title, _message, buttons = []) => dialogs.push(buttons),
  });

  dialog.confirmThroughSteps(
    STEPS,
    () => events.push("confirmed"),
    () => events.push("cancelled"),
  );
  dialogs[0]?.[1]?.onPress?.();
  dialogs[0]?.[1]?.onPress?.();
  assert.equal(dialogs.length, 2);
  dialogs[1]?.[1]?.onPress?.();
  dialogs[1]?.[1]?.onPress?.();
  dialogs[1]?.[0]?.onPress?.();
  assert.deepEqual(events, ["confirmed"]);
});

test("the cancellation callback remains optional", () => {
  const dialog = loadConfirmDialog({ os: "web", confirm: () => false });
  assert.doesNotThrow(() =>
    dialog.confirmThroughSteps(STEPS, () => {
      throw new Error("must not confirm");
    }),
  );
});
