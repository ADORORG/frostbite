// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { leads } from "../src/rules/leads.ts";
import { FlatScreen } from "../src/screen/flat.ts";
import {
  createFirstCard,
  drawGuideCard,
  freeArea,
  goalLines,
  guide,
  heroFrame,
  planCard,
} from "../src/ui/guide-card.ts";
import { drawShareCard } from "../src/ui/share-card.ts";
import { hunter, lingering, playBot, strong } from "./support/bot.ts";
import { recorder } from "./support/canvas.ts";
import { fakeMoment, frames } from "./support/view.ts";

afterEach(() => vi.restoreAllMocks());

const box = (left: number, top: number, width: number, height: number) => ({
  height,
  left,
  top,
  width,
});

describe("the first screen's card", () => {
  it("is drawn in the room the hero select leaves: beside it on a wide screen, above it on a tall one", () => {
    const screen = box(0, 0, 1000, 560);
    expect(freeArea(screen, box(600, 10, 380, 540), 0)).toEqual({
      height: 560,
      width: 600,
      x: 0,
      y: 0,
    });
    expect(freeArea(box(0, 0, 400, 800), box(10, 420, 380, 370), 52)).toEqual({
      height: 368,
      width: 400,
      x: 0,
      y: 52,
    });
    expect(freeArea(screen, box(0, 0, 0, 0), 20)).toEqual({
      height: 540,
      width: 1000,
      x: 0,
      y: 20,
    });
  });

  it("says the game's name, its goal, the keys and how to begin, and nothing on a card after a run", () => {
    const surface = recorder();
    drawGuideCard(
      surface.context,
      { height: 560, width: 600, x: 0, y: 0 },
      guide,
    );
    expect(surface.texts()).toEqual(
      expect.arrayContaining([
        guide.title,
        ...goalLines,
        ...guide.lines,
        guide.start,
      ]),
    );
    const none = recorder();
    drawGuideCard(
      none.context,
      { height: 560, width: 600, x: 0, y: 0 },
      { rows: [] },
    );
    drawGuideCard(none.context, { height: 30, width: 600, x: 0, y: 0 }, guide);
    expect(none.calls).toEqual([]);
  });

  it("leaves the hero room between its writing: below the goal and above the keys, or beside the writing on a short wide screen", () => {
    const tall = planCard(
      { height: 468, width: 390, x: 0, y: 52 },
      guide,
      true,
    );
    expect(tall.side).toBe(false);
    expect(tall.at.title).toBeLessThan(tall.at.goal);
    expect(tall.at.lines).toBeLessThan(tall.at.start);
    // The hero stands between the goal's last line and the first line of the keys, and has room there.
    expect(tall.hero.y - tall.hero.height / 2).toBeGreaterThanOrEqual(
      tall.at.goal,
    );
    expect(tall.hero.y + tall.hero.height / 2).toBeLessThanOrEqual(
      tall.at.lines,
    );
    expect(tall.hero.height).toBeGreaterThan(100);

    const short = planCard(
      { height: 146, width: 480, x: 0, y: 52 },
      guide,
      true,
    );
    expect(short.side).toBe(true);
    // The writing keeps clear of the way out in the top left corner, and the hero stands to its right.
    expect(short.left).toBeGreaterThanOrEqual(60);
    expect(short.hero.x).toBeGreaterThan(short.right);
    expect(short.at.start + short.size.start).toBeLessThanOrEqual(198);
    expect(short.at.title).toBeGreaterThanOrEqual(0);
    // A keyboard has no way out to keep clear of.
    expect(
      planCard({ height: 146, width: 480, x: 0, y: 52 }, guide, false).left,
    ).toBe(0);

    const surface = recorder();
    drawGuideCard(
      surface.context,
      { height: 146, width: 480, x: 0, y: 52 },
      guide,
      true,
    );
    // jsdom is not a touch screen, so the words are the keyboard's; `touch` only keeps the writing clear of the way out.
    expect(surface.texts()).toEqual(
      expect.arrayContaining([guide.title, ...goalLines, guide.start]),
    );
  });

  it("tells the camera where the hero is to stand, as shares of the screen", () => {
    const screen = document.createElement("canvas");
    const panel = document.createElement("section");
    vi.spyOn(screen, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 1000, 560),
    );
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(
      new DOMRect(600, 10, 380, 540),
    );
    // The select stands down the right, so the hero stands in the middle of the room to its left, between the goal and the keys.
    const spot = heroFrame(screen, panel, false);
    expect(spot.x).toBeCloseTo(0.3, 5);
    expect(spot.y).toBeGreaterThan(0.3);
    expect(spot.y).toBeLessThan(0.7);
    expect(spot.height).toBeGreaterThan(0.2);
    expect(spot.height).toBeLessThan(0.7);
    // A screen with no size yet is framed as a whole.
    const unset = document.createElement("canvas");
    expect(heroFrame(unset, panel, false)).toEqual({
      height: 1,
      x: 0.5,
      y: 0.5,
    });
  });

  it("lies over the screen at the display's pixels, and goes when asked", () => {
    const surface = recorder();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      surface.context as never,
    );
    const screen = document.createElement("canvas");
    const panel = document.createElement("section");
    document.body.append(screen, panel);
    vi.spyOn(screen, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 800, 450),
    );
    const card = createFirstCard(screen, panel, true);
    card.show(guide);
    const layer = screen.nextElementSibling;
    expect(layer).toBeInstanceOf(HTMLCanvasElement);
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(surface.texts()).toContain(guide.title);
    card.show(null);
    expect((layer as HTMLCanvasElement).style.display).toBe("none");
  });
});

describe("the share card", () => {
  it("draws the run square or tall, with or without the hero's picture, in the game's colours and never orange", () => {
    for (const [state, shape] of [
      [playBot(1004, 4).state, "square"],
      [playBot(31, 2, lingering).state, "story"],
    ] as const) {
      const surface = recorder();
      const canvas = document.createElement("canvas");
      vi.spyOn(canvas, "getContext").mockReturnValue(surface.context as never);
      drawShareCard(
        canvas,
        state,
        shape === "square" ? new Image() : null,
        shape,
      );
      expect(canvas.height).toBeGreaterThanOrEqual(canvas.width);
      expect(surface.texts().join(" ")).toContain("FROST RUN");
      expect(
        surface.written.every(({ fill }) => fill.toLowerCase() !== "#f7931a"),
      ).toBe(true);
    }
    const blank = document.createElement("canvas");
    vi.spyOn(blank, "getContext").mockReturnValue(null);
    expect(() =>
      drawShareCard(blank, playBot(1, 0).state, null, "square"),
    ).not.toThrow();
  });
});

describe("the flat screen", () => {
  it("draws the run from above, flashes for each crystal and sounds each happening, as the 3D screen does", () => {
    const surface = recorder();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 320, 180),
    );
    const moment = fakeMoment();
    const flat = new FlatScreen(canvas, surface.context, moment);
    flat.resize(2);
    expect([canvas.width, canvas.height]).toEqual([640, 360]);
    flat.select(1);
    flat.show(null);
    expect(surface.named("arc").length).toBeGreaterThan(2);
    for (const [seed, lead, style] of [
      [1004, 4, strong],
      [7919, 0, hunter],
    ] as const) {
      const { inputs, state } = playBot(seed, lead, style);
      flat.begin(lead);
      moment.flash.mockClear();
      for (const [, now] of frames(seed, inputs)) flat.show({ now });
      const crystals = state.tallies.reduce(
        (sum, { crystal }) => sum + crystal,
        0,
      );
      expect(moment.flash).toHaveBeenCalledTimes(crystals);
    }
    expect(moment.sfx.mock.calls.map(([name]) => name)).toContain("crush");
    canvas.toDataURL = () => "data:image/png;base64,AA";
    expect(flat.snapshot()).toBe("data:image/png;base64,AA");
    const quiet = new FlatScreen(canvas, null, moment);
    quiet.show({ now: playBot(1, leads.length - 1).state });
    expect(moment.sfx).toHaveBeenCalled();
  });
});
