import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { taperedTube } from "../body/tube.ts";
import { softGlow } from "../palette.ts";
import { type Sigil, strokesOf } from "./sigils.ts";

export type { Sigil } from "./sigils.ts";

// Thin holographic shapes of light, drawn in the air as the family moves, the way the cover draws gold rings round Daddy's palm. Each
// hand-key draws its own shape at the hands: the Cup a bowl of light, the Comb its teeth, the Knot a loop that never ends, the Knock
// rings spreading from the palm, the Split two circles parting, the Let-Go a spiral unwinding. A breath held draws a shield of light
// round the body, and the breath let go a field of loops through it, balanced head to toe; centring draws a flower of circles on the
// ground; a dance spins a star of two pyramids round the dancer. They are drawn line by line, a bright pen at the drawing end, and fade
// when the move is done.

export interface Drawing {
  readonly sigil: Sigil;
  // How much of it is drawn (0 to 1).
  readonly drawn: number;
}

export interface Bearer {
  readonly at: Vector3;
  readonly hands: readonly Vector3[];
  readonly height: number;
  readonly yaw: number;
}

export interface Holograms {
  readonly group: Group;
  update(
    drawing: Drawing | null,
    bearer: Bearer | null,
    time: number,
    dt: number,
  ): void;
}

// How big each shape is drawn (metres to a unit of it), so its line can be a few millimetres thick whatever its size.
const sizes: Readonly<Record<Sigil, number>> = {
  comb: 0.22,
  cup: 0.22,
  field: 1.7,
  flower: 0.32,
  knock: 0.2,
  knot: 0.22,
  letgo: 0.22,
  shield: 1.7,
  split: 0.22,
  star: 1.7,
};

// A shape as fine tubes of light in drawing order (so drawing it is showing the first part of it), gold shading toward a cool blue as it
// goes, as a hologram's light shifts; brighter than white, so it blooms.
function shapeOf(sigil: Sigil): Mesh<BufferGeometry, MeshBasicMaterial> {
  const gold = new Color("#ffc94a");
  const cool = new Color("#7fe3ff");
  const strokes = strokesOf(sigil);
  const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  const thin = 0.0045 / sizes[sigil];
  let done = 0;
  const pieces = strokes.map((stroke) => {
    const piece = taperedTube(stroke, { radius: () => thin, sides: 4 });
    const colours: number[] = [];
    const count = piece.getAttribute("position").count;
    for (let index = 0; index < count; index += 1) {
      const t = (done + (index / count) * stroke.length) / total;
      const tint = gold
        .clone()
        .lerp(cool, 0.1 + 0.32 * Math.sin(t * 9) ** 2)
        .multiplyScalar(bodyShapes.includes(sigil) ? 0.85 : 1.6);
      colours.push(tint.r, tint.g, tint.b);
    }
    done += stroke.length;
    piece.setAttribute("color", new Float32BufferAttribute(colours, 3));
    piece.deleteAttribute("uv");
    return piece;
  });
  const geometry = mergeGeometries(pieces) ?? new BufferGeometry();
  for (const piece of pieces) piece.dispose();
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      blending: AdditiveBlending,
      depthWrite: false,
      opacity: 0,
      toneMapped: false,
      transparent: true,
      vertexColors: true,
    }),
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

// The shapes drawn round the whole body are big and often close to the camera, so they are drawn fainter than the small ones at the
// hands, a veil of light rather than a glare.
const bodyShapes: readonly Sigil[] = ["field", "flower", "shield", "star"];

const handKeys: readonly Sigil[] = [
  "comb",
  "cup",
  "knock",
  "knot",
  "letgo",
  "split",
];

// Where a shape is drawn and how big: the hand-keys at the hands (the Knock at the right palm, the Cup under the hands, the Comb and the
// Let-Go rising from them), the body's shapes round the body, the flower on the ground under the feet.
function pose(
  line: Object3D,
  sigil: Sigil,
  bearer: Bearer,
  time: number,
): void {
  const [left, right] = bearer.hands;
  const between =
    left !== undefined && right !== undefined
      ? left.clone().lerp(right, 0.5)
      : bearer.at.clone().setY(bearer.at.y + bearer.height * 0.7);
  line.rotation.set(0, bearer.yaw, 0);
  if (handKeys.includes(sigil)) {
    const forward = new Vector3(Math.sin(bearer.yaw), 0, Math.cos(bearer.yaw));
    const at = sigil === "knock" && right !== undefined ? right : between;
    // Drawn a little above the hands, where they are seen over the moment's panel.
    line.position.copy(at).addScaledVector(forward, 0.1);
    line.position.y += sigil === "cup" ? 0.12 : sigil === "knock" ? 0.02 : 0.06;
    line.scale.setScalar(sizes[sigil]);
    if (sigil === "letgo") line.rotation.y += time * 1.5;
    return;
  }
  line.position.copy(bearer.at);
  const tall = bearer.height * 1.12;
  if (sigil === "flower") {
    line.position.y += 0.03;
    line.scale.setScalar(sizes.flower * bearer.height * 0.7);
    line.rotation.y = time * 0.25;
  } else {
    line.scale.set(
      tall * (sigil === "shield" ? 1.25 : 1),
      tall,
      tall * (sigil === "shield" ? 1.25 : 1),
    );
    line.position.y -= bearer.height * 0.04;
    line.rotation.y = bearer.yaw + time * (sigil === "star" ? 1.2 : 0.35);
  }
}

export function buildHolograms(): Holograms {
  const group = new Group();
  const shapes = new Map<
    Sigil,
    {
      drawn: number;
      fade: number;
      line: Mesh<BufferGeometry, MeshBasicMaterial>;
    }
  >();
  const pen = new Sprite(
    new SpriteMaterial({
      blending: AdditiveBlending,
      color: "#fff1c4",
      depthWrite: false,
      map: softGlow(),
      transparent: true,
    }),
  );
  pen.scale.setScalar(0.12);
  pen.visible = false;
  group.add(pen);
  const tip = new Vector3();
  return {
    group,
    update(drawing, bearer, time, dt) {
      if (drawing !== null && !shapes.has(drawing.sigil)) {
        const line = shapeOf(drawing.sigil);
        group.add(line);
        shapes.set(drawing.sigil, { drawn: 0, fade: 0, line });
      }
      pen.visible = false;
      for (const [sigil, shape] of shapes) {
        const current = drawing?.sigil === sigil && bearer !== null;
        const ease = 1 - Math.exp(-10 * dt);
        if (current) {
          shape.drawn +=
            (Math.min(1, Math.max(0, drawing.drawn)) - shape.drawn) * ease;
          shape.fade += (1 - shape.fade) * ease;
        } else shape.fade *= Math.exp(-2.5 * dt);
        if (!current && shape.fade < 0.02) shape.drawn = 0;
        const line = shape.line;
        line.visible = shape.fade > 0.01 && shape.drawn > 0.002;
        if (!line.visible) continue;
        if (bearer !== null) pose(line, sigil, bearer, time);
        // Drawn so far: the first part of its triangles, which run in drawing order.
        const index = line.geometry.getIndex();
        const count = index?.count ?? 0;
        const shown = Math.floor((count * shape.drawn) / 3) * 3;
        line.geometry.setDrawRange(0, shown);
        line.material.opacity =
          shape.fade *
          (0.8 + 0.2 * Math.sin(time * 19 + count)) *
          (bodyShapes.includes(sigil) ? 0.7 : 1);
        // The pen: a bright point where the line is being drawn, while it is still being drawn.
        if (current && index !== null && shape.drawn < 0.985 && shown > 2) {
          const position = line.geometry.getAttribute("position");
          tip.fromBufferAttribute(position, index.getX(shown - 1));
          line.updateMatrixWorld();
          pen.position.copy(tip.applyMatrix4(line.matrixWorld));
          pen.visible = true;
        }
      }
    },
  };
}
