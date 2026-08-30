import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import glob from "fast-glob";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import type { Plugin } from "vite";
import {
  buildMockupManifestEntries,
  generateMockupManifestSource,
} from "./mockupManifest";

const MOCKUPS_DIR = "src/components/mockups";
const GENERATED_MODULE = "src/.generated/mockup-components.ts";

export function mockupPreviewPlugin(): Plugin {
  let root = "";
  let currentSource = "";
  let watcher: FSWatcher | null = null;

  function getMockupsAbsDir(): string {
    return path.join(root, MOCKUPS_DIR);
  }

  function getGeneratedModuleAbsPath(): string {
    return path.join(root, GENERATED_MODULE);
  }

  function isMockupFile(absolutePath: string): boolean {
    const rel = path.relative(getMockupsAbsDir(), absolutePath);
    return (
      !rel.startsWith("..") && !path.isAbsolute(rel) && rel.endsWith(".tsx")
    );
  }

  function isPreviewTarget(relativeToMockups: string): boolean {
    return relativeToMockups
      .split(path.sep)
      .every((segment) => !segment.startsWith("_"));
  }

  async function discoverComponents() {
    const files = await glob(`${MOCKUPS_DIR}/**/*.tsx`, {
      cwd: root,
      ignore: ["**/_*/**", "**/_*.tsx"],
    });

    return buildMockupManifestEntries(files);
  }

  function shouldAutoRescan(pathname: string): boolean {
    return (
      pathname.includes("/components/mockups/") ||
      pathname.includes("/.generated/mockup-components")
    );
  }

  let refreshInFlight = false;
  let refreshQueued = false;

  async function refresh(): Promise<boolean> {
    if (refreshInFlight) {
      refreshQueued = true;
      return false;
    }

    refreshInFlight = true;
    let changed = false;
    try {
      const components = await discoverComponents();
      const newSource = generateMockupManifestSource(components);
      if (newSource !== currentSource) {
        currentSource = newSource;
        const generatedModuleAbsPath = getGeneratedModuleAbsPath();
        mkdirSync(path.dirname(generatedModuleAbsPath), { recursive: true });
        writeFileSync(generatedModuleAbsPath, currentSource);
        changed = true;
      }
    } finally {
      refreshInFlight = false;
    }

    if (refreshQueued) {
      refreshQueued = false;
      const followUp = await refresh();
      return changed || followUp;
    }

    return changed;
  }

  async function onFileAddedOrRemoved(): Promise<void> {
    await refresh();
  }

  return {
    name: "mockup-preview",
    enforce: "pre",

    configResolved(config) {
      root = config.root;
    },

    async buildStart() {
      await refresh();
    },

    async configureServer(viteServer) {
      await refresh();

      const mockupsAbsDir = getMockupsAbsDir();
      mkdirSync(mockupsAbsDir, { recursive: true });

      watcher = chokidar.watch(mockupsAbsDir, {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      watcher.on("add", (file) => {
        if (
          isMockupFile(file) &&
          isPreviewTarget(path.relative(mockupsAbsDir, file))
        ) {
          void onFileAddedOrRemoved();
        }
      });

      watcher.on("unlink", (file) => {
        if (isMockupFile(file)) {
          void onFileAddedOrRemoved();
        }
      });

      viteServer.middlewares.use((req, res, next) => {
        const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
        const pathname = requestUrl.pathname;
        const originalEnd = res.end.bind(res);

        res.end = ((...args: Parameters<typeof originalEnd>) => {
          if (res.statusCode === 404 && shouldAutoRescan(pathname)) {
            void refresh();
          }
          return originalEnd(...args);
        }) as typeof res.end;

        next();
      });
    },

    async closeWatcher() {
      if (watcher) {
        await watcher.close();
      }
    },
  };
}
