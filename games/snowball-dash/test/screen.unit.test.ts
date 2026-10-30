import { describe, expect, it } from "vitest";

import { levelLength } from "../src/rules/constants.ts";
import {
  canvasScale,
  draw,
  screenHeight,
  screenWidth,
} from "../src/screen/draw.ts";
import { multiplierOf } from "../src/screen/hud.ts";
import { groundY, ballX, px, screenX, screenY } from "../src/screen/layout.ts";
import { colour } from "../src/screen/palette.ts";
import type { View } from "../src/screen/view.ts";
import { ofColour, surface } from "./support/canvas.ts";
import { bare, boulder, pit, rock, spikes } from "./support/states.ts";
import type { RunState } from "../src/rules/types.ts";

const running: View = {
  best: 100,
  newBest: false,
  phase: "running",
  toast: null,
};
const painted = (state: RunState, view: View = running) => {
  const page = surface();
  draw(page.context, state, view);
  return page;
};
const said = (page: ReturnType<typeof surface>): string[] =>
  page.written.map(({ text }) => text);

describe("where things are on the screen", () => {
  it("is six sub-units to a pixel, with the snowball a little in from the left and the snow below it", () => {
    expect(px(60)).toBe(10);
    expect(px(2)).toBe(0);
    expect(screenX(1_000, 400)).toBe(ballX + 100);
    expect(screenY(120)).toBe(groundY - 20);
    expect(screenY(0)).toBe(groundY);
    expect(canvasScale * screenWidth).toBe(640);
    expect(canvasScale * screenHeight).toBe(360);
  });

  it("is a multiplier of one more than the streak, up to ten", () => {
    expect(multiplierOf(0)).toBe(1);
    expect(multiplierOf(3)).toBe(4);
    expect(multiplierOf(50)).toBe(10);
  });
});

describe("drawing a run", () => {
  it("sets the scale and crisp pixels, then paints the whole screen before anything else", () => {
    const page = painted(bare());
    expect(page.state.imageSmoothingEnabled).toBe(false);
    expect(page.drawn[0]).toMatchObject({
      height: screenHeight,
      width: screenWidth,
      x: 0,
      y: 0,
    });
  });

  it("draws the snowball at its place, and lifts it as high as it hops", () => {
    const low = painted(bare());
    const high = painted(bare({ y: 240 }));
    const body = (page: ReturnType<typeof surface>) =>
      Math.min(...ofColour(page.drawn, colour.ball).map(({ y }) => y));
    expect(body(low) - body(high)).toBe(40);
    expect(
      Math.min(...ofColour(low.drawn, colour.ball).map(({ x }) => x)),
    ).toBeGreaterThanOrEqual(ballX);
  });

  it("draws each kind of obstacle where the rules put it, and not those off the screen", () => {
    const seen = (obstacle: RunState["ahead"][number]) =>
      painted(bare({ ahead: [obstacle] }));
    const rocks = seen(rock(300));
    expect(ofColour(rocks.drawn, colour.rockLight).length).toBeGreaterThan(0);
    const boulders = seen(boulder(300));
    expect(ofColour(boulders.drawn, colour.rockLight).length).toBeGreaterThan(
      0,
    );
    expect(
      Math.min(...ofColour(boulders.drawn, colour.outline).map(({ y }) => y)),
    ).toBe(groundY - 24);
    const spiked = seen(spikes(300));
    expect(ofColour(spiked.drawn, colour.ice).length).toBeGreaterThan(0);
    expect(ofColour(spiked.drawn, colour.outline).length).toBeGreaterThan(0);
    const crevasse = seen(pit(300, 300));
    expect(
      ofColour(crevasse.drawn, colour.pit).filter(({ y }) => y === groundY),
    ).toHaveLength(1);
    expect(ofColour(crevasse.drawn, colour.pitGlow).length).toBeGreaterThan(0);
    const away = painted(
      bare({ ahead: [rock(30_000), boulder(40_000), spikes(50_000)] }),
    );
    expect(ofColour(away.drawn, colour.rockLight)).toHaveLength(0);
    expect(ofColour(away.drawn, colour.ice)).toHaveLength(0);
  });

  it("draws the shards that are in view", () => {
    const page = painted(
      bare({
        shards: [
          { x: 400, y: 100 },
          { x: 90_000, y: 100 },
        ],
      }),
    );
    expect(ofColour(page.drawn, colour.yellow).length).toBeGreaterThan(0);
    const none = painted(bare());
    expect(ofColour(none.drawn, colour.yellow).length).toBe(0);
  });

  it("changes the sky every three levels, and brings in speed lines once the slope is quick", () => {
    const first = painted(bare());
    const later = painted(bare({ distance: 3 * levelLength }));
    expect(ofColour(first.drawn, "#150b3a").length).toBeGreaterThan(0);
    expect(ofColour(later.drawn, "#2b1060").length).toBeGreaterThan(0);
    const slow = painted(bare({ distance: 0 }));
    const fast = painted(bare({ distance: 12 * levelLength }));
    const lines = (page: ReturnType<typeof surface>) =>
      page.drawn.filter(({ alpha }) => alpha === 0.35).length;
    expect(lines(slow)).toBe(0);
    expect(lines(fast)).toBeGreaterThan(0);
  });

  it("tints the screen red once the snowball is dead", () => {
    const alive = painted(bare());
    const dead = painted(bare({ alive: false, cause: "hit" }), {
      ...running,
      phase: "over",
    });
    expect(ofColour(alive.drawn, colour.danger)).toHaveLength(0);
    expect(ofColour(dead.drawn, colour.danger).length).toBeGreaterThan(0);
  });
});

describe("what is written over the screen", () => {
  it("shows the score and the best, and the multiplier only while a streak is going", () => {
    const plain = painted(bare({ score: 1234 }));
    expect(said(plain)).toContain("1234");
    expect(said(plain)).toContain("BEST 100");
    expect(said(plain).some((text) => text.startsWith("x"))).toBe(false);
    const streaking = painted(bare({ score: 1234, streak: 3 }));
    expect(said(streaking)).toContain("x4");
  });

  it("fills a bar across the top with how far through the level the snowball is", () => {
    const half = painted(bare({ distance: levelLength / 2 }));
    const bar = ofColour(half.drawn, colour.cyan).find(
      ({ y, height }) => y === 0 && height === 2,
    );
    expect(bar?.width).toBe(screenWidth / 2);
  });

  it("shows a line of news for a moment while the run goes, and not once it is over or the moment has passed", () => {
    const toast = { text: "5,000 points", until: 100 };
    expect(said(painted(bare({ tick: 50 }), { ...running, toast }))).toContain(
      "5,000 points",
    );
    expect(
      said(painted(bare({ tick: 100 }), { ...running, toast })),
    ).not.toContain("5,000 points");
    expect(
      said(painted(bare({ tick: 50 }), { ...running, phase: "over", toast })),
    ).not.toContain("5,000 points");
  });

  it("has a card before the first run that says how to play", () => {
    const text = said(painted(bare(), { ...running, phase: "ready" }));
    expect(text).toContain("SNOWBALL DASH");
    expect(text).toContain("ENTER, SPACE OR TAP TO ROLL");
  });

  it("has a card after a run with the score, the best, and how it ended", () => {
    const over = (cause: "fell" | "hit", view: Partial<View>) =>
      said(
        painted(bare({ alive: false, cause, score: 777 }), {
          ...running,
          phase: "over",
          ...view,
        }),
      );
    const hit = over("hit", {});
    expect(hit).toContain("RUN OVER");
    expect(hit).toContain("SCORE 777");
    expect(hit).toContain("BEST 100");
    expect(over("fell", {})).toContain("INTO THE CREVASSE");
    expect(over("hit", { newBest: true })).toContain("NEW BEST!");
    expect(over("hit", {})).not.toContain("NEW BEST!");
  });

  it("has no card while a run goes", () => {
    expect(said(painted(bare()))).not.toContain("RUN OVER");
    expect(said(painted(bare()))).not.toContain("SNOWBALL DASH");
  });
});
