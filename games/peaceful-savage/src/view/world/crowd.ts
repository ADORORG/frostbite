import {
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import { ease, farewell } from "../farewell.ts";
import { noise } from "../palette.ts";
import { band, stage } from "../show.ts";
import { spiritPaint, spiritShape } from "./ancestors.ts";
import { groundAt } from "./meadow.ts";

// The ancestors at the show: the band (one at the drums, one at the keys, one with the strings) and the rest dancing all round the
// stage, on the lawn either side, at its front corners, and in the air behind the band like a choir; all facing the screen, bobbing on
// the beat and swaying. Drawn in the same gold line as at the tree, they fade in as the stage does and out with it.
export interface Crowd {
  readonly group: Group;
  // The seconds since the tree was lit (null before), the time, and the beat (0 to 1 over each).
  update(since: number | null, time: number, beat: number): void;
}

interface Dancer {
  readonly at: Vector3;
  readonly delay: number;
  readonly scale: number;
  readonly sway: number;
  readonly yaw: number;
}

export function buildCrowd(): Crowd {
  const random = noise(2_026);
  const group = new Group();
  group.name = "crowd";
  const dancers: Dancer[] = [];
  const add = (x: number, y: number, z: number, scale: number) => {
    const floor = y === 0 ? groundAt(x, z) : y;
    dancers.push({
      at: new Vector3(x, floor, z),
      delay: random() * 1.2,
      scale: scale * (0.9 + random() * 0.18),
      sway: random() * Math.PI * 2,
      // Facing the screen, turned a little in toward the stage.
      yaw: Math.PI - Math.sign(x) * Math.min(0.5, Math.abs(x) * 0.06),
    });
  };
  // The band, behind their instruments on the stage.
  add(band.drums.x, stage.top, band.drums.z + 0.35, 0.9);
  add(band.keys.x, stage.top, band.keys.z + 0.3, 0.92);
  add(band.strings.x, stage.top, band.strings.z + 0.05, 0.92);
  for (const side of [1, -1]) {
    // Either side of the stage, on the lawn.
    for (let at = 0; at < 9; at += 1)
      add(
        side * (stage.left + 1.3 + (at % 3) * 0.8 + random() * 0.3),
        0,
        stage.front - 0.6 + Math.floor(at / 3) * 1.4 + random() * 0.4,
        1,
      );
    // At its front corners.
    for (let at = 0; at < 3; at += 1)
      add(
        side * (stage.left - 0.2 + at * 0.7),
        0,
        stage.front - 1.1 - at * 0.35,
        1,
      );
  }
  // Up behind the band, like a choir.
  for (let at = 0; at < 12; at += 1)
    add(
      stage.right + 0.4 + (at % 6) * ((stage.left - stage.right - 0.8) / 5),
      stage.top + 1.9 + Math.floor(at / 6) * 1.1 + random() * 0.3,
      stage.back + 0.9 + Math.floor(at / 6) * 0.5,
      0.8,
    );
  const shape = spiritShape();
  const shown = new InstancedBufferAttribute(
    new Float32Array(dancers.length),
    1,
  );
  shape.setAttribute("shown", shown);
  const figures = new InstancedMesh(shape, spiritPaint(), dancers.length);
  figures.frustumCulled = false;
  group.add(figures);
  const matrix = new Matrix4();
  const where = new Vector3();
  const turn = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const size = new Vector3();
  return {
    group,
    update(since, time, beat) {
      group.visible =
        since !== null &&
        since >= farewell.show[0] - 1.5 &&
        since < farewell.show[1] + 1.2;
      if (since === null || !group.visible) return;
      const leaving = ease(farewell.show[1], farewell.show[1] + 1, since);
      dancers.forEach((dancer, index) => {
        const start = farewell.show[0] - 1.5 + dancer.delay;
        shown.setX(index, ease(start, start + 1, since) * (1 - leaving));
        // A bob on every beat, a sway every two.
        const bob = Math.abs(Math.sin(Math.PI * (beat + dancer.delay)));
        where.copy(dancer.at).setY(dancer.at.y + bob * 0.1);
        turn.setFromAxisAngle(
          up,
          dancer.yaw + Math.sin(time * Math.PI * 0.83 + dancer.sway) * 0.25,
        );
        size.setScalar(dancer.scale * (1 + bob * 0.03));
        matrix.compose(where, turn, size);
        figures.setMatrixAt(index, matrix);
      });
      shown.needsUpdate = true;
      figures.instanceMatrix.needsUpdate = true;
    },
  };
}
