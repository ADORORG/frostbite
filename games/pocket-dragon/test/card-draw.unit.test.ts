import { describe, expect, it } from "vitest";

import { drawArt } from "../src/card/art.ts";
import { cardOf, type CardFacts } from "../src/card/content.ts";
import { fileNameOf, layoutOf, shapes, type Box } from "../src/card/layout.ts";
import { big, fitted, panel, sheen, wrap } from "../src/card/paint.ts";
import { drawPoster } from "../src/card/poster.ts";
import { milestoneIds } from "../src/rules/milestones.ts";
import { trophiesOf } from "../src/card/trophy-list.ts";
import { surface } from "./support/canvas.ts";
import { facts as shared } from "./support/card-facts.ts";

const facts: CardFacts = {
  ...shared,
  trophies: trophiesOf(
    ["first-egg", "golden-egg", "hills-clear", "secret-charm"],
    new Map([["hills-clear", "Egg Hills cleared"]]),
  ),
};
const kinds: readonly CardFacts[] = [
  facts,
  { ...facts, chapter: "woods", invite: null, outcome: "lost" },
  {
    ...facts,
    chapter: "castle",
    masterful: true,
    outcome: "won",
    unlocked: 3,
    won: true,
  },
  { ...facts, outcome: "journey", stats: [], unlocked: 1 },
];
// What is written in colour (each line is also written once in the dark shadow under it).
const shown = (screen: ReturnType<typeof surface>): readonly string[] =>
  screen.written
    .filter((line) => line.fill !== "#0c0620")
    .map((line) => line.text);
const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
const inside = (a: Box, width: number, height: number): boolean =>
  a.x >= 0 && a.y >= 0 && a.x + a.width <= width && a.y + a.height <= height;

describe("a card picture's layout", () => {
  it("is a square post, a story or a wide post, with a 5:7 card and nothing on top of anything else", () => {
    expect(
      shapes.map((shape) => [layoutOf(shape).width, layoutOf(shape).height]),
    ).toEqual([
      [1080, 1080],
      [1080, 1920],
      [1920, 1080],
    ]);
    for (const shape of shapes) {
      const { badges, card, headline, height, invite, width } = layoutOf(shape);
      expect(Math.abs(card.width / card.height - 5 / 7)).toBeLessThan(0.002);
      const boxes = [badges, card, headline, invite];
      for (const one of boxes) expect(inside(one, width, height)).toBe(true);
      boxes.forEach((one, at) =>
        boxes
          .slice(at + 1)
          .forEach((other) => expect(overlap(one, other)).toBe(false)),
      );
    }
    expect(shapes.map(fileNameOf)).toEqual([
      "pocket-dragon-card-1x1.png",
      "pocket-dragon-card-9x16.png",
      "pocket-dragon-card-16x9.png",
    ]);
  });
});

describe("a card picture", () => {
  it("is drawn in the game's colours with whole sums, on the picture, in every size and for every kind of card", () => {
    for (const shape of shapes)
      for (const kind of kinds) {
        const screen = surface();
        const layout = layoutOf(shape);
        drawPoster(screen.context, layout, cardOf(kind));
        expect(screen.drawn.length).toBeGreaterThan(400);
        for (const block of screen.drawn) {
          expect(block.fill).toMatch(/^(#[0-9a-f]{3,8}|rgb\(.+\)|gradient)$/iu);
          expect(
            [block.x, block.y, block.width, block.height].every(
              Number.isFinite,
            ),
          ).toBe(true);
          expect(
            overlap(block, {
              height: layout.height,
              width: layout.width,
              x: 0,
              y: 0,
            }),
          ).toBe(true);
        }
        for (const written of screen.written) {
          expect(written.x).toBeGreaterThanOrEqual(0);
          expect(written.y).toBeLessThan(layout.height);
        }
        expect(screen.context.globalAlpha).toBe(1);
      }
  });

  it("says everything the card is: the headline, Glitchy's name and title, the score, the moves, the quote, the quest and the invite", () => {
    for (const shape of shapes) {
      const screen = surface();
      const card = cardOf(facts);
      drawPoster(screen.context, layoutOf(shape), card);
      const all = shown(screen).join(" ");
      for (const words of [
        "GLITCHY",
        "HILL RUNNER",
        "12,840",
        "POINTS",
        "CLEARED!",
        "EGG SNATCH",
        "72",
        "PORTAL DASH",
        "3/3",
        "FLAME",
        "POCKET DRAGON",
        "12/40",
        "JOIN ME ON THE QUEST",
        "METAPLASMA BANKED 1,204",
        "EGG HILLS",
        "THE WHISPERING WOODS",
      ])
        expect(all).toContain(words);
      expect(all.replace(/\s+/gu, " ")).toContain("I CLEARED EGG");
      expect(shown(screen).join("")).toContain(
        "play.example.com/games/pocket-dragon",
      );
      expect(all).toContain(card.quote.split(" ").slice(0, 3).join(" "));
    }
    const rows = surface();
    drawPoster(rows.context, layoutOf("story"), cardOf(facts));
    expect(rows.texts()).toEqual(
      expect.arrayContaining([
        "CLEARED · BEST 12,840",
        "OPEN · BEST 9,100",
        "LOCKED",
      ]),
    );
    const lost = surface();
    drawPoster(lost.context, layoutOf("wide"), cardOf(kinds[1] ?? facts));
    expect(lost.texts()).toEqual(
      expect.arrayContaining(["JOIN THE QUEST", "TRY AGAIN!", "SPARK"]),
    );
    expect(lost.texts().join(" ")).toContain("FIND POCKET DRAGON");
  });

  it("draws each chapter's own picture, the castle's banner gold once it is won, and more sparkle the rarer the card", () => {
    const art = { height: 420, width: 600, x: 0, y: 0 };
    const fills = (chapter: "castle" | "hills" | "woods", won = false) => {
      const screen = surface();
      drawArt(screen.context, art, chapter, won);
      return screen.drawn.map((block) => block.fill).join();
    };
    expect(
      new Set([fills("hills"), fills("woods"), fills("castle")]).size,
    ).toBe(3);
    expect(fills("castle", true)).not.toBe(fills("castle"));
    const sparkles = (rarity: number) => {
      const screen = surface();
      drawPoster(screen.context, layoutOf("square"), {
        ...cardOf(facts),
        rarity,
      });
      return screen.drawn.filter((block) => block.fill === "#ffffff").length;
    };
    expect(sparkles(4)).toBeGreaterThan(sparkles(2));
    expect(sparkles(2)).toBeGreaterThan(sparkles(1));
  });
});

describe("the trophy shelf", () => {
  it("shows the run's trophies with their cups, the count held, and counts what does not fit", () => {
    const shelf = (
      shape: (typeof shapes)[number],
      trophies: CardFacts["trophies"],
      outcome: CardFacts["outcome"] = "cleared",
    ) => {
      const screen = surface();
      drawPoster(
        screen.context,
        layoutOf(shape),
        cardOf({ ...facts, outcome, trophies }),
      );
      return shown(screen);
    };
    for (const shape of shapes) {
      const texts = shelf(shape, facts.trophies);
      expect(texts).toEqual(
        expect.arrayContaining([
          "TROPHIES THIS RUN",
          "12/40",
          "EGG HILLS CLEARED",
          "SECRET CHARM",
          "FIRST EGG",
        ]),
      );
      const many = trophiesOf(milestoneIds, new Map());
      const crowded = shelf(shape, many);
      const more = crowded.find((text) => /^\+\d+ MORE$/u.test(text));
      expect(more).toBeDefined();
      const hidden = Number(/\d+/u.exec(more ?? "")?.[0]);
      const titles = new Set(many.map((trophy) => trophy.title));
      const listed = crowded.filter(
        (text) => titles.has(text) || text.endsWith("…"),
      ).length;
      expect(listed + hidden).toBe(many.length);
      expect(shelf(shape, [], "lost")).toContain("NO NEW TROPHIES THIS RUN");
      expect(shelf(shape, [], "journey")).toEqual(
        expect.arrayContaining([
          "TROPHY CASE",
          "NO TROPHIES YET: THE QUEST AWAITS",
        ]),
      );
    }
  });
});

describe("the card's brushes", () => {
  it("break words into lines that fit, a too-long word where it must, and shrink type until it fits", () => {
    expect(wrap("ONE TWO THREE", 6 * 0.6 * 10, 10)).toEqual([
      "ONE",
      "TWO",
      "THREE",
    ]);
    expect(wrap("ONE TWO THREE", 100 * 0.6 * 10, 10)).toEqual([
      "ONE TWO THREE",
    ]);
    expect(wrap("ABCDEFGHIJ KL", 4 * 0.6 * 10, 10)).toEqual([
      "ABCD",
      "EFGH",
      "IJ",
      "KL",
    ]);
    expect(fitted("ABCDEFGHIJ", 120, 40, 1)).toBe(20);
    expect(fitted("A VERY LONG LINE OF WORDS INDEED", 10, 40, 1)).toBe(12);
    expect(fitted("SHORT", 1000, 40, 1)).toBe(40);
  });

  it("draw panels with pixel corners, pictures cell by cell, and a sheen that leaves the picture opaque after", () => {
    const screen = surface();
    panel(
      screen.context,
      { height: 50, width: 100, x: 10, y: 20 },
      "#111111",
      "#222222",
      2,
      4,
    );
    expect(screen.drawn.map((block) => block.fill)).toEqual([
      "#222222",
      "#222222",
      "#111111",
      "#111111",
    ]);
    expect(screen.drawn[0]).toEqual({
      fill: "#222222",
      height: 50,
      width: 92,
      x: 14,
      y: 20,
    });
    const picture = surface();
    big(picture.context, ["a.", ".a"], { a: "#333333" }, 5, 5, 3);
    expect(picture.drawn).toEqual([
      { fill: "#333333", height: 3, width: 3, x: 5, y: 5 },
      { fill: "#333333", height: 3, width: 3, x: 8, y: 8 },
    ]);
    const shine = surface();
    sheen(shine.context, { height: 10, width: 10, x: 0, y: 0 }, 0.3);
    expect(shine.drawn).toHaveLength(1);
    expect(shine.stops.length).toBeGreaterThan(5);
    expect(shine.context.globalAlpha).toBe(1);
  });
});
