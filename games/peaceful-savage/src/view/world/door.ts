import {
  ExtrudeGeometry,
  Group,
  Mesh,
  Shape,
  TorusGeometry,
  Vector3,
} from "three";

import { taperedTube } from "../body/tube.ts";
import { glowing, painted } from "../palette.ts";
import type { Rooms } from "./rooms.ts";
import { archway } from "./shapes.ts";

// The front door's leaf: warm wood the shape of its archway, a keyhole of light on both its faces. It is shut until someone comes near,
// then slides aside along the wall (house-glass.ts slides it with the panes).
export function doorLeaf(rooms: Rooms, wide: number, top: number): Group {
  const outline = new Shape();
  archway(-wide / 2, wide / 2, top).forEach(([across, up], index) => {
    if (index === 0) outline.moveTo(across, up);
    else outline.lineTo(across, up);
  });
  const leaf = new Mesh(
    new ExtrudeGeometry(outline, {
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      depth: 0.06,
    }).translate(0, 0, -0.03),
    painted(rooms.tones.hall, { color: "#c98f45" }),
  );
  leaf.castShadow = true;
  const keyLight = glowing("#ffcf6a", 3);
  const door = new Group();
  door.add(leaf);
  for (const z of [-0.08, 0.08]) {
    const bow = new Mesh(new TorusGeometry(0.2, 0.05, 8, 24), keyLight);
    bow.position.set(0, 1.75, z);
    const stem = new Mesh(
      taperedTube([new Vector3(0, 1.55, z), new Vector3(0, 0.95, z)], {
        radius: (t) => 0.05 + t * 0.06,
        sides: 6,
      }),
      keyLight,
    );
    door.add(bow, stem);
  }
  return door;
}
