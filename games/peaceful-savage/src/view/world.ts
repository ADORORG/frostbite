import { Group, Vector3 } from "three";

import { zoneIds } from "../rules/constants.ts";
import { stepOf } from "../rules/moment.ts";
import type { PlayState } from "../rules/types.ts";
import { goalOf, routeOf } from "./compass.ts";
import { buildEffects } from "./fx.ts";
import { buildSky } from "./sky.ts";
import { buildFurniture } from "./world/furniture.ts";
import { buildGathered } from "./world/gather.ts";
import { buildGreys } from "./world/greys.ts";
import { buildHouse } from "./world/house.ts";
import { buildAncestors } from "./world/ancestors.ts";
import { buildCrowd } from "./world/crowd.ts";
import { beatsPerSecond, buildStage } from "./world/stage.ts";
import { buildCoil } from "./world/coil.ts";
import { buildGarden } from "./world/garden.ts";
import { buildMeadow, groundAt } from "./world/meadow.ts";
import { createRooms } from "./world/rooms.ts";
import { buildSerpent } from "./world/serpent.ts";
import { buildSparky } from "./world/sparky.ts";
import { buildThings } from "./world/things.ts";
import { flareOf } from "./farewell.ts";
import { buildTree } from "./world/tree.ts";

// Everything in the world but the family: the house and its furniture and things, the meadow, the ancestor tree, the grey ones, the giant
// snake on the hill, Sparky, what there is to gather, and the gold line-work of the magic. Each room's colour eases toward what the rules
// say; the tree is lit as the whole house is; a ring of gold spreads from each healing, finding and lighting.
export interface WorldFrame {
  readonly dt: number;
  // The lead's hands (for their gold trails), and where the lead stands, how tall and which way they face, if anyone leads.
  readonly hands: readonly Vector3[];
  readonly lead: {
    readonly at: Vector3;
    readonly height: number;
    readonly yaw: number;
  } | null;
  readonly state: PlayState;
  readonly time: number;
  // How the run ended, if it has, and the seconds since: the tree lit, or the lead gone grey.
  readonly ending: Ending;
  // Where the farewell wants Sparky, if anywhere (null for the lead's shoulder).
  readonly sparkyAt: Vector3 | null;
  // Where the one the player moves on the stage stands, for the ring under them.
  readonly marked?: Vector3 | null;
}

export interface Ending {
  readonly kind: "grey" | "lit" | null;
  readonly since: number;
}

export interface World {
  readonly group: Group;
  // How warm the world is now, from grey (0) to full colour (1).
  readonly warmth: number;
  // Where the giant snake gathers, for the camera.
  readonly snake: Vector3;
  update(frame: WorldFrame): void;
}

const flourishes = new Set([
  "found",
  "healed",
  "jackets",
  "level",
  "lit",
  "mirror",
  "power",
  "sparky",
  "thread",
]);

export function buildWorld(amount: number, lights: boolean): World {
  const group = new Group();
  const rooms = createRooms();
  const house = buildHouse(rooms);
  const furniture = buildFurniture(rooms, lights);
  const things = buildThings(rooms, lights);
  const meadow = buildMeadow(rooms.tones.meadow, amount);
  const tree = buildTree();
  tree.group.position.set(0, 0, 6);
  const greys = buildGreys();
  const serpent = buildSerpent(Math.round(1200 * amount) + 200);
  const sparky = buildSparky(lights);
  const gathered = buildGathered();
  const effects = buildEffects();
  const garden = buildGarden(rooms.tones.meadow);
  const coil = buildCoil();
  const ancestors = buildAncestors();
  const stage = buildStage(rooms.tones.meadow);
  const crowd = buildCrowd();
  const sky = buildSky();
  group.add(sky.mesh);
  for (const part of [
    house,
    furniture,
    things,
    meadow,
    tree,
    greys,
    serpent,
    sparky,
    gathered,
    effects,
    garden,
    coil,
    ancestors,
    stage,
    crowd,
  ])
    group.add(part.group);
  const snake = new Vector3(0, groundAt(0, -18) + 3.4, -18);
  const lamp = new Vector3(2.05, 1.3, 11.8);
  let warmth = 0;
  let heard = -1;
  let rise = 0;
  let gold = 0;
  let route: Vector3[] | null = null;
  let routed = -1;
  return {
    group,
    snake,
    update(frame) {
      const { state, time, dt } = frame;
      rooms.ease(state.colour, dt);
      const mean =
        state.colour.reduce((sum, one) => sum + one, 0) /
        Math.max(1, zoneIds.length);
      warmth +=
        ((state.cause === "lit" ? 1 : mean / 100) - warmth) *
        (1 - Math.exp(-1.5 * dt));
      sky.update(warmth, time);
      furniture.update(state, time, dt);
      things.update(state, time, dt);
      meadow.update(time);
      // Never quite lit until the snake is healed: its third strand lights fully only then, at home.
      tree.update(
        state.cause === "lit"
          ? 1
          : Math.min(0.75, Math.max(0, (mean - 8) / 92)),
        time,
        dt,
        flareOf(frame.ending),
      );
      const vision = state.tick < state.visionUntil;
      greys.update(state, vision, time, dt);
      gathered.update(state, vision, time);
      // The snake gathers when the finale begins, warms to gold through it, and lets its figures go when the tree is lit.
      const finale = state.moment?.kind === "finale";
      const steps =
        finale && state.moment !== null ? state.moment.step / 11 : 0;
      rise +=
        ((finale || state.cause === "lit" ? 1 : 0) - rise) *
        (1 - Math.exp(-0.8 * dt));
      gold +=
        ((state.cause === "lit" ? 1 : steps) - gold) *
        (1 - Math.exp(-1.2 * dt));
      const ending = frame.ending;
      serpent.update(
        rise,
        gold,
        ending.kind === "lit" ? ending.since : 0,
        time,
      );
      // The ones it let go come home to the tree, and greet the family; and then the show, with them all round the stage.
      const lit = ending.kind === "lit" ? ending.since : null;
      ancestors.update(lit, time);
      stage.update(lit, time, frame.marked ?? null);
      crowd.update(lit, time, (time * beatsPerSecond) % 1);
      // A lead gone grey is taken gently into a coil of grey figures.
      coil.update(
        ending.kind === "grey" ? (frame.lead?.at ?? null) : null,
        ending.since,
        time,
      );
      garden.update(state, time);
      // Sparky: forged ring by ring at the lamp, then at the lead's right shoulder, a little ahead and at head height, beside the
      // camera's view of the lead rather than in it.
      const forging = state.moment?.kind === "forge" ? state.moment.step : 0;
      const rings = state.sparky ? 3 : forging;
      const lead = frame.lead;
      const near =
        lead === null
          ? lamp
          : lead.at
              .clone()
              .add(
                new Vector3(
                  -Math.cos(lead.yaw) * 0.32 + Math.sin(lead.yaw) * 0.18,
                  lead.height * 0.9,
                  Math.sin(lead.yaw) * 0.32 + Math.cos(lead.yaw) * 0.18,
                ),
              );
      // Held in the hug, his light is turned down, so it lights the hands that hold him and not the faces above.
      sparky.update(
        rings,
        state.sparky ? (frame.sparkyAt ?? near) : lamp,
        frame.sparkyAt === null ? state.spark / 100 : 0,
        time,
        dt,
      );
      // Savage Vision's thread of gold to where the story goes next, worked out again a few times a second.
      const goal = vision ? goalOf(state) : null;
      if (goal === null) route = null;
      else if (route === null || state.tick - routed >= 8) {
        route = routeOf(state, goal).map((point) =>
          point.setY(groundAt(point.x, point.z) + 0.15),
        );
        routed = state.tick;
      }
      const tracing = stepOf(state)?.kind === "beat";
      effects.update(
        frame.hands,
        tracing,
        route,
        1 - (state.colour[zoneIds.indexOf("office")] ?? 0) / 100,
        time,
        dt,
      );
      const news = state.news;
      if (news !== null && news.tick !== heard) {
        heard = news.tick;
        if (flourishes.has(news.kind) && lead !== null)
          effects.burst(lead.at.clone(), news.kind === "lit" ? 6 : 2);
      }
    },
    get warmth() {
      return warmth;
    },
  };
}
