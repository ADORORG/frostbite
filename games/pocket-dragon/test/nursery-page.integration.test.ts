import { afterEach, describe, expect, it } from "vitest";

import { nurseryNote } from "../src/bonus/nursery-run.ts";
import { closeGame, play, settle } from "./support/page.ts";

// The secret Sky Nursery on the page: hidden until the quest is won, then a button (and the 4 key) opens a visit that counts for
// nothing; flying out ends it, and Share card then makes the nursery's own cards.
const saved = (won: boolean) => ({
  best: { castle: 0, hills: 0, quest: 0, woods: 0 },
  fame: [],
  plasma: 0,
  sound: { effects: false, music: false, volume: 0.2 },
  unlocked: 3,
  won,
});

afterEach(closeGame);

describe("the secret Sky Nursery on the page", () => {
  it("stays hidden until the quest is won", async () => {
    const game = await play(saved(false));
    await settle();
    expect(game.byId("nursery")?.hasAttribute("hidden")).toBe(true);
  });

  it("opens with its button or the 4 key once the quest is won, counts for nothing, and offers its own cards after", async () => {
    const game = await play(saved(true));
    await settle();
    expect(game.byId("nursery")?.hasAttribute("hidden")).toBe(false);
    game.press("Digit4");
    await settle(30);
    expect(game.text("note")).toBe(nurseryNote);
    expect(game.text("thumb-act")).toBe("Dance");
    expect(game.byId("nursery")?.hasAttribute("disabled")).toBe(true);
  });
});
