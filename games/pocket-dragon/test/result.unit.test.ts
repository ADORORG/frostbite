// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nurseryRun } from "../src/bonus/nursery-run.ts";
import { startPlay } from "../src/page/plays.ts";
import { resultOf, testLine } from "../src/page/result.ts";
import { startRun, type PlayRun } from "../src/page/runs.ts";
import { createView } from "../src/page/view.ts";
import { drawQuest } from "../src/screen/quest-draw.ts";
import { startQuest } from "../src/rules/quest/tick.ts";
import { surface } from "./support/canvas.ts";
import { drawnWith } from "./support/drawn.ts";

// The card over the screen once a run is over: how it ended, what it came to, the best, and how to go again.
vi.mock("../src/three/stage.ts", () => ({ createDepthView: () => null }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const touchScreen = () =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query === "(pointer: coarse)" })),
  );

const texts = (rows: ReturnType<typeof resultOf>["rows"]) =>
  rows.map(({ text }) => text);

const quest = startPlay("quest", 4);
const won: PlayRun = {
  ...quest,
  fame: () => ({
    eggs: 70,
    hearts: 2,
    score: 52_300,
    secrets: 3,
    ticks: 36_060,
  }),
  score: () => 52_300,
  won: () => true,
};

describe("the card after a run", () => {
  it("says a quest was won, in what time and for what score, and whether it was the best", () => {
    const card = resultOf({
      best: 52_300,
      finished: won,
      newBest: true,
      next: "quest",
    });
    expect(texts(card.rows)).toEqual([
      "QUEST COMPLETE!",
      "TIME 10:01  SCORE 52,300",
      "NEW BEST!",
      "ENTER TO PLAY AGAIN",
    ]);
    // The heading is the largest row and the line that says how to go again the smallest.
    const weights = card.rows.map(({ weight }) => weight);
    expect(Math.max(...weights)).toBe(weights[0]);
    expect(Math.min(...weights)).toBe(weights[3]);
  });

  it("says a quest or a level was lost, the score, the best kept, and on a touch screen to tap", () => {
    touchScreen();
    expect(
      texts(
        resultOf({
          best: 9_000,
          finished: quest,
          newBest: false,
          next: "quest",
        }).rows,
      ),
    ).toEqual([
      "THE QUEST IS OVER",
      "SCORE 0",
      "BEST 9000",
      "TAP TO PLAY AGAIN",
    ]);
    expect(
      texts(
        resultOf({
          best: 0,
          finished: startRun("castle", 4),
          newBest: false,
          next: "castle",
        }).rows,
      )[0],
    ).toBe("THE GUILD AND THE CASTLE: TRY AGAIN!");
  });

  it("says a level was cleared, and how to begin the level it opened", () => {
    const hills: PlayRun = {
      ...startRun("hills", 4),
      cleared: () => ["hills"],
      score: () => 4_100,
    };
    expect(
      texts(
        resultOf({
          best: 4_100,
          finished: hills,
          newBest: true,
          next: "castle",
        }).rows,
      ),
    ).toEqual([
      "EGG HILLS CLEARED!",
      "SCORE 4,100",
      "NEW BEST!",
      "ENTER TO PRACTISE LEVEL 2",
    ]);
    touchScreen();
    expect(
      resultOf({
        best: 4_100,
        finished: hills,
        newBest: false,
        next: "castle",
      }).rows.at(-1)?.text,
    ).toBe("TAP TO PRACTISE LEVEL 2");
  });

  it("says a test run and a visit to the Sky Nursery counted for nothing, with no best", () => {
    const test = startPlay("quest", 4, undefined, true);
    expect(
      texts(
        resultOf({ best: 0, finished: test, newBest: false, next: "quest" })
          .rows,
      ),
    ).toEqual(["THE QUEST IS OVER", testLine, "ENTER TO START THE QUEST"]);
    expect(
      texts(
        resultOf({
          best: 0,
          finished: nurseryRun(5),
          newBest: false,
          next: "hills",
        }).rows,
      ),
    ).toEqual([
      "THE SKY NURSERY",
      "EGGS 0  DRAGONS 0  STARS 0",
      "ENTER TO PRACTISE LEVEL 1",
    ]);
  });

  it("is the screen's own: the quest's screen no longer writes how it ended under the card", () => {
    const over = drawnWith(drawQuest, { ...startQuest(3), lost: true }).texts();
    expect(over).not.toContain("THE QUEST IS OVER");
    expect(over).toEqual(drawnWith(drawQuest, startQuest(3)).texts());
  });
});

describe("the card over the screen", () => {
  const page = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
  beforeEach(() => {
    document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(page)?.[1] ?? "";
  });

  it("is the first-screen card while idle, nothing during a run, and the card after it once it is over", () => {
    const card = surface();
    const screen = surface();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        return this.id === "screen" ? screen.context : card.context;
      },
    );
    const view = createView();
    const layer = () =>
      [...document.querySelectorAll("canvas")].find(
        (canvas) =>
          canvas.getAttribute("aria-hidden") === "true" && canvas.id === "",
      );
    const run = startRun("hills", 4);
    view.draw(run, true, 0, 0);
    expect(layer()?.style.display).toBe("block");
    expect(card.texts()).toContain("EGG HILLS");
    view.running(true);
    view.draw(run, false, 0, 0);
    expect(layer()?.style.display).toBe("none");
    view.running(false);
    view.over(
      resultOf({ best: 0, finished: run, newBest: false, next: "hills" }),
    );
    view.draw(run, false, 0, 0);
    expect(layer()?.style.display).toBe("block");
    expect(card.texts()).toContain("EGG HILLS: TRY AGAIN!");
    // A new run takes the card away, and its end brings a new one.
    view.running(true);
    view.draw(run, false, 0, 0);
    expect(layer()?.style.display).toBe("none");
    view.running(false);
    view.draw(run, false, 0, 0);
    expect(layer()?.style.display).toBe("none");
  });
});
