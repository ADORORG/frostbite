// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { drawNursery } from "../src/bonus/nursery-draw.ts";
import { startNursery } from "../src/bonus/nursery.ts";
import { guideFor, guides, instructions } from "../src/guide.ts";
import { buttonsIn, element } from "../src/page/elements.ts";
import { byInput, touchFirst } from "../src/page/input.ts";
import { startRun, type PlayRun } from "../src/page/runs.ts";
import { attachTouchPanel } from "../src/page/touch-panel.ts";
import { createView } from "../src/page/view.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { emptyPack, startPowers } from "../src/rules/kit.ts";
import { drawHills } from "../src/screen/hills-draw.ts";
import { packWords } from "../src/screen/pack-hud.ts";
import { surface } from "./support/canvas.ts";
import { drawnWith } from "./support/drawn.ts";
import { outside } from "./support/woods-outside.ts";

// The page on a touch screen: the words for thumbs, the buttons each place offers, and the two small menus.
vi.mock("../src/three/stage.ts", () => ({ createDepthView: () => null }));

const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
beforeEach(() => {
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A browser whose main pointer is a finger (or a mouse).
const pointer = (coarse: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: coarse && query === "(pointer: coarse)",
    })),
  );

describe("the words for the way the player plays", () => {
  it("are a keyboard's where the browser cannot tell, and a finger's where its main pointer is one", () => {
    expect(touchFirst()).toBe(false);
    expect(byInput("keys", "thumbs")).toBe("keys");
    expect(guideFor("hills")).toBe(guides.hills);
    expect(instructions("woods")).toContain("E and Q fly");
    pointer(false);
    expect(byInput("keys", "thumbs")).toBe("keys");
    pointer(true);
    expect(touchFirst()).toBe(true);
    expect(byInput("keys", "thumbs")).toBe("thumbs");
    expect(guideFor("hills")).toEqual({
      lines: guides.hills.touchLines,
      start: "TAP TO PRACTISE LEVEL 1",
      title: "EGG HILLS",
    });
    expect(instructions("woods")).toBe(
      "Left thumb walks; right thumb uses and fires; outside, the buttons fly.",
    );
    expect(instructions("quest")).toBe(
      "Three levels on one clock: your hearts and your backpack carry on.",
    );
  });

  it("put the tap on the first screen of a touch screen", () => {
    pointer(true);
    const screen = surface();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      screen.context,
    );
    createView().draw(startRun("castle", 4), true, 0, 0);
    expect(screen.texts()).toContain("TAP TO PRACTISE LEVEL 2");
    expect(screen.texts()).toContain(
      "LEFT THUMB: WALK   RIGHT THUMB: TALK AND FIRE",
    );
    expect(screen.texts()).not.toContain("ENTER TO PRACTISE LEVEL 2");
  });
});

describe("the screen's own hints", () => {
  it("name the Bag and the thumbs instead of keys on a touch screen", () => {
    const berry = {
      ...startPowers({ big: false, pack: { ...emptyPack, berry: 1 } }),
      news: { item: "berry" as const, tick: 0, what: "packed" as const },
    };
    const fiery = { ...startHills(3), hasFire: true, stage: 3, tick: 400 };
    expect(packWords(berry, 1)?.text).toBe("A BERRY! B FOR LONGER FIRE");
    expect(drawnWith(drawHills, fiery).texts()).toContain("FIRE: F OR X");
    pointer(true);
    expect(packWords(berry, 1)?.text).toBe("A BERRY IN THE BAG: LONGER FIRE");
    expect(drawnWith(drawHills, fiery).texts()).toContain("FIRE: RIGHT THUMB");
    expect(drawnWith(drawNursery, startNursery(5)).texts()).toContain(
      "RIGHT THUMB: DANCE, PAINT   INK, CLEAR   RAINBOW: OUT",
    );
  });
});

describe("the touch buttons over the screen", () => {
  const offered = () =>
    buttonsIn(document, "#touch button[data-for]")
      .filter((button) => !button.hidden)
      .map((button) => button.dataset.hold ?? button.id);

  it("offer flying, frost vision and Sparky only out of the woods' maze, and the Bag wherever there is a backpack", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const view = createView();
    const woods = startRun("woods", 4);
    const out: PlayRun = { ...woods, depth: () => outside() };
    view.level("woods");
    view.draw(woods, false, 0, 0);
    expect(offered()).toEqual(["bag"]);
    view.draw(out, false, 0, 0);
    expect(offered()).toEqual(["evade", "quick", "vision", "help", "bag"]);
    view.level("hills");
    expect(offered()).toEqual(["bag"]);
    view.level("woods");
    expect(offered()).toEqual(["evade", "quick", "vision", "help", "bag"]);
    view.draw(woods, false, 0, 0);
    expect(offered()).toEqual(["bag"]);
  });

  it("say a tap plays again once a run is over, and not before a run or during one", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const view = createView();
    const again = element("thumb-again", "span");
    const run = startRun("hills", 4);
    view.draw(run, true, 0, 0);
    expect(again.hidden).toBe(true);
    view.running(true);
    view.draw(run, false, 0, 0);
    expect(again.hidden).toBe(true);
    view.running(false);
    view.draw(run, false, 0, 0);
    expect(again.hidden).toBe(false);
    view.draw(run, true, 0, 0);
    expect(again.hidden).toBe(true);
  });
});

describe("the levels and Bag menus", () => {
  const click = (target: Element | null) =>
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  it("open the chapters over the screen until one is chosen, and close at a run's start", () => {
    const main = element("main", "main");
    const panel = attachTouchPanel(main);
    const menu = element("menu", "button");
    expect(panel.menuOpen()).toBe(false);
    click(menu);
    expect(panel.menuOpen()).toBe(true);
    expect(main.dataset.menu).toBe("open");
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    click(element("chapters", "nav"));
    expect(panel.menuOpen()).toBe(true);
    click(document.querySelector('[data-chapter="hills"] span'));
    expect(panel.menuOpen()).toBe(false);
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    click(menu);
    click(menu);
    expect(panel.menuOpen()).toBe(false);
    click(menu);
    panel.closeMenu();
    expect(panel.menuOpen()).toBe(false);
  });

  it("open the backpack's three foods, and close them once one is used", () => {
    attachTouchPanel(element("main", "main"));
    const bag = element("bag", "button");
    const foods = element("bag-items", "div");
    expect(foods.hidden).toBe(true);
    click(bag);
    expect(foods.hidden).toBe(false);
    expect(bag.getAttribute("aria-expanded")).toBe("true");
    expect(
      buttonsIn(foods, "button").map((button) => button.dataset.hold),
    ).toEqual(["berry", "mushroom", "pineapple"]);
    click(foods.querySelector('[data-hold="mushroom"]'));
    expect(foods.hidden).toBe(true);
    expect(bag.getAttribute("aria-expanded")).toBe("false");
    click(bag);
    click(bag);
    expect(foods.hidden).toBe(true);
  });
});
