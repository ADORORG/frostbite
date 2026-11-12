import { Group, Object3D, PointLight } from "three";

import type { ZoneId } from "../../rules/constants.ts";
import { zoneAt } from "../../rules/geometry.ts";
import { lamps, things } from "../../rules/things.ts";
import { glowing, painted } from "../palette.ts";
import { metres, type Rooms } from "./rooms.ts";
import { ball, block, drum } from "./shapes.ts";

// Everything a hand can touch in the house and the meadow, each built from a few solids, and each answering a touch in its own way: a
// door swings, a drawer slides, a tap runs, a globe spins, a drum bounces, a plant sways and blooms, a screen lights, a seat glows, the
// traffic light cycles. Touched or not, on or off, comes from the rules; how it moves is the view's alone.
type Kind =
  | "bounce"
  | "cabinet"
  | "flow"
  | "screen"
  | "seat"
  | "signal"
  | "spinner"
  | "sway";

interface Spec extends Stood {
  readonly accent: string;
  readonly colour: string;
  readonly kind: Kind;
  readonly lift: number;
  readonly size: readonly [number, number, number];
}

// How a thing stands where the rules have it: turned (its front is +z unturned), moved a little (to sit on the box the rules block
// for it), and on a small stand of its own where it is lifted with nothing under it. A seat the furniture already draws is not drawn
// again (`drawn` false): the couch, the beds, the armchair, the bench, the swing.
interface Stood {
  readonly drawn?: boolean;
  readonly shift?: readonly [number, number];
  readonly stand?: boolean;
  readonly turn?: number;
}

const spec = (
  kind: Kind,
  size: readonly [number, number, number],
  colour: string,
  accent = "#ffc75a",
  lift = 0,
  stood: Stood = {},
): Spec => ({ accent, colour, kind, lift, size, ...stood });

const quarter = Math.PI / 2;
const furnished = spec("seat", [1, 1, 1], "#999999", "#ffc75a", 0, {
  drawn: false,
});

const specs: Readonly<Record<string, Spec>> = {
  armchair: furnished,
  bench: furnished,
  bigbed: furnished,
  bluebells: spec("sway", [1.2, 0.6, 1.2], "#4f6fd8", "#9fb6ff"),
  books: spec("bounce", [0.3, 0.35, 0.2], "#c0493a", "#ffc75a", 1.2),
  chair: spec("seat", [0.44, 0.46, 0.44], "#d79b4a", "#ffc75a", 0, {
    turn: quarter,
  }),
  clock: spec("spinner", [0.45, 0.45, 0.08], "#c99a52", "#2a1b10", 1.9),
  coats: spec("sway", [0.8, 1.6, 0.3], "#7d5a8c", "#e0b45a"),
  couch: furnished,
  curtain: spec("sway", [1.6, 2.4, 0.06], "#c0577a", "#ffd27a"),
  drum: spec("bounce", [0.45, 0.35, 0.45], "#d94f2f", "#ffe4b0"),
  fridge: spec("cabinet", [0.9, 2.0, 0.7], "#e9e6df", "#bfe9ff", 0, {
    shift: [-0.1, 0],
    turn: quarter,
  }),
  globe: spec("spinner", [0.35, 0.35, 0.35], "#2f8fa6", "#7bd17b", 0.75, {
    stand: true,
  }),
  hallplant: spec("sway", [0.5, 1.4, 0.5], "#3f8a4a", "#f2c14e"),
  ice: spec("flow", [0.3, 0.4, 0.3], "#cfe8f2", "#e8fbff", 0.92),
  juice: spec("flow", [0.18, 0.3, 0.18], "#f2a33a", "#ffb84a", 0.95),
  kaibed: furnished,
  monitor: spec("screen", [0.6, 0.4, 0.05], "#1a1d24", "#7fd0ff", 0.78),
  musicbox: spec("spinner", [0.25, 0.15, 0.2], "#b23a6a", "#ffd27a", 0.75, {
    stand: true,
  }),
  photos: spec("screen", [1.2, 0.8, 0.05], "#6b4a2c", "#ffd9a0", 1.5),
  plant: spec("sway", [0.45, 1.2, 0.45], "#2f7d4f", "#ff9ec9"),
  poppies: spec("sway", [1.4, 0.6, 1.4], "#d8402f", "#ffcf5a"),
  postbox: spec("cabinet", [0.45, 1.2, 0.45], "#3a6fb5", "#ffc75a"),
  projector: spec("spinner", [0.3, 0.3, 0.3], "#2b2f6e", "#fff3c4", 0.05),
  records: spec("spinner", [0.42, 0.12, 0.42], "#1b1b1b", "#d24a4a", 0.7, {
    stand: true,
  }),
  rocket: spec("bounce", [0.25, 0.65, 0.25], "#e85d4a", "#ffd27a"),
  swing: furnished,
  tap: spec("flow", [0.18, 0.4, 0.18], "#b9c4cc", "#9fdcff", 0.92),
  toaster: spec("bounce", [0.3, 0.2, 0.2], "#c7c9cc", "#ffb84a", 0.92),
  toychest: spec("cabinet", [1.0, 0.6, 0.6], "#b5793a", "#ffd27a", 0, {
    shift: [0, -0.3],
  }),
  trafficlight: spec("signal", [0.3, 3.2, 0.3], "#2f3138", "#ff5a4a"),
  vanity: spec("cabinet", [0.9, 0.8, 0.45], "#d8b48a", "#ffd27a", 0, {
    shift: [-0.075, 0],
    turn: quarter,
  }),
  wardrobe: spec("cabinet", [1.6, 2.1, 0.6], "#8a5a3a", "#ffd27a", 0, {
    shift: [0.3, 0],
    turn: -quarter,
  }),
  whiteboard: spec("screen", [1.4, 0.9, 0.05], "#f4f4f0", "#ffcf5a", 1.2),
  window: spec("screen", [1.0, 1.2, 0.06], "#7aa6c9", "#ffe9a8", 1.4),
  zorabed: furnished,
};

export interface Thing {
  readonly group: Object3D;
  update(on: boolean, touched: boolean, time: number, dt: number): void;
}

function build(id: string, zone: ZoneId, rooms: Rooms): Thing {
  const look = specs[id] ?? spec("bounce", [0.3, 0.3, 0.3], "#999999");
  const [w, h, d] = look.size;
  const body = painted(rooms.tones[zone], {
    color: look.colour,
  });
  const accent = glowing(look.accent, 0.1);
  const group = new Group();
  const moving = new Group();
  moving.position.set(look.shift?.[0] ?? 0, look.lift, look.shift?.[1] ?? 0);
  moving.rotation.y = look.turn ?? 0;
  group.add(moving);
  let swing = 0;
  let kick = 0;
  let wasOn = false;
  if (look.drawn === false) return { group, update: () => undefined };
  // A stand of its own for what would otherwise hang in the air: a small round table on one leg.
  if (look.stand === true)
    group.add(
      drum(body, 0.19, 0.04, [0, look.lift - 0.03, 0], 16),
      drum(body, 0.035, look.lift - 0.05, [0, (look.lift - 0.05) / 2, 0], 8),
      drum(body, 0.13, 0.03, [0, 0.015, 0], 12),
    );
  if (look.kind === "cabinet" || look.kind === "screen")
    moving.add(block(body, [w, h, d], [0, h / 2, 0]));
  // A chair: a seat on four legs, with a back (it faces +z unturned).
  if (look.kind === "seat") {
    moving.add(
      block(body, [w, 0.05, d], [0, h - 0.025, 0]),
      block(body, [w, 0.5, 0.05], [0, h + 0.25, -d / 2 + 0.025]),
    );
    for (const x of [1, -1])
      for (const z of [1, -1])
        moving.add(
          block(
            body,
            [0.05, h - 0.05, 0.05],
            [x * (w / 2 - 0.03), (h - 0.05) / 2, z * (d / 2 - 0.03)],
          ),
        );
  }
  if (look.kind === "cabinet")
    moving.add(
      block(accent, [w * 0.94, h * 0.9, 0.04], [0, h / 2, d / 2 + 0.03]),
    );
  if (look.kind === "screen")
    moving.add(
      block(accent, [w * 0.9, h * 0.86, 0.02], [0, h / 2, d / 2 + 0.02]),
    );
  if (look.kind === "spinner") {
    moving.add(drum(body, w * 0.35, 0.06, [0, 0.03, 0]));
    moving.add(ball(accent, w * 0.5, [0, w * 0.55, 0]));
  }
  if (look.kind === "bounce") moving.add(block(body, [w, h, d], [0, h / 2, 0]));
  if (look.kind === "flow") {
    moving.add(drum(body, w * 0.5, h, [0, h / 2, 0], 14));
    const stream = drum(
      glowing(look.accent, 0.8),
      w * 0.12,
      0.5,
      [w * 0.3, -0.1, 0],
      8,
    );
    stream.name = "stream";
    moving.add(stream);
  }
  if (look.kind === "sway") {
    moving.add(drum(body, w * 0.08, h, [0, h / 2, 0], 6));
    for (let leaf = 0; leaf < 5; leaf += 1)
      moving.add(
        ball(leaf % 2 === 0 ? body : accent, w * 0.32, [
          Math.cos(leaf * 1.3) * w * 0.35,
          h * (0.5 + leaf * 0.1),
          Math.sin(leaf * 1.3) * w * 0.35,
        ]),
      );
  }
  if (look.kind === "signal") {
    moving.add(drum(body, 0.08, h, [0, h / 2, 0], 8));
    moving.add(block(body, [0.36, 1.0, 0.3], [0, h - 0.4, 0]));
    for (const [index, colour] of ["#ff4a3a", "#ffc23a", "#3ad26a"].entries())
      moving.add(
        ball(glowing(colour, 0.2), 0.1, [0, h - 0.1 - index * 0.3, 0.16]),
      );
  }
  return {
    group,
    update(on, touched, time, dt) {
      if (on !== wasOn) kick = 1;
      wasOn = on;
      kick = Math.max(0, kick - dt * 1.6);
      swing += ((on ? 1 : 0) - swing) * (1 - Math.exp(-4 * dt));
      accent.emissiveIntensity = touched ? 0.15 + swing * 1.6 : 0.05;
      const stream = moving.getObjectByName("stream");
      if (stream !== undefined) stream.visible = on;
      if (look.kind === "cabinet") {
        const door = moving.children[1];
        if (door !== undefined) door.rotation.y = -swing * 1.3;
      } else if (look.kind === "spinner") moving.rotation.y += dt * swing * 3;
      else if (look.kind === "bounce")
        moving.position.y =
          look.lift + Math.abs(Math.sin(kick * Math.PI * 3)) * kick * 0.25;
      else if (look.kind === "sway")
        moving.rotation.z =
          Math.sin(time * 2.2) * (0.03 + kick * 0.25) + swing * 0.05;
      else if (look.kind === "signal")
        moving.children.slice(2).forEach((light, index) => {
          light.visible = !on || Math.floor(time) % 3 === index;
        });
    },
  };
}

export interface ThingSet {
  readonly group: Group;
  update(
    state: {
      readonly lamps: readonly boolean[];
      readonly thingsOn: readonly boolean[];
      readonly thingsTouched: readonly boolean[];
    },
    time: number,
    dt: number,
  ): void;
}

// Every thing and every lamp, at its place on the plan. A lamp is a stem, a shade and a bulb, with a real light where `lights` allows.
export function buildThings(rooms: Rooms, lights: boolean): ThingSet {
  const group = new Group();
  const built = things.map((thing) => {
    const made = build(thing.id, zoneAt(thing), rooms);
    made.group.position.set(metres(thing.x), 0, metres(thing.z));
    group.add(made.group);
    return made;
  });
  const bulbs = lamps.map((lamp) => {
    const zone = zoneAt(lamp);
    const holder = new Group();
    holder.position.set(metres(lamp.x), 0, metres(lamp.z));
    holder.add(
      drum(
        painted(rooms.tones[zone], {
          color: "#c9a25a",
        }),
        0.03,
        1.5,
        [0, 0.75, 0],
        8,
      ),
    );
    const bulb = glowing("#ffd27a", 0.05);
    holder.add(ball(bulb, 0.16, [0, 1.6, 0]));
    const light = lights ? new PointLight("#ffc77a", 0, 9, 1.6) : null;
    if (light !== null) {
      light.position.y = 1.6;
      holder.add(light);
    }
    group.add(holder);
    return { bulb, light };
  });
  return {
    group,
    update(state, time, dt) {
      built.forEach((thing, index) =>
        thing.update(
          state.thingsOn[index] === true,
          state.thingsTouched[index] === true,
          time,
          dt,
        ),
      );
      bulbs.forEach(({ bulb, light }, index) => {
        const on = state.lamps[index] === true;
        bulb.emissiveIntensity +=
          ((on ? 3 : 0.05) - bulb.emissiveIntensity) * Math.min(1, dt * 5);
        if (light !== null) light.intensity = bulb.emissiveIntensity * 2.2;
      });
    },
  };
}
