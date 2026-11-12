import { Color } from "three";

import { css, curve, glow, type Ink, span, type Spot } from "./brush.ts";
import type { Expression } from "./head.ts";

// The painted mouth for each feeling: a calm closed smile, a big smile with teeth, a smirk lifted on one side, an open mouth, a worried
// one turned down. The upper lip has its bow, the lower lip is fuller and catches a little light.
interface MouthShape {
  readonly corners: number;
  readonly dip: number;
  readonly open: number;
  readonly tilt: number;
  readonly width: number;
}

const shapes: Readonly<Record<Expression, MouthShape>> = {
  calm: { corners: 0.016, dip: -0.035, open: 0, tilt: 0, width: 1 },
  open: { corners: 0, dip: -0.03, open: 0.11, tilt: 0, width: 0.8 },
  smile: { corners: 0.05, dip: -0.065, open: 0.05, tilt: 0, width: 1.14 },
  smirk: { corners: 0.012, dip: -0.03, open: 0, tilt: 0.05, width: 1 },
  worry: { corners: -0.025, dip: 0.015, open: 0, tilt: 0, width: 0.88 },
};

export function paintMouth(
  ink: Ink,
  expression: Expression,
  centre: number,
  width: number,
  lips: Color,
  line: Color,
): void {
  const shape = shapes[expression];
  const w = width * shape.width;
  const left: Spot = [-w, centre + shape.corners - shape.tilt * 0.4];
  const right: Spot = [w, centre + shape.corners + shape.tilt];
  const middle = centre + shape.dip;
  const seam: Spot = [0, middle + (middle - centre) * 0.6];
  const low = middle - 0.07 - shape.open;
  // Upper lip, with its bow.
  ink.fillStyle = css(lips.clone().multiplyScalar(0.85));
  ink.beginPath();
  curve(ink, left, [-w * 0.45, centre + 0.05], [-0.032, centre + 0.045], true);
  curve(
    ink,
    [-0.032, centre + 0.045],
    [0, centre + 0.032],
    [0.032, centre + 0.045],
    false,
  );
  curve(ink, [0.032, centre + 0.045], [w * 0.45, centre + 0.05], right, false);
  curve(ink, right, seam, left, false);
  ink.fill();
  // Lower lip, fuller and lit.
  ink.fillStyle = css(lips);
  ink.beginPath();
  curve(ink, left, seam, right, true);
  curve(ink, right, [w * 0.55, low], [0, low], false);
  curve(ink, [0, low], [-w * 0.55, low], left, false);
  ink.fill();
  glow(ink, 0.015, low + 0.028, 0.03, new Color("#ffffff"), 0.1);
  if (shape.open > 0) {
    // The open mouth: dark within, a band of teeth under the upper lip.
    const inner = (spot: Spot, by: number, drop: number): Spot => [
      spot[0] * by,
      spot[1] - drop,
    ];
    ink.fillStyle = "#3a1310";
    ink.beginPath();
    curve(ink, inner(left, 0.86, 0.01), seam, inner(right, 0.86, 0.01), true);
    curve(
      ink,
      inner(right, 0.86, 0.01),
      [0, low + 0.05 - shape.open * 0.4],
      inner(left, 0.86, 0.01),
      false,
    );
    ink.fill();
    ink.fillStyle = "#fbf3ea";
    ink.beginPath();
    curve(
      ink,
      inner(left, 0.8, 0.012),
      [0, seam[1] - 0.002],
      inner(right, 0.8, 0.012),
      true,
    );
    curve(
      ink,
      inner(right, 0.8, 0.012),
      [0, middle - 0.035],
      inner(left, 0.8, 0.012),
      false,
    );
    ink.fill();
  }
  // The line between the lips, darkest at the corners.
  ink.strokeStyle = css(line, 0.85);
  ink.lineWidth = span(0.013);
  ink.lineCap = "round";
  ink.beginPath();
  curve(ink, left, seam, right, true);
  ink.stroke();
  for (const corner of [left, right])
    glow(ink, corner[0], corner[1], 0.03, line, 0.45);
}
