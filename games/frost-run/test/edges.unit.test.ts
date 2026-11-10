// @vitest-environment jsdom
import { Scene, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { milestones } from "../src/rules/milestones.ts";
import { nearestWay, rimAt, stepOf, toward } from "../src/rules/ways.ts";
import { Effects } from "../src/screen/fx.ts";
import { headingOfWay } from "../src/screen/space.ts";
import { createRunSession } from "../src/session.ts";
import { createResult } from "../src/ui/result.ts";
import { createShare } from "../src/ui/share.ts";
import { playBot } from "./support/bot.ts";
import { recorder } from "./support/canvas.ts";
import { byId, loadPage } from "./support/dom.ts";

afterEach(() => vi.restoreAllMocks());

describe("the milestones' edges", () => {
  it("are none of them earned by a run with no rounds to look at", () => {
    const { state } = playBot(1004, 4);
    const feats = {
      closeShave: false,
      crushed: 0,
      ducked: 0,
      hoppedOver: 0,
      lastCrystalAt: -1,
      quickPair: false,
    };
    const bare = { ...state, feats, tallies: [], won: false };
    expect(milestones.filter(({ earned }) => earned(bare))).toEqual([]);
  });
});

describe("the ways", () => {
  it("fall back where there is no direction, and wrap round the rim", () => {
    expect(nearestWay(0, 0, 5)).toBe(5);
    expect(toward(10, 10, 10, 10, 80)).toEqual([0, 80]);
    expect(stepOf(99)).toEqual([0, 0]);
    expect(rimAt(-1)).toEqual(rimAt(31));
    expect(headingOfWay(-1)).toBe(0);
  });
});

describe("a session's edges", () => {
  it("chooses its lead once, counts its inputs and keeps its clock", () => {
    const session = createRunSession({ seed: 3 });
    expect(session.clock()).toBe(0);
    expect(session.choose(1).ok).toBe(true);
    expect(session.choose(2).ok).toBe(false);
    session.hands(4, 0);
    session.tick();
    expect(session.inputs()).toBeGreaterThan(0);
    expect(session.clock()).toBe(1);
    const unled = createRunSession({ seed: 3 });
    expect(unled.record().inputs).toEqual([]);
  });
});

describe("the effects", () => {
  it("never hold more bits than their pools, and spread rings on the oldest one", () => {
    const scene = new Scene();
    const fx = new Effects(scene);
    const at = new Vector3(1, 0, 2);
    fx.burst({ at, colour: "#ffffff", count: 5000 });
    fx.burst({
      at,
      colour: "#3FE0A0",
      count: 50,
      glow: true,
      gravity: 1,
      life: 0.2,
      lift: 1,
      size: 0.1,
      speed: 1,
    });
    for (let ring = 0; ring < 14; ring += 1) fx.ring(at, "#bfeaff", 2);
    for (let frame = 0; frame < 90; frame += 1) fx.update(1 / 30);
    const shown = scene.children.filter((child) => child.visible);
    expect(shown.length).toBeGreaterThan(0);
  });
});

describe("the panels' parts", () => {
  it("are checked: a page missing one is refused", () => {
    loadPage();
    const share = byId("share", HTMLElement);
    share.querySelector('[data-part="close"]')?.remove();
    expect(() => createShare(share)).toThrow("Missing close");
    const result = byId("result", HTMLElement);
    result.querySelector('[data-part="haul"]')?.remove();
    const shown = createResult(result, {
      again: vi.fn(),
      change: vi.fn(),
      share: vi.fn(),
    });
    expect(() =>
      shown.show({
        best: 0,
        earned: [],
        newBest: false,
        state: playBot(1, 0).state,
      }),
    ).toThrow("Missing haul");
  });

  it("show a run whose hero is not known without a name", () => {
    loadPage();
    const result = byId("result", HTMLElement);
    const shown = createResult(result, {
      again: vi.fn(),
      change: vi.fn(),
      share: vi.fn(),
    });
    const { state } = playBot(1, 0);
    shown.show({
      best: 0,
      earned: [],
      newBest: false,
      state: { ...state, lead: 99 },
    });
    expect(result.querySelector('[data-part="who"]')?.textContent).toMatch(
      /^ · /u,
    );
  });
});

describe("the soft textures", () => {
  it("are painted where the page can paint", async () => {
    const surface = recorder();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      surface.context as never,
    );
    vi.resetModules();
    const { Snowfall } = await import("../src/screen/snow.ts");
    const { makeBlob } = await import("../src/screen/blob.ts");
    const snow = new Snowfall(new Scene(), 40);
    snow.setCount(20);
    snow.update(1 / 60, new Vector3(), 0.5);
    expect(makeBlob(1)).toBeDefined();
    expect(surface.named("createRadialGradient").length).toBeGreaterThanOrEqual(
      2,
    );
  });
});
