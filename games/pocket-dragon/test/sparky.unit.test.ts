import { Scene } from "three";
import { describe, expect, it } from "vitest";

import { flightSounds } from "../src/feedback-base.ts";
import { baseTile } from "../src/rules/woods/base-map.ts";
import {
  nookAhead,
  nookEggs,
  nookPlasma,
  nooks,
  sparkyTicks,
} from "../src/rules/woods/sparky.ts";
import type { Base, WoodsState } from "../src/rules/woods/types.ts";
import { drawScene } from "../src/screen/woods-scenes.ts";
import { flatSparky, sparkyAt, sparkyHud } from "../src/screen/sparky-look.ts";
import { colour } from "../src/screen/palette.ts";
import { makeSparky, showSparky } from "../src/three/sparky.ts";
import { surface } from "./support/canvas.ts";
import {
  baseOf,
  maze,
  outside,
  playFor,
  press,
} from "./support/woods-outside.ts";

const at = (x: number, y: number, facing: Base["facing"]) =>
  outside({ facing, guards: [], x, y });
const words = (state: WoodsState) => {
  const screen = surface();
  sparkyHud(screen.context, state, baseOf(state));
  return [...new Set(screen.texts())];
};

describe("Sparky", () => {
  it("knows six nooks too small for a dragon, in trees, behind a torch and in a pillar", () => {
    expect(nooks).toHaveLength(6);
    for (const nook of nooks)
      expect(["T", "t", "p"]).toContain(baseTile(nook.x, nook.y));
    expect(nookAhead(baseOf(at(8, 15, "right")))).toBe(0);
    expect(nookAhead(baseOf(at(24, 22, "left")))).toBe(2);
    expect(nookAhead(baseOf(at(8, 15, "up")))).toBe(-1);
    expect(nookAhead(baseOf(outside({ facing: "down", x: 8, y: 11 })))).toBe(4);
    expect(
      nookAhead({
        ...baseOf(at(8, 15, "right")),
        nooksTaken: [true, false, false, false, false, false],
      }),
    ).toBe(-1);
  });

  it("zips into a nook and back with what hides there: a food, eggs for the launcher, or metaplasma", () => {
    const sent = press(at(8, 15, "right"), "help");
    expect(baseOf(sent).trip).toEqual({ nook: 0, start: sent.tick });
    expect(press(press(sent, "help", false), "help").base).toEqual(sent.base);
    const back = playFor(sent, sparkyTicks);
    expect(baseOf(back).trip).toBeNull();
    expect(baseOf(back).nooksTaken[0]).toBe(true);
    expect(back.powers.pack.mushroom).toBe(1);
    expect(back.found?.kind).toBe("sparky");
    const eggs = playFor(press(at(24, 22, "left"), "help"), sparkyTicks);
    expect(baseOf(eggs).ammo).toBe(baseOf(at(24, 22, "left")).ammo + nookEggs);
    const glow = playFor(press(at(5, 16, "left"), "help"), sparkyTicks);
    expect(glow.plasma.gathered).toBe(maze.plasma.gathered + nookPlasma);
    expect(press(at(8, 15, "up"), "help").found?.kind).toBe("empty");
  });

  it("is drawn: a glint in every nook left, the atom by Glitchy or along its trip, and a word under the hearts", () => {
    const ready = at(8, 15, "right");
    expect(words(ready)).toEqual(["H: SPARKY CAN REACH IT!"]);
    expect(words(at(8, 15, "up"))).toEqual(["H: SPARKY"]);
    const sent = press(ready, "help");
    expect(words(sent)).toEqual(["SPARKY IS OFF!"]);
    const rest = { x: 8, y: 15 };
    const halfway = sparkyAt(baseOf(sent), sent.tick + sparkyTicks / 2, rest);
    expect(halfway).toEqual({ x: 9, y: 15 });
    expect(sparkyAt(baseOf(ready), 0, rest)).toBe(rest);
    const screen = surface();
    flatSparky(
      screen.context,
      baseOf(ready),
      0,
      { x: 0, y: 0 },
      { x: 128, y: 240 },
    );
    expect(
      screen.drawn.filter((block) => block.fill === colour.fireHot).length,
    ).toBeGreaterThan(2);
    const scene = surface();
    const rising = {
      ...ready,
      scene: { id: "rise" as const, start: 0 },
      tick: 150,
    };
    drawScene(scene.context, rising, baseOf(rising), true);
    expect(scene.texts()).toContain("SPARKY");
  });

  it("glows in three dimensions, flies to the nook on a trip, and is heard setting off and coming back", () => {
    const world = new Scene();
    const model = makeSparky(world);
    const sent = press(at(8, 15, "right"), "help");
    showSparky(model, sent, baseOf(sent), [8.5, 0, 15.5], 0, 1);
    const resting = model.root.position.x;
    const far = { ...sent, tick: sent.tick + sparkyTicks / 2 };
    for (let frame = 0; frame < 30; frame += 1)
      showSparky(model, far, baseOf(far), [8.5, 0, 15.5], frame / 30, 1 / 30);
    expect(model.root.position.x).toBeGreaterThan(resting);
    const back = playFor(sent, sparkyTicks);
    showSparky(model, back, baseOf(back), [8.5, 0, 15.5], 1, 0.1);
    expect(model.glints[0]?.visible).toBe(false);
    expect(model.glints[1]?.visible).toBe(true);
    expect(flightSounds(at(8, 15, "right"), sent)).toEqual(["whoosh"]);
    expect(flightSounds(playFor(sent, sparkyTicks - 1), back)).toEqual([
      "secret",
    ]);
    expect(
      flightSounds(at(8, 15, "up"), press(at(8, 15, "up"), "help")),
    ).toEqual(["talk"]);
  });
});
