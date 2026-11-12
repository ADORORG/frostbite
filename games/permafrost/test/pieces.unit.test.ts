import { describe, expect, it } from "vitest";

import { filled, shuffledBag } from "../src/rules/bag.ts";
import { cellsOf, kicksFor, pieceCount } from "../src/rules/pieces.ts";

describe("the seven pieces", () => {
  it("each fill four cells in every turn, inside a four-by-four box, and come back to where they began after four turns", () => {
    for (let kind = 1; kind <= pieceCount; kind += 1) {
      for (let rotation = 0; rotation < 4; rotation += 1) {
        const cells = cellsOf(kind, rotation);
        expect(cells).toHaveLength(4);
        expect(new Set(cells.map(([x, y]) => `${x},${y}`)).size).toBe(4);
        for (const [x, y] of cells) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(4);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(4);
        }
      }
      expect(cellsOf(kind, 4)).toEqual(cellsOf(kind, 0));
    }
  });

  it("turn: the long piece lies flat then upright, the square does not change, and the others change", () => {
    expect(cellsOf(1, 0).every(([, y]) => y === 1)).toBe(true);
    expect(cellsOf(1, 1).every(([x]) => x === 2)).toBe(true);
    expect(cellsOf(2, 1)).toEqual(cellsOf(2, 0));
    for (const kind of [3, 4, 5, 6, 7])
      expect(cellsOf(kind, 1)).not.toEqual(cellsOf(kind, 0));
  });

  it("is nothing for a piece or turn that does not exist, and the long piece is kicked furthest", () => {
    expect(cellsOf(0, 0)).toEqual([]);
    expect(cellsOf(9, 0)).toEqual([]);
    expect(kicksFor(1).length).toBeGreaterThan(kicksFor(3).length);
    expect(kicksFor(3)[0]).toEqual([0, 0]);
  });
});

describe("the bag", () => {
  it("holds each piece once, in an order the seed decides", () => {
    const one = shuffledBag(123);
    expect([...one.bag].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(shuffledBag(123)).toEqual(one);
    const orders = new Set(
      Array.from({ length: 40 }, (_, at) =>
        shuffledBag(Math.imul(at + 1, 2_654_435_761) >>> 0).bag.join(""),
      ),
    );
    expect(orders.size).toBeGreaterThan(20);
  });

  it("never leaves a piece out of twelve in a row, however long it runs", () => {
    let held: readonly number[] = [];
    let rng = 99;
    const seen: number[] = [];
    for (let at = 0; at < 200; at += 1) {
      const next = filled(held, rng);
      rng = next.rng;
      const [first = 0, ...rest] = next.queue;
      held = rest;
      seen.push(first);
    }
    for (let from = 0; from + 13 <= seen.length; from += 1)
      expect(new Set(seen.slice(from, from + 13)).size).toBe(7);
  });

  it("keeps at least seven pieces behind the first", () => {
    expect(filled([], 5).queue.length).toBeGreaterThan(7);
    expect(filled([1, 2, 3], 5).queue.slice(0, 3)).toEqual([1, 2, 3]);
  });
});
