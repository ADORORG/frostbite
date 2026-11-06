// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { drawNursery } from "../src/bonus/nursery-draw.ts";
import { startNursery } from "../src/bonus/nursery.ts";
import { guides, instructions } from "../src/guide.ts";
import { buttonsIn, element } from "../src/page/elements.ts";
import { startRun, type PlayRun } from "../src/page/runs.ts";
import { attachTab } from "../src/page/tab.ts";
import { createView } from "../src/page/view.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { emptyPack, startPowers } from "../src/rules/kit.ts";
import { drawHills } from "../src/screen/hills-draw.ts";
import { packWords } from "../src/screen/pack-hud.ts";
import { surface } from "./support/canvas.ts";
import { drawnWith } from "./support/drawn.ts";
import { outside } from "./support/woods-outside.ts";

// The page on a touch screen: the words for thumbs, the first screen's card, the tab (Levels and the Bag) and the buttons of a place.
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

// The game's screen and the card's own layer, each drawn on a surface of its own.
function surfaces() {
  const screen = surface();
  const card = surface();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      return this.id === "screen" ? screen.context : card.context;
    },
  );
  return { card, screen };
}

describe("the words for the way the player plays", () => {
  it("are a keyboard's where the browser cannot tell, and a finger's where its main pointer is one", () => {
    expect(instructions("woods")).toContain("E and Q fly");
    pointer(false);
    expect(instructions("woods")).toContain("E and Q fly");
    pointer(true);
    expect(instructions("woods")).toBe(
      "Left thumb walks; right thumb uses and fires; outside, the buttons fly.",
    );
    expect(instructions("quest")).toBe(
      "Three levels on one clock: your hearts and your backpack carry on.",
    );
    // Each first screen has its touch lines and its own touch start; the SDK says them on a touch screen.
    for (const guide of Object.values(guides)) {
      expect(guide.touchLines).toHaveLength(guide.lines.length);
      expect(guide.touchStart).toMatch(/^TAP TO /u);
    }
  });

  it("put the tap on the first screen of a touch screen, sharp on a layer of its own", () => {
    pointer(true);
    const { card, screen } = surfaces();
    createView().draw(startRun("castle", 4), true, 0, 0);
    expect(card.texts()).toContain("TAP TO PRACTISE LEVEL 2");
    expect(card.texts()).toContain(
      "LEFT THUMB: WALK   RIGHT THUMB: TALK AND FIRE",
    );
    expect(card.texts()).not.toContain("ENTER TO PRACTISE LEVEL 2");
    expect(screen.texts()).not.toContain("TAP TO PRACTISE LEVEL 2");
  });

  it("put Enter on the first screen of a keyboard", () => {
    pointer(false);
    const { card } = surfaces();
    createView().draw(startRun("castle", 4), true, 0, 0);
    expect(card.texts()).toContain("ENTER TO PRACTISE LEVEL 2");
    expect(card.texts()).toContain(guides.castle.lines[0]);
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

describe("the tab and the buttons of a place", () => {
  const offered = () =>
    ["menu", "bag"].filter((id) => !element(id, "button").hidden);
  const corner = () =>
    buttonsIn(document, ".touch-buttons button").map(
      (button) => button.textContent,
    );

  it("offer Levels between runs, and the Bag during one wherever there is a backpack", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const view = createView();
    const main = element("main", "main");
    view.level("hills");
    view.running(false);
    expect(offered()).toEqual(["menu"]);
    expect(main.dataset.running).toBe("false");
    view.running(true);
    expect(offered()).toEqual(["bag"]);
    expect(element("menu", "button").disabled).toBe(true);
    expect(element("bag", "button").disabled).toBe(false);
    expect(main.dataset.running).toBe("true");
    view.level("nursery");
    expect(offered()).toEqual([]);
    view.level("castle");
    expect(offered()).toEqual(["bag"]);
    element("bag", "button").click();
    expect(element("bag-items", "div").hidden).toBe(false);
    view.running(false);
    expect(offered()).toEqual(["menu"]);
    expect(element("bag-items", "div").hidden).toBe(true);
    expect(element("bag", "button").disabled).toBe(true);
  });

  it("put flying, frost vision and Sparky in the corner only out of the woods' maze during a run, and ink and a clean sky in the Sky Nursery", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const hold = vi.fn();
    const view = createView({ hold });
    const woods = startRun("woods", 4);
    const out: PlayRun = { ...woods, depth: () => outside() };
    view.level("woods");
    view.draw(out, false, 0, 0);
    expect(corner()).toEqual([]);
    view.running(true);
    expect(corner()).toEqual(["Fly up", "Fly down", "Vision", "Sparky"]);
    // A keyboard (or a screen reader) presses a focused one: a press and a let-go.
    buttonsIn(document, ".touch-buttons button")[2]?.click();
    expect(hold.mock.calls).toEqual([
      ["vision", true],
      ["vision", false],
    ]);
    // A finger on one holds it while the screen is drawn again and the place is asked for again, and lets go as it lifts (jsdom has no
    // pointer capture).
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: () => undefined,
    });
    const fly = buttonsIn(document, ".touch-buttons button")[0];
    fly?.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 5 }));
    view.draw(out, false, 0, 0);
    view.level("woods");
    expect(hold).toHaveBeenLastCalledWith("evade", true);
    expect(document.querySelectorAll(".touch-buttons")).toHaveLength(1);
    fly?.dispatchEvent(new PointerEvent("pointerup", { pointerId: 5 }));
    expect(hold).toHaveBeenLastCalledWith("evade", false);
    Reflect.deleteProperty(HTMLElement.prototype, "setPointerCapture");
    view.draw(woods, false, 0, 0);
    expect(corner()).toEqual([]);
    view.level("nursery");
    expect(corner()).toEqual(["Ink", "Clear"]);
    buttonsIn(document, ".touch-buttons button")[1]?.click();
    expect(hold).toHaveBeenLastCalledWith("charm", false);
    view.running(false);
    expect(corner()).toEqual([]);
  });
});

describe("the Levels and Bag menus", () => {
  const click = (target: Element | null) =>
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  it("open the chapters over the screen until one is chosen or the sheet beside them is tapped, and close at a run's start", () => {
    const main = element("main", "main");
    const tab = attachTab(main);
    const menu = element("menu", "button");
    const picker = element("chapters", "nav");
    expect(tab.menuOpen()).toBe(false);
    click(menu);
    expect(tab.menuOpen()).toBe(true);
    expect(main.dataset.menu).toBe("open");
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    click(document.getElementById("earned"));
    expect(tab.menuOpen()).toBe(true);
    click(document.querySelector('[data-chapter="hills"] span'));
    expect(tab.menuOpen()).toBe(false);
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    click(menu);
    click(picker);
    expect(tab.menuOpen()).toBe(false);
    click(menu);
    click(element("share", "button"));
    expect(tab.menuOpen()).toBe(false);
    click(menu);
    click(menu);
    expect(tab.menuOpen()).toBe(false);
    click(menu);
    tab.offer(true, true);
    expect(tab.menuOpen()).toBe(false);
    tab.offer(false, true);
    click(menu);
    tab.closeMenu();
    expect(tab.menuOpen()).toBe(false);
  });

  it("open the backpack's three foods, and close them once one is used", () => {
    attachTab(element("main", "main")).offer(true, true);
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
