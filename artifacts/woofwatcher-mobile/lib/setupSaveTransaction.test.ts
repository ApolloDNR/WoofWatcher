import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function loadCoordinator() {
  const module = await import("./setupSaveTransaction.ts").catch(() => null);
  assert.ok(module, "the Setup save coordinator must exist");
  return module.createSetupSaveCoordinator;
}

test("duplicate Setup saves share one care and avatar transaction", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const avatarGate = deferred<void>();
  const avatarStarted = deferred<void>();
  let careWrites = 0;
  let avatarWrites = 0;
  const plan = {
    saveCare: () => {
      careWrites += 1;
      return true;
    },
    saveAvatar: async () => {
      avatarWrites += 1;
      avatarStarted.resolve();
      await avatarGate.promise;
    },
    success: { dogName: "Luna" },
  };

  const first = coordinator.save(plan);
  const duplicate = coordinator.save(plan);
  assert.equal(duplicate, first);
  await avatarStarted.promise;
  assert.equal(careWrites, 1);
  assert.equal(avatarWrites, 1);
  avatarGate.resolve();

  assert.deepEqual(await first, {
    status: "saved",
    success: { dogName: "Luna" },
  });
});

test("a failed avatar write reports partial save and retry skips the saved care write", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let careWrites = 0;
  let avatarWrites = 0;
  const plan = {
    saveCare: () => {
      careWrites += 1;
      return true;
    },
    saveAvatar: async () => {
      avatarWrites += 1;
      if (avatarWrites === 1) throw new Error("avatar storage unavailable");
    },
    success: { dogName: "Luna" },
  };

  const partial = await coordinator.save(plan);
  assert.equal(partial.status, "avatar-failed");
  assert.equal(coordinator.hasPendingAvatarRetry(), true);
  assert.equal(careWrites, 1);
  assert.equal(avatarWrites, 1);

  assert.deepEqual(await coordinator.retryAvatar(), {
    status: "saved",
    success: { dogName: "Luna" },
  });
  assert.equal(
    careWrites,
    1,
    "retry must not duplicate the accepted care write",
  );
  assert.equal(avatarWrites, 2);
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("a rejected care save never attempts or queues an avatar write", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let avatarWrites = 0;

  assert.deepEqual(
    await coordinator.save({
      saveCare: () => false,
      saveAvatar: async () => {
        avatarWrites += 1;
      },
      success: { dogName: "Luna" },
    }),
    { status: "care-rejected" },
  );
  assert.equal(avatarWrites, 0);
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("a rejected care save can retry Care without replaying Avatar", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let careWrites = 0;
  let avatarWrites = 0;
  const plan = {
    saveCare: () => {
      careWrites += 1;
      return careWrites > 1;
    },
    saveAvatar: async () => {
      avatarWrites += 1;
    },
    success: { dogName: "Luna" },
  };

  assert.deepEqual(await coordinator.save(plan), { status: "care-rejected" });
  assert.equal(careWrites, 1);
  assert.equal(avatarWrites, 0);

  assert.deepEqual(await coordinator.save(plan), {
    status: "saved",
    success: { dogName: "Luna" },
  });
  assert.equal(careWrites, 2);
  assert.equal(avatarWrites, 1);
});

test("a stale conditional avatar reservation preserves the newer twin without queuing a retry", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let careWrites = 0;
  let avatarAttempts = 0;

  assert.deepEqual(
    await coordinator.save({
      saveCare: () => {
        careWrites += 1;
        return true;
      },
      saveAvatar: async () => {
        avatarAttempts += 1;
        return false;
      },
      success: { dogName: "Luna" },
    }),
    {
      status: "avatar-stale",
      success: { dogName: "Luna" },
    },
  );
  assert.equal(careWrites, 1);
  assert.equal(avatarAttempts, 1);
  assert.equal(
    coordinator.hasPendingAvatarRetry(),
    false,
    "a newer Avatar Studio write must never be replaced by retrying the stale Setup snapshot",
  );
  assert.deepEqual(await coordinator.retryAvatar(), {
    status: "nothing-to-retry",
  });
});

test("an avatar retry becomes stale when a newer twin write advances its fence", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let avatarAttempts = 0;
  const plan = {
    saveCare: () => true,
    saveAvatar: async () => {
      avatarAttempts += 1;
      if (avatarAttempts === 1) throw new Error("storage unavailable");
      return false;
    },
    success: { dogName: "Luna" },
  };

  assert.equal((await coordinator.save(plan)).status, "avatar-failed");
  assert.equal(coordinator.hasPendingAvatarRetry(), true);
  assert.deepEqual(await coordinator.retryAvatar(), {
    status: "avatar-stale",
    success: { dogName: "Luna" },
  });
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
  assert.equal(avatarAttempts, 2);
});

test("an asynchronous care save must finish durably before the avatar stage starts", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const careGate = deferred<boolean>();
  let avatarWrites = 0;

  const save = coordinator.save({
    saveCare: () => careGate.promise,
    saveAvatar: async () => {
      avatarWrites += 1;
    },
    success: { dogName: "Luna" },
  });

  await Promise.resolve();
  assert.equal(
    avatarWrites,
    0,
    "the avatar stage cannot start before durable care persistence settles",
  );
  careGate.resolve(true);

  assert.deepEqual(await save, {
    status: "saved",
    success: { dogName: "Luna" },
  });
  assert.equal(avatarWrites, 1);
});

test("a rejected durable care promise fails closed before the avatar stage", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let avatarWrites = 0;

  const outcome = await coordinator.save({
    saveCare: async () => {
      throw new Error("care storage unavailable");
    },
    saveAvatar: async () => {
      avatarWrites += 1;
    },
    success: { dogName: "Luna" },
  });

  assert.deepEqual(outcome, { status: "care-rejected" });
  assert.equal(avatarWrites, 0);
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("scope invalidation suppresses a deferred avatar success and permits a fresh save", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const avatarGate = deferred<void>();
  const avatarStarted = deferred<void>();
  const stale = coordinator.save({
    saveCare: () => true,
    saveAvatar: async () => {
      avatarStarted.resolve();
      await avatarGate.promise;
    },
    success: { dogName: "Old dog" },
  });
  await avatarStarted.promise;

  coordinator.invalidate();
  avatarGate.resolve();
  assert.deepEqual(await stale, { status: "stale" });
  assert.equal(coordinator.hasPendingAvatarRetry(), false);

  assert.deepEqual(
    await coordinator.save({
      saveCare: () => true,
      success: { dogName: "New dog" },
    }),
    { status: "saved", success: { dogName: "New dog" } },
  );
});

test("scope invalidation suppresses a deferred care result before avatar work", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const careGate = deferred<boolean>();
  let avatarWrites = 0;
  const stale = coordinator.save({
    saveCare: () => careGate.promise,
    saveAvatar: async () => {
      avatarWrites += 1;
    },
    success: { dogName: "Old dog" },
  });

  await Promise.resolve();
  coordinator.invalidate();
  careGate.resolve(true);

  assert.deepEqual(await stale, { status: "stale" });
  assert.equal(avatarWrites, 0);
  assert.deepEqual(
    await coordinator.save({
      saveCare: async () => true,
      success: { dogName: "New dog" },
    }),
    { status: "saved", success: { dogName: "New dog" } },
  );
});

test("scope invalidation discards an avatar-only retry from the prior care save", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  await coordinator.save({
    saveCare: () => true,
    saveAvatar: async () => {
      throw new Error("avatar unavailable");
    },
    success: { dogName: "Old dog" },
  });
  assert.equal(coordinator.hasPendingAvatarRetry(), true);

  coordinator.invalidate();

  assert.deepEqual(await coordinator.retryAvatar(), {
    status: "nothing-to-retry",
  });
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("a same-scope Care replacement after durability retires the avatar stage", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const careGate = deferred<boolean>();
  let current = true;
  let avatarWrites = 0;
  const save = coordinator.save({
    saveCare: () => careGate.promise,
    saveAvatar: async () => {
      avatarWrites += 1;
    },
    isCurrent: () => current,
    success: { dogName: "Luna" },
  });

  await Promise.resolve();
  current = false;
  careGate.resolve(true);

  assert.deepEqual(await save, { status: "stale" });
  assert.equal(avatarWrites, 0);
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("a same-scope Care replacement suppresses delayed avatar success and retry", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  const avatarGate = deferred<void>();
  const avatarStarted = deferred<void>();
  let current = true;
  const save = coordinator.save({
    saveCare: () => true,
    saveAvatar: async () => {
      avatarStarted.resolve();
      await avatarGate.promise;
    },
    isCurrent: () => current,
    success: { dogName: "Luna" },
  });
  await avatarStarted.promise;

  current = false;
  avatarGate.resolve();

  assert.deepEqual(await save, { status: "stale" });
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("a same-scope Care replacement retires an avatar-only retry before it writes", async () => {
  const createSetupSaveCoordinator = await loadCoordinator();
  const coordinator = createSetupSaveCoordinator<{ dogName: string }>();
  let current = true;
  let avatarWrites = 0;
  const plan = {
    saveCare: () => true,
    saveAvatar: async () => {
      avatarWrites += 1;
      throw new Error("avatar unavailable");
    },
    isCurrent: () => current,
    success: { dogName: "Luna" },
  };

  assert.equal((await coordinator.save(plan)).status, "avatar-failed");
  assert.equal(coordinator.hasPendingAvatarRetry(), true);
  current = false;

  assert.deepEqual(await coordinator.retryAvatar(), { status: "stale" });
  assert.equal(avatarWrites, 1);
  assert.equal(coordinator.hasPendingAvatarRetry(), false);
});

test("the Setup save fence accepts an exact provider echo but rejects semantic replacement", async () => {
  const module = await import("./setupSaveTransaction.ts").catch(() => null);
  assert.ok(module, "the Setup save transaction helpers must exist");
  assert.equal(typeof module.isSetupSaveFenceCurrent, "function");

  const captured = {
    careScopeRevision: 4,
    activePetId: "dog-a",
    careSourceFingerprint: "source-v7",
    careDocumentFingerprint: "care-luna",
  };
  assert.equal(
    module.isSetupSaveFenceCurrent({
      acceptedCareDocumentFingerprint: null,
      captured,
      current: captured,
    }),
    true,
    "the pre-Care stage must accept the source captured at the save tap",
  );
  assert.equal(
    module.isSetupSaveFenceCurrent({
      acceptedCareDocumentFingerprint: "care-luna",
      captured,
      current: {
        ...captured,
        careSourceFingerprint: "source-v8",
      },
    }),
    true,
    "a provider version echo of the exact accepted document must not cancel Avatar or success",
  );
  assert.equal(
    module.isSetupSaveFenceCurrent({
      acceptedCareDocumentFingerprint: "care-luna",
      captured,
      current: {
        ...captured,
        careSourceFingerprint: "source-v8-other",
        careDocumentFingerprint: "care-other",
      },
    }),
    false,
  );
  assert.equal(
    module.isSetupSaveFenceCurrent({
      acceptedCareDocumentFingerprint: "care-luna",
      captured,
      current: { ...captured, activePetId: "dog-b" },
    }),
    false,
  );
});

test("Setup awaits the optional twin write and exposes a partial-save retry", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );

  assert.match(setup, /createSetupSaveCoordinator/);
  assert.match(setup, /const persistSetup = async \(\) =>/);
  assert.match(
    setup,
    /const saveSetup = \(\) => \{\s*if \(!setupHydrated\) return;[\s\S]*?void persistSetup\(\)/,
  );
  assert.match(setup, /await setupSaveCoordinator\.save\(\{/);
  assert.doesNotMatch(
    setup,
    /void saveAvatarConfig\([\s\S]*?\.catch\(\(\) => \{\}\)/,
  );
  assert.match(
    setup,
    /outcome\.status === "saved"[\s\S]*?completeSetupSave\(outcome\.success\)/,
  );
  assert.match(
    setup,
    /const completeSetupSave = \(moment: SetupSuccessMoment\)[\s\S]*?setSuccessMoment\(moment\)/,
  );
  assert.match(
    setup,
    /outcome\.status === "avatar-failed"[\s\S]*?setSetupSaveStatus\("avatar-failed"\)/,
  );
  assert.match(
    setup,
    /accessibilityRole="alert"[\s\S]*?Care saved; twin update needs attention/,
  );
  assert.match(
    setup,
    /accessibilityLabel="Retry care twin update"[\s\S]*?retrySetupAvatarSave/,
  );
  assert.match(
    setup,
    /accessibilityState=\{\{[\s\S]*?busy: setupSaveStatus === "saving"/,
  );
  assert.match(
    setup,
    /careScopeRevision[\s\S]*?setupSaveCoordinator\.invalidate\(\)[\s\S]*?setSetupSaveStatus\("idle"\)/,
  );
  assert.match(
    setup,
    /const setField = \([^)]*\) => \{\s*if \(!setupHydrated\) return;\s*if \(setupSaveLocked\) return;/,
  );
  assert.match(
    setup,
    /accessibilityLabel="Match twin to breed on save"[\s\S]*?if \(setupSaveLocked\) return;/,
  );
});

test("Setup reserves the exact Avatar config revision and preserves a newer Studio write", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );
  const persistStart = setup.indexOf("const persistSetup = async () =>");
  const persistEnd = setup.indexOf("\n  const saveSetup = () =>", persistStart);
  const persist = setup.slice(persistStart, persistEnd);

  assert.ok(persistStart > 0 && persistEnd > persistStart);
  assert.match(
    setup,
    /avatarConfigWritePending,[\s\S]*?getAvatarConfigWriteState,[\s\S]*?saveAvatarConfigIfCurrent,[\s\S]*?useAvatar\(\)/,
  );
  assert.match(
    setup,
    /setupSaveLocked =[\s\S]*?avatarConfigWritePending/,
    "all draft controls must seal while another Avatar config write owns the boundary",
  );
  assert.match(
    persist,
    /const avatarWriteStateAtSave = getAvatarConfigWriteState\(\);\s*if \(avatarWriteStateAtSave\.pending\) return;\s*let expectedAvatarConfigRevision = avatarWriteStateAtSave\.revision;/,
  );
  assert.match(
    persist,
    /await saveAvatarConfigIfCurrent\([\s\S]*?expectedAvatarConfigRevision[\s\S]*?expectedAvatarConfigRevision = result\.revision;[\s\S]*?return result\.status === "saved";/,
    "a failed write may retry its own revision, but a later Studio revision must return stale",
  );
  assert.match(
    persist,
    /outcome\.status === "avatar-stale"[\s\S]*?Your newer care twin update was kept/,
    "Care success copy must never claim that a stale Setup twin snapshot won",
  );
});

test("Setup exposes a retryable care durability failure without attempting the twin", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );

  assert.match(setup, /type SetupSaveStatus =\s*[^;]*"care-failed"/);
  assert.match(setup, /updateCareDocDurably/);
  assert.match(
    setup,
    /saveCare: async \(\) => \{[\s\S]*?return await updateCareDocDurably\(\(doc\) =>/,
  );
  assert.match(
    setup,
    /outcome\.status === "care-rejected"[\s\S]*?sourceChangedDuringSaveRef\.current[\s\S]*?"care-failed"/,
  );
  assert.match(
    setup,
    /accessibilityRole="alert"[\s\S]*?Care foundation wasn't saved/,
  );
  assert.match(
    setup,
    /accessibilityLabel="Retry saving care foundation"[\s\S]*?void persistSetup\(\)/,
  );
  assert.match(
    setup,
    /const persistSetup = async \(\) => \{\s*if \(retireStaleSetupSave\(\)\) return;[\s\S]*?setupSaveHandlingRef\.current \|\|/,
  );
  const persistStart = setup.indexOf("const persistSetup = async () =>");
  const persistEnd = setup.indexOf("\n  const saveSetup = () =>", persistStart);
  assert.doesNotMatch(
    setup.slice(persistStart, persistEnd),
    /setupSaveStatus === "care-failed"/,
    "the visible Care retry must be admitted through persistSetup",
  );
});

test("Setup lets only the current save token publish an awaited save or retry result", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );
  const persistStart = setup.indexOf("const persistSetup = async () =>");
  const persistEnd = setup.indexOf("\n  const saveSetup = () =>", persistStart);
  const retryStart = setup.indexOf("const retrySetupAvatarSave = async () =>");
  const retryEnd = setup.indexOf("\n  const meetDog = () =>", retryStart);
  assert.ok(persistStart > 0 && persistEnd > persistStart);
  assert.ok(retryStart > 0 && retryEnd > retryStart);

  for (const [name, awaitMarker, handler] of [
    [
      "save",
      "const outcome = await setupSaveCoordinator.save({",
      setup.slice(persistStart, persistEnd),
    ],
    [
      "retry",
      "const outcome = await setupSaveCoordinator.retryAvatar();",
      setup.slice(retryStart, retryEnd),
    ],
  ] as const) {
    const awaitStart = handler.indexOf(awaitMarker);
    const completionGuard = handler.indexOf(
      "if (setupSaveHandlingRef.current !== saveToken) return;",
      awaitStart,
    );
    const firstOutcomeBranch = handler.indexOf("outcome.status", awaitStart);
    assert.ok(
      awaitStart >= 0 &&
        completionGuard > awaitStart &&
        firstOutcomeBranch > completionGuard,
      `the ${name} result must be rejected before it can publish UI for replacement work`,
    );
    assert.match(
      handler,
      /} catch \{\s*if \(setupSaveHandlingRef\.current !== saveToken\) return;\s*setSetupSaveStatus/,
      `the ${name} rejection must not replace status owned by a newer operation`,
    );
  }
});

test("Setup success sheet keeps backdrop and wrapper out of iOS accessibility grouping", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );
  const modalStart = setup.indexOf("visible={successMoment !== null}");
  assert.notEqual(modalStart, -1);
  const modal = setup.slice(modalStart, setup.indexOf("</Modal>", modalStart));

  assert.match(
    modal,
    /<Pressable\s+accessible=\{false\}[\s\S]*?style=\{s\.sheetBackdrop\}/,
  );
  assert.match(
    modal,
    /<Pressable\s+accessible=\{false\}\s+accessibilityViewIsModal[\s\S]*?event\.stopPropagation\(\)/,
  );
  assert.match(
    modal,
    /accessibilityLabel=\{`Meet \$\{successMoment\?\.dogName/,
  );
  assert.match(modal, /accessibilityLabel="Review plan"/);
});

test("Setup handles a rejected hydration-retry haptic without an unhandled promise", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );
  const retryStart = setup.indexOf("const retrySetupHydration = () =>");
  const retryEnd = setup.indexOf("\n  };", retryStart);
  assert.ok(retryStart > 0 && retryEnd > retryStart);
  assert.match(
    setup.slice(retryStart, retryEnd),
    /void Haptics\.selectionAsync\(\)\.catch\(\(\) => \{\}\)/,
  );

  for (const handler of [
    "meetDog",
    "reviewPlan",
    "finishLater",
    "openAuthSetupProofMission",
  ]) {
    const handlerStart = setup.indexOf(`const ${handler} = () =>`);
    const handlerEnd = setup.indexOf("\n  };", handlerStart);
    assert.ok(handlerStart > 0 && handlerEnd > handlerStart);
    assert.match(
      setup.slice(handlerStart, handlerEnd),
      /void Haptics\.selectionAsync\(\)\.catch\(\(\) => \{\}\)/,
      `${handler} must absorb an unavailable iOS haptics service`,
    );
  }
});

test("Setup cannot abandon an in-flight staged save through secondary navigation", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );

  for (const handler of ["finishLater", "openAuthSetupProofMission"] as const) {
    const handlerStart = setup.indexOf(`const ${handler} = () =>`);
    const handlerEnd = setup.indexOf("\n  };", handlerStart);
    assert.ok(handlerStart > 0 && handlerEnd > handlerStart);
    assert.match(
      setup.slice(handlerStart, handlerEnd),
      /if \(setupSaveStatus === "saving"\) return;/,
      `${handler} must not unmount Setup during its staged durable write`,
    );
  }

  for (const label of [
    "Finish setup later",
    "Open auth and setup proof mission",
  ] as const) {
    const controlStart = setup.indexOf(`accessibilityLabel="${label}"`);
    const controlEnd = setup.indexOf("</Pressable>", controlStart);
    assert.ok(controlStart > 0 && controlEnd > controlStart);
    const control = setup.slice(controlStart, controlEnd);
    assert.match(control, /disabled=\{setupSaveStatus === "saving"\}/);
    assert.match(
      control,
      /accessibilityState=\{\{ disabled: setupSaveStatus === "saving" \}\}/,
    );
  }
});

test("Setup makes every form control truthfully unavailable while a save snapshot is locked", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );
  const fieldCalls = setup.match(/<Field\b/g) ?? [];
  const lockedFieldCalls =
    setup.match(
      /<Field\b(?:(?!<Field)[\s\S])*?editable=\{!setupSaveLocked\}/g,
    ) ?? [];
  assert.equal(lockedFieldCalls.length, fieldCalls.length);
  assert.match(
    setup,
    /<TextInput[\s\S]*?accessibilityState=\{\{ disabled: !editable \}\}[\s\S]*?editable=\{editable\}/,
  );

  for (const marker of ["ROUTINE_TYPES.map", "HOUSEHOLD_MODES.map"] as const) {
    const start = setup.indexOf(marker);
    const end = setup.indexOf("</Pressable>", start);
    assert.ok(start > 0 && end > start);
    const control = setup.slice(start, end);
    assert.match(control, /disabled=\{setupSaveLocked\}/);
    assert.match(
      control,
      /accessibilityState=\{\{[\s\S]*?disabled: setupSaveLocked/,
    );
    assert.match(control, /if \(setupSaveLocked\) return;/);
    assert.match(
      control,
      /void Haptics\.selectionAsync\(\)\.catch\(\(\) => \{\}\)/,
    );
  }
});

test("Setup binds and fences saves to the exact active pet as well as the Care revision", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );

  assert.match(
    setup,
    /const activePetId = normalizeSetupActivePetId\(state\.activePetId\)/,
  );
  assert.match(
    setup,
    /draftReadiness\.boundActivePetId === activePetId/,
    "a dirty draft may only survive updates for the same active pet",
  );
  assert.match(
    setup,
    /type: "draft-bound",[\s\S]*?careScopeRevision,[\s\S]*?activePetId/,
    "a newly hydrated draft must record the exact active pet it came from",
  );
  assert.match(
    setup,
    /isSetupInteractive\(\{[\s\S]*?careScopeRevision,[\s\S]*?activePetId,[\s\S]*?draftReadiness/,
  );
  assert.match(
    setup,
    /const setupSaveScopeRef = useRef\(\{[\s\S]*?careScopeRevision,[\s\S]*?activePetId,[\s\S]*?careSourceFingerprint,[\s\S]*?\}\)/,
  );
  assert.match(
    setup,
    /const activePetChanged =[\s\S]*?setupSaveScopeRef\.current\.activePetId !== activePetId;[\s\S]*?setupSaveCoordinator\.invalidate\(\)/,
    "a pet switch must synchronously retire any pending Care-to-Avatar transaction",
  );
  assert.match(
    setup,
    /const success: SetupSuccessMoment = \{\s*careScopeRevision,\s*activePetId,/,
    "save and retry outcomes must retain the exact pet identity captured at tap time",
  );
  assert.match(
    setup,
    /isSetupSaveFenceCurrent\(\{\s*acceptedCareDocumentFingerprint:[\s\S]*?captured: outcome\.success,[\s\S]*?current: currentSetupScopeRef\.current/,
    "a completion for another active pet must never publish success or partial-save UI",
  );
});

test("Setup rebases same-pet Care updates and fences every staged outcome to the accepted fingerprint", () => {
  const setup = readFileSync(
    join(process.cwd(), "artifacts", "woofwatcher-mobile", "app", "setup.tsx"),
    "utf8",
  );

  assert.match(setup, /createSetupCareSourceFingerprint/);
  assert.match(setup, /createSetupCareDocumentFingerprint/);
  assert.match(setup, /rebaseSetupDraft/);
  assert.match(setup, /setupDraftDirtyFieldsRef/);
  assert.match(setup, /careSourceFingerprint/);
  assert.match(
    setup,
    /const setupSaveScopeRef = useRef\(\{[\s\S]*?careSourceFingerprint[\s\S]*?\}\)/,
  );
  assert.match(
    setup,
    /isCurrent: \(\) =>\s*isSetupSaveFenceCurrent\(\{\s*acceptedCareDocumentFingerprint,\s*captured: capturedSaveFence,\s*current: currentSetupScopeRef\.current/,
    "the staged transaction must use the semantic Care fence before and after provider acknowledgement",
  );
  assert.match(
    setup,
    /acceptedCareDocumentFingerprintRef\.current ===\s*careDocumentFingerprint/,
    "an exact provider echo may advance source version without cancelling accepted work",
  );
  assert.match(
    setup,
    /acceptedCareDocumentFingerprint:\s*outcome\.success\.careDocumentFingerprint,[\s\S]*?captured: outcome\.success,[\s\S]*?current: currentSetupScopeRef\.current/,
  );
  assert.match(setup, /Shared care changed while you were editing/);
  assert.match(setup, /accessibilityLabel="Keep my reviewed setup edits"/);
  assert.match(setup, /accessibilityLabel="Use latest shared care values"/);
});
