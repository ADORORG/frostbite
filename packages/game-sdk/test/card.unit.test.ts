import { describe, expect, it } from "vitest";

import { cardFor } from "../src/card.ts";
import type { Guide, ResultCard } from "../src/guide.ts";

const guide: Guide = { lines: [], start: "ENTER TO START", title: "A GAME" };
const result: ResultCard = { rows: [] };

describe("what is over the screen", () => {
  it("is the first-screen card before a run, the card after a run once it is over, and nothing while a run goes", () => {
    expect(cardFor("ready", guide, () => result)).toBe(guide);
    expect(cardFor("over", guide, () => result)).toBe(result);
    expect(cardFor("running", guide, () => result)).toBeNull();
  });

  it("asks for the card after a run only when it is shown, and shows nothing when the game has none", () => {
    let asked = 0;
    const counted = () => {
      asked += 1;
      return result;
    };
    cardFor("ready", guide, counted);
    cardFor("running", guide, counted);
    expect(asked).toBe(0);
    expect(cardFor("over", guide, () => null)).toBeNull();
  });
});
