export function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

export function waitForChildOrInterrupt(child, interruptPromise) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({
      interrupted: false,
      code: child.exitCode,
      signal: child.signalCode,
    });
  }
  return Promise.race([
    new Promise((resolve) => {
      child.once("exit", (code, signal) =>
        resolve({ interrupted: false, code, signal }),
      );
    }),
    interruptPromise.then((signal) => ({ interrupted: true, signal })),
  ]);
}

function usesProcessGroup(child, options) {
  return (
    options.processGroup &&
    process.platform !== "win32" &&
    Number.isInteger(child.pid)
  );
}

function signalChild(child, signal, options) {
  if (usesProcessGroup(child, options)) {
    try {
      (options.killProcess ?? process.kill)(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code === "ESRCH") return;
      // Preserve the direct-child fallback if group signaling is unavailable.
    }
  }
  child.kill(signal);
}

function isProcessGroupAlive(child, options) {
  try {
    (options.killProcess ?? process.kill)(-child.pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

async function waitForProcessGroupExit(child, options, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessGroupAlive(child, options)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(25, remainingMs)),
    );
  }
  return true;
}

export async function terminateChild(child, options = {}) {
  if (!child) return;
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (usesProcessGroup(child, options)) {
    if (!isProcessGroupAlive(child, options)) return;
    signalChild(child, "SIGTERM", options);
    if (await waitForProcessGroupExit(child, options, timeoutMs)) return;
    signalChild(child, "SIGKILL", options);
    await waitForProcessGroupExit(child, options, timeoutMs);
    return;
  }
  if (child.exitCode !== null || child.signalCode !== null) return;
  signalChild(child, "SIGTERM", options);
  if (await waitForChildExit(child, timeoutMs)) return;
  signalChild(child, "SIGKILL", options);
  await waitForChildExit(child, timeoutMs);
}
