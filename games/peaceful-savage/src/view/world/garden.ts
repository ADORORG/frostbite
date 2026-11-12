import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from "three";

import { bloomed, planted, sproutTicks } from "../../rules/garden.ts";
import { gardenBeds } from "../../rules/layout.ts";
import type { PlayState } from "../../rules/types.ts";
import { noise, painted, type Tone } from "../palette.ts";
import { blossom, flowerPaint } from "./flowers.ts";
import { groundAt } from "./meadow.ts";
import { metres } from "./rooms.ts";

// Zora's garden: three round beds of dark earth in the meadow. Planted, little green shoots push up and grow as the seeds sprout; tended,
// each bed comes into bloom with the book's wildflowers, glowing in their own colours.
export interface Garden {
  readonly group: Group;
  update(state: PlayState, time: number): void;
}

const shootsPerBed = 14;
const flowersPerBed = 22;
const colours = [
  "#7b5bd8",
  "#d8402f",
  "#f6efe0",
  "#4f6fd8",
  "#c05ad0",
  "#ffcf5a",
];

export function buildGarden(tone: Tone): Garden {
  const group = new Group();
  const random = noise(4_049);
  const earth = painted(tone, { color: "#4a2f1d" });
  const leaf = painted(tone, { color: "#5fbf4a" });
  const shoots = new InstancedMesh(
    new ConeGeometry(0.03, 0.22, 5).translate(0, 0.11, 0),
    leaf,
    shootsPerBed * gardenBeds.length,
  );
  const flowers = new InstancedMesh(
    blossom(),
    flowerPaint(tone),
    flowersPerBed * gardenBeds.length,
  );
  const spots = gardenBeds.map((bed) => {
    const x = metres(bed.x);
    const z = metres(bed.z);
    const soil = new Mesh(new CylinderGeometry(1.05, 1.15, 0.12, 28), earth);
    soil.position.set(x, groundAt(x, z) + 0.03, z);
    group.add(soil);
    const scatter = (count: number) =>
      Array.from({ length: count }, () => {
        const angle = random() * Math.PI * 2;
        const reach = Math.sqrt(random()) * 0.9;
        return new Vector3(
          x + Math.cos(angle) * reach,
          groundAt(x, z) + 0.08,
          z + Math.sin(angle) * reach,
        );
      });
    return { blooms: scatter(flowersPerBed), shoots: scatter(shootsPerBed) };
  });
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  spots.forEach((spot, bed) =>
    spot.blooms.forEach((_, at) => {
      flowers.setColorAt(
        bed * flowersPerBed + at,
        new Color(colours[(bed * 5 + at) % colours.length] ?? "#ffffff"),
      );
    }),
  );
  group.add(shoots, flowers);
  return {
    group,
    update(state, time) {
      spots.forEach((spot, bed) => {
        const stage = state.garden[bed] ?? 0;
        const grown =
          stage === planted
            ? Math.min(
                1,
                (state.tick - (state.gardenAt[bed] ?? state.tick)) /
                  sproutTicks,
              )
            : stage === bloomed
              ? 1
              : 0;
        spot.shoots.forEach((at, index) => {
          const size = stage === 0 ? 0 : 0.25 + grown * 0.75;
          turn.setFromAxisAngle(up, index + Math.sin(time + index) * 0.15);
          matrix.compose(at, turn, new Vector3(size, size, size));
          shoots.setMatrixAt(bed * shootsPerBed + index, matrix);
        });
        spot.blooms.forEach((at, index) => {
          const size =
            stage === bloomed ? 0.9 + Math.sin(time * 1.3 + index) * 0.08 : 0;
          turn.setFromAxisAngle(up, index * 1.7);
          matrix.compose(at, turn, new Vector3(size, size, size));
          flowers.setMatrixAt(bed * flowersPerBed + index, matrix);
        });
      });
      shoots.instanceMatrix.needsUpdate = true;
      flowers.instanceMatrix.needsUpdate = true;
    },
  };
}
