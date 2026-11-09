import {
  CircleGeometry,
  Color,
  type Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  type Texture,
  Vector3,
} from "three";

import { noise, srgb, texture } from "../palette.ts";
import { taperedTube } from "./tube.ts";

// An eye as the book paints them: big and deep brown, the iris warm amber round a dark pupil with a darker ring at its edge, two catches
// of light that stay put while the eye looks about, an upper lid with a strong dark lash line (flicked out at the corner on Mama and
// Zora) that blinks, and a lower lid that lifts when they smile.
export interface Eye {
  // How far open the upper lid is (radians of its turn: more negative is wider) and how high the lower lid sits.
  lids(upper: number, lower: number): void;
  look(yaw: number, pitch: number): void;
  readonly root: Object3D;
}

// The eye's picture, wrapped so its middle (the pupil) faces forward: down the picture is the angle from the front.
export function irisTexture(seed: number): Texture {
  const random = noise(seed);
  const rays = Array.from({ length: 96 }, () => random());
  const pupil = new Color("#0c0706");
  const amber = new Color("#9c5a22");
  const brown = new Color("#4a2514");
  const rim = new Color("#24120a");
  const white = new Color("#f6eee6");
  const size = 128;
  return texture(
    size,
    (x, y) => {
      const fromFront = 1 - (y + 0.5) / size;
      const ray = 0.82 + (rays[Math.floor((x / size) * 96)] ?? 0) * 0.36;
      let colour: Color;
      if (fromFront < 0.087) colour = pupil;
      else if (fromFront < 0.2) {
        const t = (fromFront - 0.087) / 0.113;
        colour = amber
          .clone()
          .lerp(brown, Math.min(1, t * 1.3))
          .multiplyScalar(ray);
      } else if (fromFront < 0.218) colour = rim;
      else
        colour = white
          .clone()
          .multiplyScalar(1 - Math.min(0.12, (fromFront - 0.218) * 0.2));
      return [...srgb(colour), 255];
    },
    1,
  );
}

export interface EyeOptions {
  readonly flick: boolean;
  readonly iris: Texture;
  readonly lid: Material;
  readonly side: 1 | -1;
  readonly size: number;
}

export function buildEye(options: EyeOptions): Eye {
  const { side, size: e } = options;
  const root = new Object3D();
  const ball = new Mesh(
    new SphereGeometry(e, 32, 24).rotateX(Math.PI / 2),
    new MeshBasicMaterial({
      color: new Color(0.93, 0.92, 0.9),
      map: options.iris,
    }),
  );
  root.add(ball);
  // The catches of light, fixed to the eye's place and not its turn.
  const shine = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  for (const [x, y, radius] of [
    [-0.36, 0.38, 0.17],
    [0.3, -0.3, 0.07],
  ] as const) {
    const spot = new Mesh(new CircleGeometry(e * radius, 16), shine);
    const at = new Vector3(x, y, 0)
      .setZ(Math.sqrt(1 - x * x - y * y))
      .multiplyScalar(e * 1.015);
    spot.position.copy(at);
    spot.lookAt(at.clone().multiplyScalar(2));
    root.add(spot);
  }
  // The upper lid: the top of a shell round the eye, turning down to blink, with the lash line along its edge.
  const upper = new Object3D();
  upper.rotation.z = side * (options.flick ? 0.1 : 0.04);
  const lid = new Object3D();
  lid.add(
    new Mesh(
      new SphereGeometry(e * 1.07, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      options.lid,
    ),
  );
  const rimPoints: Vector3[] = [];
  for (let at = 0; at <= 16; at += 1) {
    const angle = side * (-1.45 + (2.8 * at) / 16);
    rimPoints.push(
      new Vector3(Math.sin(angle) * e * 1.08, 0, Math.cos(angle) * e * 1.08),
    );
  }
  const last = rimPoints[rimPoints.length - 1] ?? new Vector3();
  if (options.flick)
    rimPoints.push(
      last.clone().add(new Vector3(side * e * 0.2, e * 0.08, -e * 0.04)),
      last.clone().add(new Vector3(side * e * 0.36, e * 0.2, -e * 0.1)),
    );
  const lashes = new Mesh(
    taperedTube(rimPoints, {
      across: 0.7,
      radius: (t) =>
        e *
        (0.02 +
          0.07 *
            Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.62) *
            (options.flick ? 1.15 : 1)) *
        (t > 0.9 ? (1 - t) * 10 : 1),
      sides: 6,
    }),
    new MeshBasicMaterial({ color: "#140a07" }),
  );
  lid.add(lashes);
  upper.add(lid);
  root.add(upper);
  // The lower lid: the bottom of a shell, its edge just under the iris.
  const lower = new Mesh(
    new SphereGeometry(
      e * 1.05,
      28,
      6,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    ),
    options.lid,
  );
  root.add(lower);
  return {
    lids(top, bottom) {
      lid.rotation.x = top;
      lower.rotation.x = bottom;
    },
    look(yaw, pitch) {
      ball.rotation.set(-pitch, yaw, 0);
    },
    root,
  };
}
