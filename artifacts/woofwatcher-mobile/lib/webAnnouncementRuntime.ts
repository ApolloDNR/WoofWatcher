export interface WebAnnouncementRegion {
  textContent: string;
}

export interface WebAnnouncementRuntimeEnvironment {
  isAvailable(): boolean;
  createRegion(): WebAnnouncementRegion;
  isAttached(region: WebAnnouncementRegion): boolean;
  attach(region: WebAnnouncementRegion): void;
  detach(region: WebAnnouncementRegion): void;
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface WebAnnouncementRuntime {
  announce(text: string): void;
  clear(): void;
}

export function createWebAnnouncementRuntime(
  environment: WebAnnouncementRuntimeEnvironment,
): WebAnnouncementRuntime {
  let generation = 0;
  let region: WebAnnouncementRegion | null = null;
  let pendingHandle: unknown;
  let hasPendingHandle = false;

  const cancelPending = (failures?: unknown[]): void => {
    if (!hasPendingHandle) return;
    const handle = pendingHandle;
    pendingHandle = undefined;
    hasPendingHandle = false;
    try {
      environment.cancel(handle);
    } catch (error) {
      failures?.push(error);
    }
  };

  const announce = (text: string): void => {
    if (!environment.isAvailable()) return;

    generation += 1;
    const announcementGeneration = generation;
    cancelPending();

    let activeRegion = region;
    if (!activeRegion || !environment.isAttached(activeRegion)) {
      activeRegion = environment.createRegion();
      environment.attach(activeRegion);
      region = activeRegion;
    }

    activeRegion.textContent = "";
    const scheduledRegion = activeRegion;
    pendingHandle = environment.schedule(() => {
      if (
        generation !== announcementGeneration ||
        region !== scheduledRegion ||
        !environment.isAttached(scheduledRegion)
      ) {
        return;
      }
      pendingHandle = undefined;
      hasPendingHandle = false;
      scheduledRegion.textContent = text;
    }, 30);
    hasPendingHandle = true;
  };

  const clear = (): void => {
    generation += 1;
    const failures: unknown[] = [];
    cancelPending(failures);

    const regionToRemove = region;
    region = null;
    if (regionToRemove) {
      try {
        regionToRemove.textContent = "";
      } catch (error) {
        failures.push(error);
      }
      try {
        environment.detach(regionToRemove);
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        "The web accessibility announcement could not be fully cleared.",
      );
    }
  };

  return Object.freeze({ announce, clear });
}

function getDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

const browserEnvironment: WebAnnouncementRuntimeEnvironment = {
  isAvailable: () => getDocument() !== null,
  createRegion: () => {
    const currentDocument = getDocument();
    if (!currentDocument) {
      throw new Error("The browser document is unavailable.");
    }
    const nextRegion = currentDocument.createElement("div");
    nextRegion.setAttribute("role", "status");
    nextRegion.setAttribute("aria-live", "polite");
    Object.assign(nextRegion.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      margin: "-1px",
      border: "0",
      padding: "0",
      overflow: "hidden",
      clip: "rect(0 0 0 0)",
      whiteSpace: "nowrap",
    });
    return nextRegion;
  },
  isAttached: (region) =>
    (region as unknown as Node).parentNode === getDocument()?.body,
  attach: (region) => {
    const currentDocument = getDocument();
    if (!currentDocument) {
      throw new Error("The browser announcement region cannot be attached.");
    }
    currentDocument.body.appendChild(region as unknown as Node);
  },
  detach: (region) => {
    const currentDocument = getDocument();
    if (!currentDocument) return;
    const node = region as unknown as Node;
    if (node.parentNode === currentDocument.body) {
      currentDocument.body.removeChild(node);
    }
  },
  schedule: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const browserRuntime = createWebAnnouncementRuntime(browserEnvironment);

export function announceOnWeb(text: string): void {
  browserRuntime.announce(text);
}

export function clearWebAnnouncements(): void {
  browserRuntime.clear();
}
