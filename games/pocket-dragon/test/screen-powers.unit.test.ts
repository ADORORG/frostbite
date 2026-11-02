import { describe, expect, it } from "vitest";

import {
  act,
  challenge,
  charmMove,
  evadeMove,
  perform,
} from "../src/rules/castle/battle.ts";
import { showTicks } from "../src/rules/castle/constants.ts";
import { charmSpots } from "../src/rules/castle/places.ts";
import { startCastle } from "../src/rules/castle/tick.ts";
import { startWoods } from "../src/rules/woods/index.ts";
import { drawCastle } from "../src/screen/castle-draw.ts";
import { drawWoods } from "../src/screen/woods-screen.ts";
import { drawnWith, sound } from "./support/drawn.ts";

describe("the Whispering Woods' charms on the screen", () => {
  it("lists the charms' powers, and with the map charm shows the whole map and what is left to find", () => {
    const start = startWoods(3);
    const charmed = { ...start, charms: [true, true, true], tick: 300 };
    expect(drawnWith(drawWoods, charmed).texts()).toContain(
      "SWIFT FEET  THE WHOLE MAP  METAPLASMA MAGNET",
    );
    expect(drawnWith(drawWoods, charmed).drawn.length).toBeGreaterThan(
      drawnWith(drawWoods, { ...charmed, charms: [true, false, true] }).drawn
        .length,
    );
    const seen = start.level.charms[0] ?? { x: 1, y: 1 };
    const close = { ...start, x: seen.x * 256 + 128, y: seen.y * 256 + 128 };
    expect(
      sound(drawWoods, [
        close,
        { ...close, angle: 256 },
        { ...close, tick: 7 },
      ]),
    ).toBe(true);
  });
});

describe("the guild's charms, metaplasma and challenges on the screen", () => {
  it("shows a secret charm only when Glitchy is close, and the metaplasma gathered and the charms held in a corner", () => {
    const spot = charmSpots[2] ?? { x: 1, y: 1 };
    const near = { ...startCastle(2), tick: 6, x: spot.x, y: spot.y + 1 };
    const used = {
      ...near,
      charms: [false, false, true],
      charmsUsed: [false, false, true],
    };
    expect(drawnWith(drawCastle, near).drawn.length).toBeGreaterThan(
      drawnWith(drawCastle, used).drawn.length,
    );
    const far = { ...near, x: spot.x - 3 };
    expect(drawnWith(drawCastle, far).drawn.length).toBe(
      drawnWith(drawCastle, { ...far, ...used, x: far.x }).drawn.length,
    );
    const held = {
      ...near,
      charms: [true, true, true],
      charmsUsed: [false, true, false],
      plasma: { ...near.plasma, gathered: 42 },
    };
    expect(drawnWith(drawCastle, held).texts()).toContain("PLASMA 42");
    expect(sound(drawCastle, [near, held, { ...near, tick: 0 }])).toBe(true);
  });

  it("shows a charm's help, an evade getting ready, the keeper about to grumble, and each keeper's own place", () => {
    const base = {
      ...startCastle(3),
      charms: [true, true, true],
      friends: [true, true, true, true],
    };
    const starred = act(act(challenge(base, 1), charmMove), charmMove);
    const shielded = act(starred, charmMove);
    expect(drawnWith(drawCastle, shielded).texts()).toContain("STAR SHIELD 2");
    const evading = act(challenge(base, 0), evadeMove);
    expect(drawnWith(drawCastle, evading).texts()).toEqual(
      expect.arrayContaining([
        "GLITCHY'S GUILD GETS READY TO DODGE!",
        "EVADING",
      ]),
    );
    const shown = perform(challenge(base, 2));
    expect(
      drawnWith(drawCastle, {
        ...shown,
        tick: shown.tick + showTicks - 5,
      }).texts(),
    ).toContain("TOWER GUARD IS ABOUT TO GRUMBLE...");
    const places = [0, 1, 2, 3].map((foe) =>
      drawnWith(drawCastle, challenge(base, foe)).stops.join(),
    );
    expect(new Set(places).size).toBe(4);
    expect(
      sound(
        drawCastle,
        [0, 1, 2, 3].flatMap((foe) => [
          challenge(base, foe),
          { ...perform(challenge(base, foe)), tick: 50 },
        ]),
      ),
    ).toBe(true);
  });
});
