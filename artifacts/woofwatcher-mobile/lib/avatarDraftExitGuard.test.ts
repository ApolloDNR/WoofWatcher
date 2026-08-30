import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  activateAvatarDraftExitConfirmationLatch,
  createAvatarDraftExitConfirmationLatch,
  invalidateAvatarDraftExitConfirmationLatch,
  registerAvatarDraftExitRequestHandler,
  requestRegisteredAvatarDraftExit,
  requestAvatarDraftExit,
} from "./avatarDraftExitGuard.ts";

const AVATAR_SOURCE = readFileSync(
  join(
    process.cwd(),
    "artifacts",
    "woofwatcher-mobile",
    "components",
    "more",
    "AvatarStudioScreen.tsx",
  ),
  "utf8",
);

test("a clean Avatar draft exits immediately without asking to discard", () => {
  const events: string[] = [];
  const result = requestAvatarDraftExit({
    dirty: false,
    persistenceInFlight: false,
    confirmationLatch: createAvatarDraftExitConfirmationLatch(),
    confirmDiscard: () => events.push("confirm"),
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  });

  assert.equal(result, "exited");
  assert.deepEqual(events, ["exit"]);
});

test("a dirty Avatar draft exits only after explicit discard confirmation", () => {
  const events: string[] = [];
  let confirm: (() => void) | undefined;
  const result = requestAvatarDraftExit({
    dirty: true,
    persistenceInFlight: false,
    confirmationLatch: createAvatarDraftExitConfirmationLatch(),
    confirmDiscard: (onConfirmed) => {
      events.push("confirm");
      confirm = onConfirmed;
    },
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  });

  assert.equal(result, "confirmation-requested");
  assert.deepEqual(events, ["confirm"]);
  confirm?.();
  assert.deepEqual(events, ["confirm", "clean", "exit"]);
});

test("persistence in flight blocks every Avatar exit", () => {
  const events: string[] = [];
  const result = requestAvatarDraftExit({
    dirty: true,
    persistenceInFlight: true,
    confirmationLatch: createAvatarDraftExitConfirmationLatch(),
    confirmDiscard: () => events.push("confirm"),
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  });

  assert.equal(result, "blocked");
  assert.deepEqual(events, []);
});

test("repeated dirty exit requests share one confirmation and dispatch one exit", () => {
  const events: string[] = [];
  const confirmations: Array<{
    confirm: () => void;
    cancel: () => void;
  }> = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  const sharedInput = {
    dirty: true,
    persistenceInFlight: false,
    confirmationLatch,
    confirmDiscard: (
      onConfirmed: () => void,
      onCancelled: () => void,
    ) => {
      events.push("confirm-requested");
      confirmations.push({ confirm: onConfirmed, cancel: onCancelled });
    },
    markClean: () => events.push("clean"),
  };

  assert.equal(
    requestAvatarDraftExit({
      ...sharedInput,
      exit: () => events.push("visible-back-exit"),
    }),
    "confirmation-requested",
  );
  assert.equal(
    requestAvatarDraftExit({
      ...sharedInput,
      exit: () => events.push("gesture-exit"),
    }),
    "confirmation-pending",
  );
  assert.equal(
    requestAvatarDraftExit({
      ...sharedInput,
      exit: () => events.push("tab-replace-exit"),
    }),
    "confirmation-pending",
  );
  assert.equal(confirmations.length, 1);
  assert.deepEqual(events, ["confirm-requested"]);

  confirmations[0]?.confirm();
  confirmations[0]?.confirm();
  confirmations[0]?.cancel();
  assert.deepEqual(events, [
    "confirm-requested",
    "clean",
    "visible-back-exit",
  ]);
});

test("reentrant requests raised by the presenter share the same dialog", () => {
  const events: string[] = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  let confirm: (() => void) | undefined;
  const input = {
    dirty: true,
    persistenceInFlight: false,
    confirmationLatch,
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  };

  assert.equal(
    requestAvatarDraftExit({
      ...input,
      confirmDiscard: (onConfirmed) => {
        events.push("present");
        confirm = onConfirmed;
        assert.equal(
          requestAvatarDraftExit({
            ...input,
            confirmDiscard: () => events.push("present-again"),
          }),
          "confirmation-pending",
        );
      },
    }),
    "confirmation-requested",
  );

  confirm?.();
  confirm?.();
  assert.deepEqual(events, ["present", "clean", "exit"]);
});

test("cancelling releases the latch and a later request can confirm", () => {
  const events: string[] = [];
  const confirmations: Array<{
    confirm: () => void;
    cancel: () => void;
  }> = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  const input = {
    dirty: true,
    persistenceInFlight: false,
    confirmationLatch,
    confirmDiscard: (
      onConfirmed: () => void,
      onCancelled: () => void,
    ) => {
      events.push("confirm-requested");
      confirmations.push({ confirm: onConfirmed, cancel: onCancelled });
    },
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  };

  assert.equal(requestAvatarDraftExit(input), "confirmation-requested");
  confirmations[0]?.cancel();
  assert.equal(requestAvatarDraftExit(input), "confirmation-requested");
  assert.equal(confirmations.length, 2);

  // A stale callback from the cancelled dialog cannot settle the new request.
  confirmations[0]?.confirm();
  assert.deepEqual(events, ["confirm-requested", "confirm-requested"]);
  assert.equal(requestAvatarDraftExit(input), "confirmation-pending");

  confirmations[1]?.confirm();
  assert.deepEqual(events, [
    "confirm-requested",
    "confirm-requested",
    "clean",
    "exit",
  ]);
});

test("a synchronous confirmation presenter failure releases the latch", () => {
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  assert.throws(
    () =>
      requestAvatarDraftExit({
        dirty: true,
        persistenceInFlight: false,
        confirmationLatch,
        confirmDiscard: () => {
          throw new Error("dialog unavailable");
        },
        markClean: () => {},
        exit: () => {},
      }),
    /dialog unavailable/,
  );

  let requests = 0;
  assert.equal(
    requestAvatarDraftExit({
      dirty: true,
      persistenceInFlight: false,
      confirmationLatch,
      confirmDiscard: () => {
        requests += 1;
      },
      markClean: () => {},
      exit: () => {},
    }),
    "confirmation-requested",
  );
  assert.equal(requests, 1);
});

test("unmount invalidation makes every pending confirmation callback inert", () => {
  const events: string[] = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  let confirm: (() => void) | undefined;
  let cancel: (() => void) | undefined;

  requestAvatarDraftExit({
    dirty: true,
    persistenceInFlight: false,
    confirmationLatch,
    confirmDiscard: (onConfirmed, onCancelled) => {
      confirm = onConfirmed;
      cancel = onCancelled;
    },
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  });

  invalidateAvatarDraftExitConfirmationLatch(confirmationLatch);
  confirm?.();
  cancel?.();
  assert.deepEqual(events, []);

  activateAvatarDraftExitConfirmationLatch(confirmationLatch);
  assert.equal(
    requestAvatarDraftExit({
      dirty: false,
      persistenceInFlight: false,
      confirmationLatch,
      confirmDiscard: () => events.push("confirm"),
      markClean: () => events.push("clean"),
      exit: () => events.push("fresh-exit"),
    }),
    "exited",
  );
  assert.deepEqual(events, ["fresh-exit"]);
});

test("a mounted Avatar guard owns focused More replacements and unregisters safely", () => {
  const events: string[] = [];
  const confirmations: Array<() => void> = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  const unregister = registerAvatarDraftExitRequestHandler((exit) =>
    requestAvatarDraftExit({
      dirty: true,
      persistenceInFlight: false,
      confirmationLatch,
      confirmDiscard: (onConfirmed) => confirmations.push(onConfirmed),
      markClean: () => events.push("clean"),
      exit,
    }),
  );

  try {
    assert.equal(
      requestRegisteredAvatarDraftExit(() => events.push("replace:/more")),
      "confirmation-requested",
    );
    assert.equal(
      requestRegisteredAvatarDraftExit(() => events.push("replace-again:/more")),
      "confirmation-pending",
    );
    assert.equal(confirmations.length, 1);
    confirmations[0]?.();
    assert.deepEqual(events, ["clean", "replace:/more"]);
  } finally {
    unregister();
  }

  assert.equal(
    requestRegisteredAvatarDraftExit(() => events.push("unguarded")),
    "unhandled",
  );
  assert.deepEqual(events, ["clean", "replace:/more"]);
});

test("a stale unregister cannot detach a newer mounted Avatar guard", () => {
  const events: string[] = [];
  const unregisterOld = registerAvatarDraftExitRequestHandler((exit) => {
    events.push("old");
    exit();
    return "exited";
  });
  const unregisterNew = registerAvatarDraftExitRequestHandler((exit) => {
    events.push("new");
    exit();
    return "exited";
  });

  try {
    unregisterOld();
    assert.equal(
      requestRegisteredAvatarDraftExit(() => events.push("exit")),
      "exited",
    );
    assert.deepEqual(events, ["new", "exit"]);
  } finally {
    unregisterNew();
  }
});

test("an inactive Avatar scene releases unrelated tab resets and re-arms on focus", () => {
  const events: string[] = [];
  const confirmations: Array<() => void> = [];
  const latch = createAvatarDraftExitConfirmationLatch();
  const handler = (exit: () => void) =>
    requestAvatarDraftExit({
      dirty: true,
      persistenceInFlight: false,
      confirmationLatch: latch,
      confirmDiscard: (onConfirmed) => confirmations.push(onConfirmed),
      markClean: () => events.push("clean"),
      exit,
    });

  const unregisterFocused = registerAvatarDraftExitRequestHandler(handler);
  unregisterFocused();
  invalidateAvatarDraftExitConfirmationLatch(latch);

  assert.equal(
    requestRegisteredAvatarDraftExit(() => events.push("replace:/health")),
    "unhandled",
  );
  assert.deepEqual(events, []);
  assert.equal(confirmations.length, 0);

  activateAvatarDraftExitConfirmationLatch(latch);
  const unregisterRefocused = registerAvatarDraftExitRequestHandler(handler);
  try {
    assert.equal(
      requestRegisteredAvatarDraftExit(() => events.push("replace:/more")),
      "confirmation-requested",
    );
    confirmations[0]?.();
    assert.deepEqual(events, ["clean", "replace:/more"]);
  } finally {
    unregisterRefocused();
    invalidateAvatarDraftExitConfirmationLatch(latch);
  }

  assert.match(AVATAR_SOURCE, /useFocusEffect\(/);
  assert.match(
    AVATAR_SOURCE,
    /useFocusEffect\([\s\S]{0,700}activateAvatarDraftExitConfirmationLatch[\s\S]{0,700}registerAvatarDraftExitRequestHandler[\s\S]{0,700}unregister\(\)[\s\S]{0,700}invalidateAvatarDraftExitConfirmationLatch/,
  );
});

test("clean repeated exits dispatch only once for one mounted lifecycle", () => {
  const events: string[] = [];
  const confirmationLatch = createAvatarDraftExitConfirmationLatch();
  const input = {
    dirty: false,
    persistenceInFlight: false,
    confirmationLatch,
    confirmDiscard: () => events.push("confirm"),
    markClean: () => events.push("clean"),
    exit: () => events.push("exit"),
  };

  assert.equal(requestAvatarDraftExit(input), "exited");
  assert.equal(requestAvatarDraftExit(input), "exit-pending");
  assert.deepEqual(events, ["exit"]);
});

test("Avatar routes visible, system, gesture, and tab replacement exits through one guard", () => {
  assert.match(AVATAR_SOURCE, /useNavigation\(\)/);
  assert.match(AVATAR_SOURCE, /addListener\("beforeRemove"/);
  assert.match(
    AVATAR_SOURCE,
    /beforeRemove[\s\S]{0,900}event\.preventDefault\(\)[\s\S]{0,900}requestAvatarDraftExit/,
  );
  assert.match(
    AVATAR_SOURCE,
    /requestAvatarStudioBack[\s\S]{0,520}requestAvatarDraftExit\([\s\S]{0,420}exit: onBack/,
  );
  assert.match(
    AVATAR_SOURCE,
    /function clearAvatarDraftDirty[\s\S]{0,120}dirtyRef\.current = false/,
  );
  assert.match(
    AVATAR_SOURCE,
    /requestAvatarStudioExit[\s\S]{0,520}markClean: \(\) => clearAvatarDraftDirty\(avatarDraftDirtyRef\)/,
  );
  assert.match(
    AVATAR_SOURCE,
    /avatarDraftExitConfirmationLatchRef = useRef\([\s\S]{0,120}createAvatarDraftExitConfirmationLatch\(\)/,
  );
  assert.equal(
    AVATAR_SOURCE.match(
      /confirmationLatch: avatarDraftExitConfirmationLatchRef\.current/g,
    )?.length ?? 0,
    3,
    "visible Back, beforeRemove, and route replacement share one latch",
  );
  assert.match(
    AVATAR_SOURCE,
    /confirmAvatarDraftDiscard\([\s\S]{0,160}onCancelled[\s\S]{0,420}onConfirmed,[\s\S]{0,80}onCancelled/,
  );
  assert.match(
    AVATAR_SOURCE,
    /activateAvatarDraftExitConfirmationLatch\(confirmationLatch\)[\s\S]{0,180}registerAvatarDraftExitRequestHandler\([\s\S]{0,120}requestAvatarStudioExit[\s\S]{0,180}return \(\) => \{[\s\S]{0,100}unregister\(\)[\s\S]{0,120}invalidateAvatarDraftExitConfirmationLatch\(confirmationLatch\)/,
  );
});
