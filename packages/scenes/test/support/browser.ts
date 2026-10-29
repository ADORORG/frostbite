import { afterEach, beforeEach, vi } from "vitest";

import { palette } from "../../src/engine/index.ts";
import { recordingSurface } from "./surface.ts";

type Recorded = ReturnType<typeof recordingSurface>;
interface Handle {
  disconnected: boolean;
  emit: (intersecting: boolean) => void;
}

// The browser as the scenes meet it, made by hand: media queries, a frame loop the test steps, canvases that record, an intersection
// observer the test controls, and a data-saver hint.
export function installBrowser() {
  const queries = new Set<() => void>();
  const state = { reducedMotion: false };
  let callback: ((milliseconds: number) => void) | null = null;
  const surfaces = new Map<HTMLCanvasElement, Recorded>();
  const observers: Handle[] = [];

  beforeEach(() => {
    state.reducedMotion = false;
    surfaces.clear();
    observers.length = 0;
    callback = null;
    localStorage.clear();
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: (_: string, listener: () => void) =>
        queries.add(listener),
      matches: state.reducedMotion,
      removeEventListener: (_: string, listener: () => void) =>
        queries.delete(listener),
    }));
    vi.stubGlobal(
      "requestAnimationFrame",
      (run: (milliseconds: number) => void) => {
        callback = run;
        return 1;
      },
    );
    vi.stubGlobal("cancelAnimationFrame", () => {
      callback = null;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        const surface = surfaces.get(this) ?? recordingSurface();
        surfaces.set(this, surface);
        return surface as unknown as CanvasRenderingContext2D;
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    Reflect.deleteProperty(navigator, "connection");
    Reflect.deleteProperty(navigator, "deviceMemory");
  });

  return {
    // A canvas's frames drawn so far: counted by the scene's first fill, which every scene draws once a frame.
    frames: (canvas: HTMLCanvasElement | null) =>
      canvas === null
        ? 0
        : (surfaces
            .get(canvas)
            ?.drawn.filter(
              ({ colour, width }) =>
                width === 160 &&
                (colour === palette.background || colour === palette.deep),
            ).length ?? 0),
    hidden: (value: boolean) =>
      Object.defineProperty(document, "hidden", { configurable: true, value }),
    observe: () => {
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          private readonly handle: Handle = {
            disconnected: false,
            emit: () => undefined,
          };
          constructor(run: (entries: { isIntersecting: boolean }[]) => void) {
            this.handle.emit = (isIntersecting) => run([{ isIntersecting }]);
            observers.push(this.handle);
          }
          observe() {}
          disconnect() {
            this.handle.disconnected = true;
          }
        },
      );
      return observers;
    },
    reducedMotion: (value: boolean) => {
      state.reducedMotion = value;
      for (const listener of [...queries]) listener();
    },
    surfaceOf: (canvas: HTMLCanvasElement | null) =>
      canvas === null ? undefined : surfaces.get(canvas),
    // Whether a frame is waiting to be drawn: the page's one loop is running.
    looping: () => callback !== null,
    tick: (milliseconds: number) => callback?.(milliseconds),
  };
}
