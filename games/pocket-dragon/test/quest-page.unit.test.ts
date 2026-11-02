import { describe, expect, it } from "vitest";

import type { PlayRun } from "../src/page/runs.ts";
import { settle } from "../src/page/settle.ts";
import { freshProgress } from "../src/progress.ts";
import type { ChapterId, PlayId } from "../src/rules/constants.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { startHills } from "../src/rules/hills/state.ts";
import { shiftTicks } from "../src/rules/quest/constants.ts";
import { legKinds, legRun } from "../src/rules/quest/legs.ts";
import { startQuest } from "../src/rules/quest/tick.ts";
import type { QuestState } from "../src/rules/quest/types.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { arrivalTicks, drawQuest } from "../src/screen/quest-draw.ts";
import { colour } from "../src/screen/palette.ts";
import { surface } from "./support/canvas.ts";

// The clock's hearts: the berry pixels drawn after the clock's pill, eleven to a heart.
const hearts = (screen: ReturnType<typeof surface>) => {
  const pill = screen.drawn.findIndex(
    ({ fill }) => fill === "rgb(12 6 32 / 0.72)",
  );
  return (
    screen.drawn.slice(pill + 1).filter(({ fill }) => fill === colour.berry)
      .length / 11
  );
};
const drawn = (state: QuestState) => {
  const screen = surface();
  drawQuest(screen.context, state);
  return screen;
};
const inCastle: QuestState = {
  ...startQuest(3),
  leg: legRun(legKinds.castle, { ...startCastle(3, 2), tick: 100 }),
  past: [legRun(legKinds.hills, startHills(3))],
  tick: 4_000,
};

describe("the quest on the screen", () => {
  it("draws the level being played with the quest's clock and a heart for each heart left", () => {
    const screen = drawn({ ...startQuest(3), tick: 3_725 });
    expect(screen.texts()).toContain("1:02");
    expect(hearts(screen)).toBe(3);
    const castle = drawn(inCastle);
    expect(hearts(castle)).toBe(2);
  });

  it("swirls into the next dimension between levels, naming it, and fades the new level in from white", () => {
    const into = (left: number, to: ChapterId) =>
      drawn({ ...startQuest(3), shift: { left, to } });
    expect(into(shiftTicks, "castle").texts()).not.toContain(
      "A NEW DIMENSION!",
    );
    expect(into(shiftTicks / 2, "castle").texts()).toEqual(
      expect.arrayContaining([
        "A NEW DIMENSION!",
        "LEVEL 2: THE GUILD AND THE CASTLE",
        "NOW WALK ANYWHERE ON THE MAP",
      ]),
    );
    expect(into(shiftTicks / 2, "woods").texts()).toContain(
      "INTO THE THIRD DIMENSION!",
    );
    const white = (screen: ReturnType<typeof drawn>) =>
      screen.drawn.filter(({ fill }) => fill.startsWith("rgb(255 255 255"));
    expect(white(into(10, "woods"))).toHaveLength(1);
    expect(white(into(shiftTicks / 2, "woods"))).toHaveLength(0);
    expect(white(drawn(inCastle))).toHaveLength(0);
    const arriving = {
      ...inCastle,
      leg: legRun(legKinds.castle, { ...startCastle(3), tick: 5 }),
    };
    expect(white(drawn(arriving))).toHaveLength(1);
    const settled = {
      ...arriving,
      leg: legRun(legKinds.castle, { ...startCastle(3), tick: arrivalTicks }),
    };
    expect(white(drawn(settled))).toHaveLength(0);
  });

  it("says how the quest ended", () => {
    const won = drawn({
      ...startQuest(3),
      finishTick: 36_100,
      leg: legRun(legKinds.woods, { ...startWoods(3), escaped: true }),
    });
    expect(won.texts()).toEqual(
      expect.arrayContaining([
        "QUEST COMPLETE!",
        "THE DRAGONS ARE SAFE  TIME 10:01",
      ]),
    );
    expect(drawn({ ...startQuest(3), lost: true }).texts()).toContain(
      "THE QUEST IS OVER",
    );
  });
});

// A finished run as the page has it: only what settling it asks for.
function finished(
  id: PlayId,
  more: Partial<Pick<PlayRun, "cleared" | "fame" | "level" | "won">> = {},
): PlayRun {
  return {
    cleared: () => [],
    depth: () => null,
    draw: () => undefined,
    earned: () => ["first-egg"],
    ended: () => true,
    fame: () => null,
    hold: () => undefined,
    id,
    level: () => (id === "quest" ? "hills" : id),
    plasma: () => 40,
    record: () => {
      throw new Error("not recorded here");
    },
    score: () => 12_000,
    stats: () => [["Time", "4:00"]],
    tick: () => [],
    won: () => false,
    ...more,
  };
}

describe("a finished run, settled", () => {
  it("puts a won quest in the Hall of Fame and says where, opening every level to practise", () => {
    const fame = {
      eggs: 90,
      hearts: 4,
      score: 12_000,
      secrets: 5,
      ticks: 30_000,
    };
    const after = settle(
      freshProgress,
      finished("quest", {
        cleared: () => ["hills", "castle", "woods"],
        fame: () => fame,
        level: () => "woods",
        won: () => true,
      }),
    );
    expect(after.progress).toMatchObject({
      best: { quest: 12_000 },
      fame: [fame],
      plasma: 40,
      unlocked: 3,
      won: true,
    });
    expect(after.news).toBe(
      "You won the whole quest in 8:20! Hall of Fame: number 1! Level 3 is open to practise: The Whispering Woods! ",
    );
    expect(after.lastRun).toEqual({
      chapter: "woods",
      outcome: "won",
      quest: true,
      score: 12_000,
      stats: [["Time", "4:00"]],
      trophies: ["first-egg"],
    });
    const full = {
      ...freshProgress,
      fame: Array.from({ length: 10 }, () => ({ ...fame, score: 99_000 })),
      unlocked: 3,
    };
    const low = settle(
      full,
      finished("quest", { fame: () => fame, won: () => true }),
    );
    expect(low.news).toBe("You won the whole quest in 8:20! ");
    expect(low.progress.fame).toEqual(full.fame);
  });

  it("says where a lost quest ended, and opens what it cleared", () => {
    const after = settle(
      freshProgress,
      finished("quest", { cleared: () => ["hills"], level: () => "castle" }),
    );
    expect(after.opened).toBe("castle");
    expect(after.news).toBe(
      "The quest ended in The Guild and the Castle. Level 2 is open to practise: The Guild and the Castle! ",
    );
    expect(after.lastRun).toMatchObject({ outcome: "lost", quest: true });
  });

  it("opens the next level after a practice clear, and cheers the last one", () => {
    const hills = settle(
      freshProgress,
      finished("hills", { cleared: () => ["hills"] }),
    );
    expect(hills.opened).toBe("castle");
    expect(hills.lastRun).toMatchObject({ outcome: "cleared", quest: false });
    expect(hills.progress.best.hills).toBe(12_000);
    const woods = settle(
      { ...freshProgress, unlocked: 3 },
      finished("woods", { cleared: () => ["woods"] }),
    );
    expect(woods.opened).toBeNull();
    expect(woods.news).toBe(
      "You cleared the last level! Now try the whole quest against the clock. ",
    );
    const lost = settle(freshProgress, finished("hills"));
    expect(lost).toMatchObject({ news: "", opened: null });
    expect(lost.lastRun.outcome).toBe("lost");
  });
});
