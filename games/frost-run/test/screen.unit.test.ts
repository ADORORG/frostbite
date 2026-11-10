// @vitest-environment jsdom
import { Scene } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { totals } from "../src/rules/round.ts";
import { HazardsView } from "../src/screen/hazards.ts";
import type { Models } from "../src/screen/models/load.ts";
import { GameScreen } from "../src/screen/screen.ts";
import { hunter, playBot, strong } from "./support/bot.ts";
import { fakeMoment, fakeStage, frames, models } from "./support/view.ts";

let all: Models;
beforeAll(async () => {
  all = await models();
}, 60_000);

const play = (lead: number, style = strong, seed = 1000 + lead) => {
  const { renderer, stage } = fakeStage();
  const moment = fakeMoment();
  const screen = new GameScreen(stage, all, moment, () => false);
  const { inputs, state } = playBot(seed, lead, style);
  screen.begin(lead);
  let shown = 0;
  for (const [before, now] of frames(seed, inputs)) {
    screen.show(1 / 60, { before, now, share: 0.5 });
    shown += 1;
  }
  return { moment, renderer, screen, shown, stage, state };
};

describe("the 3D screen", () => {
  it("shows the hero select, turning to each hero, and draws a frame each time", () => {
    const { renderer, stage } = fakeStage();
    const screen = new GameScreen(stage, all, fakeMoment(), () => false);
    const looks: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      screen.select(index);
      for (let frame = 0; frame < 30; frame += 1) screen.show(1 / 30, null);
      looks.push(stage.camera.position.toArray().map(Math.round).join());
    }
    expect(renderer.render).toHaveBeenCalledTimes(180);
    expect(new Set(looks).size).toBeGreaterThan(1);
    expect(screen.snapshot()).toMatch(/^data:image\/png/u);
  });

  it("frames the select's hero in the room its card leaves, by shifting the lens, and lets go of the shift for a run", () => {
    const { stage } = fakeStage();
    const screen = new GameScreen(stage, all, fakeMoment(), () => false);
    screen.select(0);
    // Room to the left (a wide screen with the select down the right): the view is shifted so the hero stands left of the middle.
    screen.frame({ height: 0.6, x: 0.3, y: 0.5 });
    for (let frame = 0; frame < 120; frame += 1) screen.show(1 / 30, null);
    const view = stage.camera.view;
    expect(view?.enabled).toBe(true);
    expect(view?.offsetX ?? 0).toBeGreaterThan(0);
    const roomy = stage.camera.position.z;
    // A smaller room: the camera stands further back, so the hero fits it.
    screen.frame({ height: 0.15, x: 0.5, y: 0.4 });
    for (let frame = 0; frame < 240; frame += 1) screen.show(1 / 30, null);
    expect(stage.camera.position.z).toBeGreaterThan(roomy);
    expect(stage.camera.view?.offsetY ?? 0).toBeGreaterThan(0);
    // A run has the whole screen: the shift eases away and is cleared.
    screen.begin(0);
    for (let frame = 0; frame < 240; frame += 1) screen.show(1 / 30, null);
    expect(stage.camera.view?.enabled ?? false).toBe(false);
  });

  it("plays a whole run: the orange flash for each crystal and for nothing else, a sound for each take", () => {
    const { moment, shown, state } = play(4);
    expect(shown).toBeGreaterThan(1000);
    expect(state.won).toBe(true);
    expect(moment.flash).toHaveBeenCalledTimes(totals(state.tallies).crystal);
    const sounds = moment.sfx.mock.calls.map(([name]) => name);
    for (const name of ["crystal", "egg", "key", "roundStart", "roundClear"])
      expect(sounds).toContain(name);
  });

  it("plays every hero through the rounds, the hits and the smashes, and back to the select", () => {
    for (let lead = 0; lead < 4; lead += 1) {
      const { moment, screen } = play(lead, lead % 2 === 0 ? hunter : strong);
      expect(moment.sfx).toHaveBeenCalled();
      screen.select(lead);
      screen.show(1 / 60, null);
    }
    const { moment } = play(1, hunter, 7919);
    const sounds = moment.sfx.mock.calls.map(([name]) => name);
    expect(sounds).toContain("crush");
    expect(sounds).toContain("bolt");
  });

  it("follows a lower quality for its snow when frames come slowly", () => {
    const { stage } = fakeStage();
    new GameScreen(stage, all, fakeMoment(), () => true);
    const before = stage.quality().level;
    for (let frame = 0; frame < 200; frame += 1) stage.frameTook(60);
    expect(stage.quality().level).toBeLessThan(before);
  });

  it("takes everything thrown off the stage when a round ends, with its shadows and warning lines", () => {
    const scene = new Scene();
    const hazards = new HazardsView(scene, all);
    const thrown = {
      bolts: [{ id: 3, until: 90, vx: 0, vy: -250, x: 0, y: 0 }],
      darts: [
        {
          dodged: false,
          fliesAt: 60,
          id: 2,
          range: 20_000,
          travelled: 0,
          vx: 90,
          vy: 0,
          x: -9000,
          y: 500,
        },
      ],
      hazardClock: 30,
      snowballs: [
        {
          big: false,
          hoppedOver: false,
          id: 1,
          nearest: 9000,
          r: 500,
          rollsAt: 0,
          vx: 40,
          vy: 30,
          x: 2000,
          y: -3000,
        },
      ],
    };
    hazards.update(1 / 60, 1, 1, thrown, thrown);
    // A snowball and its shadow, a dart and its warning line, and a bolt.
    expect(scene.children[0]?.children).toHaveLength(5);
    hazards.clear();
    expect(scene.children[0]?.children).toHaveLength(0);
    hazards.update(1 / 60, 1, 1, thrown, thrown);
    expect(scene.children[0]?.children).toHaveLength(5);
  });
});
