import { spawn } from "node:child_process";
import { join } from "node:path";

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  return argv[index + 1];
}

export function resolvePreviewRuntime(argv, env) {
  const host = optionValue(argv, "--host") || env.HOST || "0.0.0.0";
  const rawPort = optionValue(argv, "--port") || env.PORT || "4194";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid preview port: ${rawPort}`);
  }

  return { host, port };
}

export function resolvePreviewBuildCommand({
  platform = process.platform,
} = {}) {
  return {
    command: platform === "win32" ? "corepack.cmd" : "corepack",
    args: [
      "pnpm",
      "--filter",
      "@workspace/woofwatcher-mobile",
      "run",
      "smoke:web",
    ],
  };
}

export function resolvePreviewServerCommand({
  repoRoot,
  execPath,
  runtime,
  env,
}) {
  return {
    command: execPath,
    args: [
      join(
        repoRoot,
        "artifacts",
        "woofwatcher-mobile",
        "scripts",
        "serve-smoke-preview.js",
      ),
    ],
    env: {
      ...env,
      HOST: runtime.host,
      PORT: String(runtime.port),
    },
  };
}

export function startPreviewServer({
  command,
  args,
  cwd,
  env,
  processRef = process,
  spawnImpl = spawn,
}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env,
      stdio: "inherit",
    });
    const signals = ["SIGINT", "SIGTERM"];
    const forwardSignal = (signal) => child.kill(signal);
    const signalHandlers = new Map(
      signals.map((signal) => [signal, () => forwardSignal(signal)]),
    );
    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        processRef.removeListener(signal, handler);
      }
    };

    for (const [signal, handler] of signalHandlers) {
      processRef.once(signal, handler);
    }
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}
