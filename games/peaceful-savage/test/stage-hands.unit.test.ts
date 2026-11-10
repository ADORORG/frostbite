import { describe, expect, it, vi } from "vitest";

import type { Hands } from "../src/page/controls.ts";
import { createStageHands } from "../src/page/stage-hands.ts";
import { lineOf } from "../src/view/family-farewell.ts";
import { bounds, singAt } from "../src/view/show.ts";

const handsOf = (): Hands => ({
  act: vi.fn(),
  cards: vi.fn(),
  choose: vi.fn(),
  choosing: () => false,
  end: vi.fn(),
  inMoment: () => false,
  jump: vi.fn(),
  pause: vi.fn(),
  practise: vi.fn(),
  running: () => false,
  start: vi.fn(),
  steer: vi.fn(),
  turn: vi.fn(),
  vision: vi.fn(),
});

describe("the player's hands in the show at the end", () => {
  it("leave the game's own hands alone until the show plays", () => {
    let showing = false;
    const show = createStageHands(
      () => showing,
      () => 0,
    );
    const hands = handsOf();
    const keys = show.wrap(hands, false);
    keys.act(true);
    keys.steer({ x: 1, y: 0 }, true);
    keys.turn(1);
    keys.vision();
    expect(hands.act).toHaveBeenCalledWith(true);
    expect(hands.steer).toHaveBeenCalledWith({ x: 1, y: 0 }, true);
    expect(hands.turn).toHaveBeenCalledWith(1);
    expect(hands.vision).toHaveBeenCalled();
    expect(keys.running()).toBe(false);
    expect(show.frame(0)).toBeNull();
    showing = true;
    expect(keys.running()).toBe(true);
  });

  it("walk the one taken about the stage, never off it, and pass to the next of the family", () => {
    let time = 0;
    const show = createStageHands(
      () => true,
      () => time,
    );
    const keys = show.wrap(handsOf(), false);
    show.begin("kai");
    expect(show.frame(time)?.who).toBe("kai");
    // Right on the screen, for two seconds: toward -x, as far as the stage goes.
    keys.steer({ x: 1, y: 0 }, false);
    for (time = 100; time <= 2_000; time += 100) show.frame(time);
    const moved = show.frame(time);
    expect(moved?.walking).toBe(true);
    const kai = moved?.at["kai"];
    expect(kai?.x).toBeLessThan(-1.5);
    expect(singAt(lineOf.kai).x + (kai?.x ?? 0)).toBeGreaterThanOrEqual(
      -bounds.side - 1e-9,
    );
    keys.steer(null, false);
    expect(show.frame((time += 100))?.walking).toBe(false);
    // Q passes to the next from the screen's left (Kai, then Zora); left and right on a touch swipe go either way.
    keys.vision();
    expect(show.frame((time += 100))?.who).toBe("zora");
    keys.turn(-1);
    keys.turn(-1);
    expect(show.frame((time += 100))?.who).toBe("ali");
    keys.turn(-1);
    expect(show.frame((time += 100))?.who).toBe("heerah");
    // A big move from the keys; the one taken stays the same.
    keys.act(true);
    keys.act(false);
    const big = show.frame((time += 100));
    expect(big?.moveAt).toBe(time - 100);
    expect(big?.who).toBe("heerah");
    // Kai stays where he was left.
    expect(big?.at["kai"]?.x).toBe(kai?.x);
  });

  it("on a touch screen, pass to the next with a tap, who answers with a big move", () => {
    const show = createStageHands(
      () => true,
      () => 500,
    );
    const touch = show.wrap(handsOf(), true);
    show.begin("ali");
    touch.act(true);
    const frame = show.frame(600);
    expect(frame?.who).toBe("kai");
    expect(frame?.moveAt).toBe(500);
  });
});
