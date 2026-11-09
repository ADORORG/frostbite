import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  type Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

import type { HeroId } from "../../rules/constants.ts";
import { glowing } from "../palette.ts";
import { taperedTube } from "./tube.ts";

// The family's gold: Daddy's afro pick, Mama's headband and feather and feather earrings, Zora's hair beads, the hoops. Gold is the magic
// coming back, so it glows a little and is never greyed.

// Daddy's pick, its teeth in the afro and its handle out, crowned with a ring: the Comb hand-key worn in his hair.
export function pick(crown: Object3D, r: number): void {
  const gold = glowing("#f2bf4a", 0.7);
  const tool = new Mesh(new BoxGeometry(r * 0.34, r * 0.5, r * 0.06), gold);
  for (let tooth = 0; tooth < 4; tooth += 1) {
    const prong = new Mesh(
      new CylinderGeometry(r * 0.022, r * 0.012, r * 0.7, 6),
      gold,
    );
    prong.position.set((tooth - 1.5) * r * 0.09, -r * 0.55, 0);
    tool.add(prong);
  }
  const ring = new Mesh(new TorusGeometry(r * 0.13, r * 0.035, 8, 20), gold);
  ring.position.set(0, r * 0.38, 0);
  tool.add(ring);
  tool.position.set(r * 0.95, r * 1.25, -r * 0.35);
  tool.rotation.set(-0.25, 0.5, -0.45);
  crown.add(tool);
}

// A feather: a soft cream vane, flattened, on a gold shaft.
function feather(length: number, glow: number): Mesh {
  const points = Array.from({ length: 12 }, (_, at) => {
    const t = at / 11;
    return new Vector3(Math.sin(t * 1.4) * length * 0.08, t * length, 0);
  });
  const vane = new Mesh(
    taperedTube(points, {
      across: 0.18,
      radius: (t) =>
        length * 0.13 * Math.sin(Math.min(1, t * 1.1) * Math.PI) ** 0.7,
      sides: 10,
      up: new Vector3(1, 0, 0),
    }),
    glowing("#f7ead6", glow),
  );
  const shaft = new Mesh(
    taperedTube(points, {
      radius: (t) => length * 0.012 * (1 - t * 0.7),
      sides: 5,
    }),
    glowing("#f2bf4a", 0.9),
  );
  vane.add(shaft);
  return vane;
}

// Mama's gold headband across her brow, a jewel at its centre and a feather standing from it.
export function headband(head: Object3D, r: number): void {
  const band = new Mesh(
    new TorusGeometry(r * 1.07, r * 0.06, 8, 48),
    glowing("#e6b34c", 0.9),
  );
  band.rotation.x = Math.PI / 2 - 0.3;
  band.position.set(0, r * 1.45, -r * 0.05);
  head.add(band);
  const jewel = new Mesh(
    new SphereGeometry(r * 0.09, 12, 8),
    glowing("#2fd3c4", 1.2),
  );
  jewel.position.set(0, r * 1.62, r * 1.02);
  head.add(jewel);
  for (const [lean, size] of [
    [0, 1],
    [0.32, 0.8],
    [-0.3, 0.75],
  ] as const) {
    const plume = feather(r * 1.25 * size, 0.45);
    plume.position.set(lean * r * 0.3, r * 1.7, r * 0.92);
    plume.rotation.set(-0.25, 0, -lean);
    head.add(plume);
  }
}

// Zora's gold beads round the base of each puff.
export function beads(puff: Object3D, r: number, side: number): void {
  for (let bead = 0; bead < 4; bead += 1) {
    const ball = new Mesh(
      new SphereGeometry(r * 0.07, 10, 8),
      glowing("#f5c04a", 0.8),
    );
    const around = (bead / 4) * Math.PI * 2;
    ball.position.set(
      -side * r * 0.35 + Math.cos(around) * r * 0.36,
      -r * 0.5,
      Math.sin(around) * r * 0.36,
    );
    puff.add(ball);
  }
}

// Earrings, as the book has them: Mama's feathers with a gold gem, Zora's little gold hoops, Daddy's one big gold hoop.
export function earrings(head: Object3D, hero: HeroId, r: number): void {
  if (hero === "kai") return;
  for (const s of hero === "ali" ? [1] : [1, -1]) {
    if (hero === "heerah") {
      const drop = feather(r * 0.55, 0.4);
      drop.position.set(s * r * 1.02, r * 0.1, 0.02 * r);
      drop.rotation.z = Math.PI;
      head.add(drop);
      const gem = new Mesh(
        new SphereGeometry(r * 0.05, 8, 6),
        glowing("#ffcb57", 1.4),
      );
      gem.position.set(s * r * 1.02, r * 0.62, 0);
      head.add(gem);
      continue;
    }
    const hoop = new Mesh(
      new TorusGeometry(r * (hero === "ali" ? 0.16 : 0.07), r * 0.022, 6, 24),
      glowing("#f2bf4a", 0.9),
    );
    hoop.position.set(s * r * 1.02, r * 0.55, 0);
    hoop.rotation.y = Math.PI / 2;
    head.add(hoop);
  }
}
