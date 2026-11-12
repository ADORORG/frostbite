import {
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import { clues, clueSpot, mirrors, relics } from "../../rules/collect.ts";
import { zoneAt } from "../../rules/geometry.ts";
import { plasmaAt } from "../../rules/tick.ts";
import type { PlayState } from "../../rules/types.ts";
import { glowing } from "../palette.ts";
import { lookingGlass, stillPond } from "./glass.ts";
import { groundAt, pond } from "./meadow.ts";
import { metres } from "./rooms.ts";
import { ball, block, drum } from "./shapes.ts";

// How near (millimetres, in the same room) the lead must be for a glass to show the world.
const glassReach = 12_000;

// What there is to gather and where to stand still: tiny plasma motes bobbing in the air; clues (rolled parchment glowing gold, seen only
// in Savage Vision); the relics on their little stands, each glowing softly; the mirrors (oval and silver, warming once used); and the
// maridium threads a healed grey one lets fall.
export interface Gathered {
  readonly group: Group;
  update(state: PlayState, vision: boolean, time: number): void;
}

// A relic's look: the Banneker clock, the McCoy oil can, the Jones cold box, the Woods toy telegraph, the Walker bottle, the Morgan lantern.
function relic(id: string): Group {
  const group = new Group();
  const gold = glowing("#e9b44c", 0.5);
  const dark = new MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.5 });
  group.add(
    drum(
      new MeshStandardMaterial({ color: "#6b4a2c", roughness: 0.6 }),
      0.22,
      0.6,
      [0, 0.3, 0],
      12,
    ),
  );
  if (id === "banneker")
    group.add(
      drum(gold, 0.13, 0.05, [0, 0.75, 0], 20).rotateX(Math.PI / 2),
      ball(dark, 0.02, [0, 0.75, 0.03]),
    );
  else if (id === "mccoy")
    group.add(
      drum(gold, 0.09, 0.16, [0, 0.69, 0], 14),
      drum(gold, 0.015, 0.18, [0.08, 0.8, 0], 6).rotateZ(-1),
    );
  else if (id === "jones")
    group.add(block(glowing("#9fdcff", 0.4), [0.22, 0.16, 0.16], [0, 0.69, 0]));
  else if (id === "woods")
    group.add(
      block(gold, [0.24, 0.1, 0.1], [0, 0.66, 0]),
      ball(glowing("#7fd0ff", 1), 0.03, [0.09, 0.74, 0]),
    );
  else if (id === "walker")
    group.add(
      drum(gold, 0.06, 0.2, [0, 0.71, 0], 14),
      drum(gold, 0.025, 0.06, [0, 0.84, 0], 8),
    );
  else
    group.add(
      block(dark, [0.12, 0.2, 0.12], [0, 0.71, 0]),
      ball(glowing("#ff6a4a", 1.5), 0.04, [0, 0.75, 0.07]),
    );
  return group;
}

// `pixels` is how fine the pictures in the looking glasses and the pond are (0 for none: they show a plain sheen).
export function buildGathered(pixels: number): Gathered {
  const group = new Group();
  const plasma = new InstancedMesh(
    new SphereGeometry(0.06, 10, 8),
    glowing("#9ff0ff", 3),
    72,
  );
  plasma.frustumCulled = false;
  group.add(plasma);
  const clueMeshes = clues.map(() => {
    const scroll = new Mesh(
      new CylinderGeometry(0.06, 0.06, 0.32, 12),
      glowing("#f6e2b0", 0.6),
    );
    scroll.rotation.z = Math.PI / 2;
    group.add(scroll);
    return scroll;
  });
  const relicGroups = relics.map((each) => {
    const made = relic(each.id);
    made.position.set(
      metres(each.x),
      groundAt(metres(each.x), metres(each.z)),
      metres(each.z),
    );
    group.add(made);
    return made;
  });
  // The looking glasses, each hung on the wall beside where the rules have it (and the way it faces); the pond lies in the meadow.
  const hung: Readonly<Record<string, readonly [number, number, number]>> = {
    "hall-mirror": [2.86, 2.2, -Math.PI / 2],
    "kids-mirror": [-3.14, 12.6, -Math.PI / 2],
    "office-mirror": [8, 6.86, Math.PI],
    "parents-mirror": [3.14, 8.2, Math.PI / 2],
  };
  const glasses = mirrors.map((each) => {
    const wall = hung[each.id];
    const made =
      wall === undefined
        ? stillPond(pond.wide, pond.deep, pixels)
        : lookingGlass(0.5, 0.8, pixels);
    if (wall === undefined) made.group.position.set(pond.x, pond.level, pond.z);
    else {
      made.group.position.set(wall[0], 1.2, wall[1]);
      made.group.rotation.y = wall[2];
    }
    group.add(made.group);
    return made;
  });
  const threads = Array.from({ length: 6 }, () => {
    const coil = new Mesh(
      new TorusGeometry(0.12, 0.018, 6, 24),
      glowing("#ffcf5a", 2.4),
    );
    coil.rotation.x = Math.PI / 2;
    group.add(coil);
    return coil;
  });
  const matrix = new Matrix4();
  const hidden = new Matrix4().makeScale(0, 0, 0);
  return {
    group,
    update(state, vision, time) {
      state.plasmaAt.forEach((_, mote) => {
        if (state.plasmaTaken[mote] === true) {
          plasma.setMatrixAt(mote, hidden);
          return;
        }
        const at = plasmaAt(state, mote);
        const x = metres(at.x);
        const z = metres(at.z);
        matrix.compose(
          new Vector3(
            x,
            groundAt(x, z) + 0.9 + Math.sin(time * 2 + mote) * 0.12,
            z,
          ),
          new Quaternion(),
          new Vector3(1, 1, 1).multiplyScalar(
            0.8 + Math.sin(time * 4 + mote) * 0.2,
          ),
        );
        plasma.setMatrixAt(mote, matrix);
      });
      plasma.instanceMatrix.needsUpdate = true;
      clueMeshes.forEach((scroll, index) => {
        const clue = clues[index];
        if (clue === undefined) return;
        const at = clueSpot(clue, state.clueAt[index]);
        scroll.visible =
          state.cluesTaken[index] !== true &&
          (state.cluesSeen[index] === true || vision);
        scroll.position.set(
          metres(at.x),
          groundAt(metres(at.x), metres(at.z)) +
            0.6 +
            Math.sin(time * 1.7 + index) * 0.08,
          metres(at.z),
        );
        scroll.rotation.y = time * 0.8;
      });
      relicGroups.forEach((made, index) => {
        made.visible = state.relicsTaken[index] !== true;
        made.rotation.y = Math.sin(time * 0.6 + index) * 0.2;
      });
      // A glass is silver until it has shown someone themself; then it holds a warm gold.
      glasses.forEach((glass, index) => {
        const at = mirrors[index];
        const near =
          at !== undefined &&
          zoneAt(at) === zoneAt(state) &&
          pixels > 0 &&
          Math.hypot(at.x - state.x, at.z - state.z) < glassReach;
        glass.update(state.mirrorsUsed[index] === true, time, near);
      });
      threads.forEach((coil, index) => {
        const grey = state.greys[index];
        coil.visible = grey?.thread === 1;
        if (grey === undefined) return;
        const x = metres(grey.dropX);
        const z = metres(grey.dropZ);
        coil.position.set(
          x,
          groundAt(x, z) + 0.12 + Math.sin(time * 3 + index) * 0.04,
          z,
        );
        coil.rotation.z = time;
      });
    },
  };
}
