import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { stepOf } from "../src/rules/moment.ts";
import type { PlayState } from "../src/rules/types.ts";
import { timelineOf } from "./support/timeline.ts";

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

const { createDepthView, focusOf, intentOf } =
  await import("../src/view/view.ts");
const { farewell, flight, flownFrom } = await import("../src/view/farewell.ts");

class FakeContext {}
const canvasWith = (context: unknown, width = 0, height = 0) =>
  ({
    clientHeight: height,
    clientWidth: width,
    getContext: () => context,
  }) as unknown as HTMLCanvasElement;

let timeline: PlayState[] = [];
beforeAll(() => {
  timeline = timelineOf("zora", 45);
});

afterEach(() => {
  vi.unstubAllGlobals();
  made.fail = false;
  made.renders = 0;
  made.sizes = [];
});

describe("the three-dimensional view", () => {
  it("is not made where the browser has no WebGL 2, or it cannot be had", () => {
    expect(createDepthView(canvasWith(new FakeContext()), 1)).toBeNull();
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    expect(createDepthView(canvasWith(null), 1)).toBeNull();
    made.fail = true;
    expect(createDepthView(canvasWith(new FakeContext()), 1)).toBeNull();
  });

  it("shows a whole run: the line-up, every kind of moment, the finale and the lit tree, filling its box", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    let clock = 0;
    const view = createDepthView(canvasWith(new FakeContext()), 2, () => clock);
    if (view === null) throw new Error("the view was not made");
    const intents = new Set<string>();
    const steps = new Set<string>();
    let previous = timeline[0];
    for (const state of timeline) {
      clock += 40;
      intents.add(intentOf(state));
      steps.add(stepOf(state)?.kind ?? "none");
      view.show({
        alpha: 0.5,
        previous: previous ?? state,
        select: "heerah",
        state,
      });
      previous = state;
    }
    expect([...intents].sort()).toEqual(
      [
        "breath",
        "dance",
        "finale",
        "follow",
        "group",
        "hands",
        "lean",
        "select",
        "talk",
        "vision",
      ].sort(),
    );
    expect([...steps].sort()).toEqual(
      ["beat", "breath", "centre", "choose", "huddle", "lean", "none"].sort(),
    );
    expect(made.renders).toBe(timeline.length);
    // With no size of its own (a box not yet laid out) the picture is 640 by 360.
    expect(made.sizes).toEqual([[640, 360]]);
    const ahead = view.forward();
    expect(Math.hypot(ahead.x, ahead.z)).toBeGreaterThan(0.2);
  }, 120_000);

  it("is built lighter for a slower device, and widens its lens on a box narrower than the screen's shape", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    const light = createDepthView(canvasWith(new FakeContext(), 400, 900), 0);
    if (light === null) throw new Error("the view was not made");
    const middle = createDepthView(canvasWith(new FakeContext()), 1);
    const shown = timeline.slice(0, 40);
    for (const state of shown) {
      light.show({ alpha: 1, previous: state, select: "kai", state });
      middle?.show({ alpha: 1, previous: state, select: "ali", state });
    }
    expect(made.sizes[0]).toEqual([400, 900]);
    expect(made.renders).toBe(shown.length * 2);
  }, 60_000);

  it("plays out the two endings: the ancestors' farewell and the family's flight, and a lead gone grey taken into the coil", () => {
    vi.stubGlobal("WebGL2RenderingContext", FakeContext);
    let clock = 0;
    const view = createDepthView(canvasWith(new FakeContext()), 1, () => clock);
    if (view === null) throw new Error("the view was not made");
    const lit = timeline.at(-1);
    const before = timeline.find((each) => each.moment?.kind === "finale");
    if (lit === undefined || before === undefined) throw new Error("no finale");
    expect(lit.cause).toBe("lit");
    const lifted = farewell.liftOff;
    expect(flight({ kind: "lit", since: lifted - 0.1 })).toBe(0);
    expect(flight({ kind: "lit", since: lifted + 7 })).toBe(20);
    expect(flight({ kind: "grey", since: 15 })).toBe(0);
    // Each flies a way of their own, lifting off a moment apart: not in a huddle.
    const ways = [0, 1, 2, 3].map((order) =>
      flownFrom({ kind: "lit", since: lifted + 4 }, order, 0),
    );
    const across = ways.map((way) => way.x);
    expect(across).toEqual([...across].sort((a, b) => b - a));
    for (const [index, way] of ways.entries())
      for (const other of ways.slice(index + 1))
        expect(way.distanceTo(other)).toBeGreaterThan(1);
    expect(ways[0]?.y).toBeGreaterThan(ways[3]?.y ?? 0);
    expect(flownFrom({ kind: "lit", since: 8 }, 0, 0).length()).toBe(0);
    // In the show, the player moves Kai a little and asks for a big move now and then.
    const show = (state: PlayState, seconds: number): void => {
      for (let at = 0; at < seconds * 10; at += 1) {
        clock += 100;
        const stage = {
          at: { kai: { x: -0.6, z: 0.3 } },
          moveAt: clock - (at % 20) * 100,
          walking: at % 3 === 0,
          who: "kai",
        };
        view.show({ alpha: 1, previous: state, select: "zora", stage, state });
      }
    };
    show(before, 2);
    show(lit, farewell.end);
    const grey: PlayState = {
      ...before,
      cause: "grey",
      ended: true,
      greyed: 3,
      moment: null,
    };
    expect(intentOf(grey)).toBe("lean");
    show(grey, 7);
    expect(made.renders).toBe(20 + farewell.end * 10 + 70);
  }, 120_000);

  it("knows who or what the lead is with in a moment, for the camera", () => {
    const first = timeline[0];
    if (first === undefined) throw new Error("no timeline");
    expect(focusOf(first)).toBeNull();
    for (const kind of ["kai", "grey", "mirror", "forge", "weave", "drawer"]) {
      const state = timeline.find((each) => each.moment?.kind === kind);
      if (state === undefined) throw new Error(`no ${kind} moment`);
      expect(focusOf(state)).not.toBeNull();
    }
    const practice = timeline.find((each) => each.moment?.kind === "practice");
    expect(practice === undefined ? "none" : focusOf(practice)).toBeNull();
    expect(
      focusOf({
        ...first,
        moment: {
          arg: 99,
          exhaleUntil: -1,
          holding: -1,
          kind: "grey",
          since: 0,
          skill: -1,
          step: 0,
          target: -1,
        },
      }),
    ).toBeNull();
  });
});
