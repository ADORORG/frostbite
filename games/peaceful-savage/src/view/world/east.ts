import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PointLight,
  Quaternion,
  Vector3,
} from "three";

import { stool } from "../body/poses.ts";
import { glowing, noise, painted } from "../palette.ts";
import { groundAt } from "./meadow.ts";
import type { Rooms } from "./rooms.ts";
import { ball, block, drum } from "./shapes.ts";
import { type Wing, woodFor } from "./west.ts";

// The east wing's furniture and the hall's. The office: Daddy's desk and its locked drawer, the shelves of books, the armchair. The
// parents' room: the round bed and Mama's loom (strung with each thread as it is gathered). The hall: the couch, the little table with the
// Latimer lamp (the light that would not go out), the deck of a hundred cards by the tree. In the meadow, the bench.
const bookColours = [
  "#7a2f3a",
  "#2f5a7a",
  "#7a6a2f",
  "#3a7a4a",
  "#5a3a7a",
  "#a0602a",
];

function books(rooms: Rooms): InstancedMesh {
  const random = noise(61);
  const shelf = new InstancedMesh(
    block(
      painted(rooms.tones.office, { color: "#ffffff" }),
      [1, 1, 1],
      [0, 0, 0],
    ).geometry,
    painted(rooms.tones.office, { color: "#ffffff" }),
    90,
  );
  const matrix = new Matrix4();
  for (let at = 0; at < 90; at += 1) {
    const row = at % 5;
    const along = Math.floor(at / 5);
    matrix.compose(
      new Vector3(6.85 + along * 0.25, 0.45 + row * 0.5, 6.58),
      new Quaternion(),
      new Vector3(0.06 + random() * 0.04, 0.32 + random() * 0.08, 0.1),
    );
    shelf.setMatrixAt(at, matrix);
    shelf.setColorAt(
      at,
      new Color(
        bookColours[Math.floor(random() * bookColours.length)] ?? "#7a2f3a",
      ),
    );
  }
  return shelf;
}

export function buildEast(rooms: Rooms, lights: boolean): Wing {
  const group = new Group();
  const t = rooms.tones;
  const wood = woodFor(rooms);
  group.add(
    block(wood("office", "#6b4426", 57), [2.8, 0.08, 0.8], [8.4, 0.76, 2.8]),
  );
  for (const x of [7.15, 9.65])
    group.add(
      block(wood("office", "#5a381f", 58), [0.3, 0.72, 0.75], [x, 0.36, 2.8]),
    );
  const drawer = block(
    wood("office", "#7a4e2c", 59),
    [0.6, 0.18, 0.7],
    [8.4, 0.6, 2.8],
  );
  const lock = glowing("#ffc75a", 0.4);
  drawer.add(ball(lock, 0.03, [0, 0, 0.36]));
  group.add(drawer);
  group.add(
    block(wood("office", "#4c2f1a", 60), [4.4, 2.6, 0.3], [9.1, 1.3, 6.75]),
  );
  group.add(books(rooms));
  const plum = painted(t.office, { color: "#7a3f6e" });
  group.add(
    block(plum, [1.0, 0.5, 1.0], [4.5, 0.25, 5.9]),
    block(plum, [1.0, 0.9, 0.25], [4.5, 0.6, 6.3]),
  );
  group.add(
    drum(
      painted(t.parents, { color: "#e7c9e8" }),
      1.6,
      0.5,
      [9.8, 0.25, 11.6],
      40,
    ),
  );
  group.add(
    drum(
      painted(t.parents, { color: "#9a5f8a" }),
      1.62,
      0.08,
      [9.8, 0.52, 11.6],
      40,
    ),
  );
  const loom = new Group();
  const frame = wood("parents", "#9a6a3c", 62);
  loom.add(
    block(frame, [0.1, 1.8, 0.1], [-0.9, 0.9, 0]),
    block(frame, [0.1, 1.8, 0.1], [0.9, 0.9, 0]),
  );
  loom.add(block(frame, [1.9, 0.1, 0.1], [0, 1.8, 0]));
  const threads = Array.from({ length: 6 }, (_, index) => {
    const thread = drum(
      glowing("#ffcf5a", 2.2),
      0.012,
      1.6,
      [-0.6 + index * 0.24, 0.95, 0],
      6,
    );
    thread.visible = false;
    loom.add(thread);
    return thread;
  });
  loom.position.set(5.2, 0, 13.2);
  group.add(loom);
  const couch = painted(t.hall, { color: "#3c6f8f" });
  group.add(
    block(couch, [4.8, 0.5, 0.8], [0, 0.25, 13.3]),
    block(couch, [4.8, 0.7, 0.25], [0, 0.6, 13.6]),
  );
  group.add(
    drum(wood("hall", "#7a5030", 63), 0.38, 0.65, [2.05, 0.33, 11.8], 18),
  );
  const latimer = new Group();
  const brass = glowing("#d9a640", 0.4);
  latimer.add(
    drum(brass, 0.13, 0.04, [0, 0.02, 0]),
    drum(brass, 0.025, 0.4, [0, 0.22, 0], 8),
  );
  const shade = new Mesh(
    ball(brass, 0.2, [0, 0, 0]).geometry,
    glowing("#e0b04a", 0.6),
  );
  shade.scale.set(1, 0.6, 1);
  shade.position.y = 0.48;
  const filament = glowing("#fff0b8", 4);
  latimer.add(shade, ball(filament, 0.05, [0, 0.4, 0]));
  latimer.position.set(2.05, 0.66, 11.8);
  group.add(latimer);
  if (lights) {
    const lamp = new PointLight("#ffcf7a", 2, 6, 1.6);
    lamp.position.set(2.05, 1.1, 11.8);
    group.add(lamp);
  }
  group.add(
    block(wood("hall", "#6b4426", 64), [0.5, 1.0, 0.8], [2.55, 0.5, 6.0]),
  );
  const card = block(
    glowing("#ffd27a", 0.8),
    [0.02, 0.32, 0.22],
    [2.3, 1.35, 6.0],
  );
  group.add(card);
  // The bench in the meadow, on the ground as it lies there, its back to the house.
  const lawn = groundAt(-3.2, -4.15);
  const planks = wood("meadow", "#8a5a33", 65);
  group.add(
    block(planks, [1.6, 0.45, 0.5], [-3.2, lawn + 0.225, -4.15]),
    block(planks, [1.6, 0.42, 0.06], [-3.2, lawn + 0.66, -3.93]),
  );
  // Daddy's stool: under him at his desk until he is found (or leads), pushed in under the desk after.
  const stoolWood = wood("office", "#7a5030", 66);
  const seat = new Group();
  seat.add(
    drum(stoolWood, 0.19, 0.04, [0, stool - 0.02, 0], 16),
    drum(stoolWood, 0.03, stool - 0.04, [0, (stool - 0.04) / 2, 0], 8),
    drum(stoolWood, 0.14, 0.03, [0, 0.015, 0], 12),
  );
  seat.position.set(8.4, 0, 3.9);
  group.add(seat);
  return {
    group,
    update(state, time, dt) {
      const sat = state.lead !== "ali" && !state.party.includes("ali");
      seat.position.z +=
        ((sat ? 3.9 : 2.95) - seat.position.z) * (1 - Math.exp(-6 * dt));
      drawer.position.z = 2.8 + (state.drawer ? 0.45 : 0);
      lock.emissiveIntensity = state.drawer
        ? 3
        : 0.4 + Math.sin(time * 3) * 0.2;
      threads.forEach((thread, index) => {
        thread.visible = !state.jackets && index < state.threads;
      });
      filament.emissiveIntensity =
        (state.sparky ? 6 : 4) + Math.sin(time * 5) * 0.4;
      card.visible = state.touchedTree;
      card.position.y =
        1.35 + (state.deck ? 0.25 + Math.sin(time * 2) * 0.05 : 0);
      card.rotation.y = state.deck ? time : 0;
    },
  };
}
