import { Group } from "three";

import type { PlayState } from "../../rules/types.ts";
import { brushed, glowing, painted } from "../palette.ts";
import type { Rooms } from "./rooms.ts";
import { ball, block, drum, ring } from "./shapes.ts";

// The west wing's furniture. The kitchen: a long counter with a stove (and pancakes once they are made) and a sink, the island with
// Zora's galaxy bowl, the oval table. The children's room: two beds and Kai's desk. Out front, the porch: a deck of boards, a lantern
// either side of the door, and Kai's workbench with his crystal tower (in pieces until it is built again, a level a step).
export interface Wing {
  readonly group: Group;
  update(state: PlayState, time: number, dt: number): void;
}

export function woodFor(rooms: Rooms) {
  return (zone: keyof Rooms["tones"], colour: string, seed: number) =>
    painted(rooms.tones[zone], {
      color: colour,
      map: brushed(colour, seed, 2),
    });
}

export function buildWest(rooms: Rooms): Wing {
  const group = new Group();
  const t = rooms.tones;
  const wood = woodFor(rooms);
  group.add(
    block(wood("kitchen", "#d7b98e", 51), [6.6, 0.9, 0.8], [-8.5, 0.45, 0.5]),
  );
  group.add(
    block(
      painted(t.kitchen, { color: "#f2efe8" }),
      [6.7, 0.06, 0.86],
      [-8.5, 0.93, 0.5],
    ),
  );
  group.add(
    block(
      painted(t.kitchen, { color: "#181a20" }),
      [0.9, 0.03, 0.6],
      [-8, 0.97, 0.5],
    ),
  );
  const flame = glowing("#ff6a2a", 0.2);
  const burner = ring(flame, 0.14, 0.02, [-8, 0.99, 0.5]);
  burner.rotation.x = Math.PI / 2;
  group.add(burner);
  const pancakes = new Group();
  pancakes.add(
    drum(painted(t.kitchen, { color: "#2a2a2e" }), 0.17, 0.04, [0, 0, 0]),
  );
  for (let stack = 0; stack < 3; stack += 1)
    pancakes.add(
      drum(glowing("#e8a64a", 0.25), 0.12, 0.025, [0, 0.03 + stack * 0.026, 0]),
    );
  pancakes.position.set(-8, 1.0, 0.5);
  group.add(pancakes);
  group.add(
    block(wood("kitchen", "#c58a52", 52), [2.6, 0.95, 1.0], [-7.7, 0.475, 3.5]),
  );
  group.add(
    drum(
      painted(t.kitchen, { color: "#d9d4ff" }),
      0.22,
      0.14,
      [-7.7, 1.02, 3.6],
      24,
    ),
  );
  const goo = drum(glowing("#7a4fd8", 0.8), 0.19, 0.02, [-7.7, 1.09, 3.6], 24);
  group.add(goo);
  // The table: an oval, as long and as wide as the rules keep clear for it.
  const table = drum(
    wood("kitchen", "#b07a44", 53),
    1,
    0.06,
    [-5.1, 0.78, 5.6],
    32,
  );
  table.scale.set(0.9, 1, 0.6);
  group.add(table);
  group.add(
    drum(wood("kitchen", "#8a5a33", 54), 0.08, 0.76, [-5.1, 0.38, 5.6], 8),
  );
  for (const [z, colour] of [
    [8.0, "#2a3b7a"],
    [13.1, "#b49ddb"],
  ] as const) {
    group.add(
      block(wood("kids", "#8f6640", 55), [2.0, 0.35, 1.2], [-10.8, 0.18, z]),
    );
    group.add(
      block(
        painted(t.kids, { color: colour }),
        [1.9, 0.22, 1.1],
        [-10.8, 0.45, z],
      ),
    );
    group.add(
      ball(painted(t.kids, { color: "#f4efe6" }), 0.22, [-11.45, 0.6, z]),
    );
  }
  group.add(
    block(wood("kids", "#a8733f", 56), [2.2, 0.8, 0.8], [-4.9, 0.4, 13.4]),
  );
  const tower = new Group();
  const crystal = glowing("#9fe8ff", 0.3);
  for (let level = 0; level < 5; level += 1) {
    const piece = block(
      crystal,
      [0.16 - level * 0.02, 0.18, 0.16 - level * 0.02],
      [0, 0.09 + level * 0.18, 0],
    );
    piece.rotation.y = level * 0.5;
    tower.add(piece);
  }
  // The porch: boards before the front door, a lantern either side of it, Kai's bench by the boards' edge with his tower on it.
  const deck = block(
    wood("meadow", "#9a6a3c", 57),
    [9, 0.08, 3],
    [0, 0.04, -1.5],
  );
  group.add(deck);
  for (const x of [-1.3, 1.3]) {
    group.add(
      drum(wood("meadow", "#4a3020", 58), 0.05, 1.7, [x, 0.85, -0.25], 8),
    );
    group.add(ball(glowing("#ffcf7a", 2.2), 0.13, [x, 1.75, -0.25]));
  }
  group.add(
    block(wood("meadow", "#a8733f", 56), [1.4, 0.8, 0.5], [-2.8, 0.4, -2.55]),
  );
  tower.position.set(-2.8, 0.82, -2.55);
  group.add(tower);
  return {
    group,
    update(state, time, dt) {
      pancakes.visible = state.pancakes;
      flame.emissiveIntensity = state.pancakes
        ? 1.5 + Math.sin(time * 9) * 0.3
        : 0.1;
      goo.rotation.y += dt * 1.5;
      // Kai's tower: in pieces on the boards until it is built again, a level for each step of the building, and glowing once whole;
      // its light goes into his hologram while he builds it over the tower, and glows softer under it once it is made.
      const building = state.moment?.kind === "build" ? state.moment.step : -1;
      const stacked = state.tower ? 5 : ([1, 3, 3, 4][building] ?? 0);
      const kaiHere = state.party.includes("kai") || state.lead === "kai";
      const crowned = state.made.includes("kai") ? 0.9 : 1.8;
      crystal.emissiveIntensity =
        state.moment?.kind === "hologram"
          ? 0.4
          : state.tower
            ? crowned + Math.sin(time * 2) * 0.3
            : kaiHere
              ? 0.5
              : 0.15;
      tower.children.forEach((piece, level) => {
        const up = level < stacked;
        piece.position.x = up ? 0 : Math.sin(level * 2.1) * 0.35;
        piece.position.y = up ? 0.09 + level * 0.18 : 0.05 - 0.75;
      });
    },
  };
}
