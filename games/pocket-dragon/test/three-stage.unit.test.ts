import { afterEach, describe, expect, it, vi } from "vitest";

import { outside, maze } from "./support/woods-outside.ts";

// A stand-in for three's WebGL renderer (the tests have no WebGL): it notes what it is asked to do, and can be told to fail.
const made = vi.hoisted(() => ({
  fail: false,
  renders: 0,
  sizes: [] as (readonly [number, number])[],
}));

vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    outputColorSpace = "";
    shadowMap = { enabled: false, type: 0 };
    toneMapping = 0;
    toneMappingExposure = 1;
    constructor() {
      if (made.fail) throw new Error("no WebGL here");
    }
    render(): void {
      made.renders += 1;
    }
    setPixelRatio(): void {}
    setSize(width: number, height: number): void {
      made.sizes.push([width, height]);
    }
  }
  return { ...three, WebGLRenderer: FakeRenderer };
});

const { createDepthView } = await import("../src/three/stage.ts");

class FakeContext {}
const canvasWith = (context: unknown, width = 0, height = 0) =>
  ({
    clientHeight: height,
    clientWidth: width,
    getContext: () => context,
  }) as unknown as HTMLCanvasElement;

afterEach(() => {
  vi.unstubAllGlobals();
  made.fail = false;
  made.renders = 0;
  made.sizes = [];
});

describe("the three-dimensional view", () => {
  it("is not made where the browser has no WebGL 2, or it cannot be had", () => {
    expect(createDepthView(canvasWith(new FakeContext()))).toBeNull();
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    expect(createDepthView(canvasWith(null))).toBeNull();
    made.fail = true;
    expect(createDepthView(canvasWith(new FakeContext()))).toBeNull();
  });

  it("draws the woods outside the maze at the screen's shape inside its box, and nothing for the maze", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    let clock = 0;
    const view = createDepthView(canvasWith(new FakeContext()), () => clock);
    if (view === null) throw new Error("the view was not made");
    view.show(maze);
    expect(made.renders).toBe(0);
    const out = outside();
    view.show(out);
    clock = 16;
    view.show(out);
    clock = 10_000;
    view.show({ ...out, scene: { id: "rise", start: 0 }, tick: 30 });
    expect(made.renders).toBe(3);
    expect(made.sizes).toEqual([[512, 288]]);
    const tall = createDepthView(canvasWith(new FakeContext(), 400, 900));
    tall?.show(out);
    expect(made.sizes.at(-1)).toEqual([400, 225]);
  });
});
