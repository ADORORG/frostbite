import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { type CreationId, creations } from "../../rules/create.ts";
import { stepsOf } from "../../rules/moment.ts";
import type { PlayState } from "../../rules/types.ts";
import { glowing, noise, srgb, texture } from "../palette.ts";
import { groundAt } from "./meadow.ts";

// What the family makes and keeps, where each was made: Kai's holographic structure of light standing over the tower he built again,
// Zora's masterpiece on an easel in the meadow, Mama's song as gold notes circling where she stood by the tree, and Daddy's relic
// floating free over his desk. Each grows step by step with its moment, and once made it stays, alive with light.
export interface Creations {
  readonly group: Group;
  update(state: PlayState, time: number): void;
}

const light = (colour: string, opacity = 0.6): MeshBasicMaterial =>
  new MeshBasicMaterial({
    blending: AdditiveBlending,
    color: new Color(colour).multiplyScalar(0.8),
    depthWrite: false,
    opacity,
    toneMapped: false,
    transparent: true,
  });

const placed = (id: CreationId): Vector3 => {
  const at = creations.find((creation) => creation.id === id)?.at ?? {
    x: 0,
    z: 0,
  };
  const x = at.x / 1000;
  const z = at.z / 1000;
  return new Vector3(x, z < 0 ? groundAt(x, z) : 0, z);
};

// Kai's hologram: a helix of light winding up round the tower, three rings that turn, and a crystal of light at the top.
function hologram(): { group: Group; show(made: number, time: number): void } {
  const group = new Group();
  const cyan = light("#7fe3ff");
  const gold = light("#ffd25a");
  const points = Array.from({ length: 60 }, (_, at) => {
    const t = at / 59;
    return new Vector3(
      Math.cos(t * Math.PI * 7) * 0.42,
      0.85 + t * 1.9,
      Math.sin(t * Math.PI * 7) * 0.42,
    );
  });
  const helix = new Mesh(
    new TubeGeometry(new CatmullRomCurve3(points), 160, 0.012, 5, false),
    cyan,
  );
  group.add(helix);
  const rings = [1.3, 1.9, 2.5].map((y, index) => {
    const ring = new Mesh(
      new TorusGeometry(0.55 - index * 0.1, 0.012, 5, 6),
      index === 1 ? gold : cyan,
    );
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    return ring;
  });
  const crystal = new Mesh(new OctahedronGeometry(0.3, 0), gold);
  crystal.position.y = 3.05;
  const frame = new Mesh(new OctahedronGeometry(0.42, 0), cyan);
  frame.position.y = 3.05;
  group.add(crystal, frame);
  return {
    group,
    show(made, time) {
      group.visible = made > 0;
      helix.geometry.setDrawRange(
        0,
        Math.floor(
          ((helix.geometry.getIndex()?.count ?? 0) * Math.min(1, made * 1.4)) /
            3,
        ) * 3,
      );
      rings.forEach((ring, index) => {
        ring.visible = made > 0.25 + index * 0.2;
        ring.rotation.z =
          time * (0.4 + index * 0.3) * (index % 2 === 0 ? 1 : -1);
      });
      crystal.visible = made >= 1;
      frame.visible = made >= 1;
      crystal.rotation.y = time * 0.8;
      frame.rotation.y = -time * 0.5;
      frame.scale.setScalar(1 + Math.sin(time * 2) * 0.05);
    },
  };
}

// Zora's masterpiece: every colour split, swirled and let go, painted in code on a canvas on a little easel.
function masterpiece(): {
  group: Group;
  show(made: number, time: number): void;
} {
  const group = new Group();
  const random = noise(71);
  const blobs = Array.from({ length: 9 }, () => ({
    colour: new Color().setHSL(random(), 0.85, 0.58),
    r: 0.18 + random() * 0.25,
    x: random(),
    y: random(),
  }));
  const painting = texture(
    128,
    (x, y) => {
      const u = x / 128;
      const v = y / 128;
      const swirl =
        Math.atan2(v - 0.5, u - 0.5) + Math.hypot(u - 0.5, v - 0.5) * 9;
      let colour = new Color().setHSL(
        (swirl / (Math.PI * 2) + 1) % 1,
        0.75,
        0.55,
      );
      for (const blob of blobs) {
        const near = 1 - Math.hypot(u - blob.x, v - blob.y) / blob.r;
        if (near > 0)
          colour = colour.lerp(blob.colour, Math.min(1, near * 1.6));
      }
      return [...srgb(colour), 255];
    },
    1,
  );
  const paint = new MeshBasicMaterial({
    map: painting,
    side: DoubleSide,
    transparent: true,
  });
  const canvas = new Mesh(new PlaneGeometry(0.9, 0.7), paint);
  canvas.position.set(0, 1.35, 0.02);
  const board = new Mesh(
    new PlaneGeometry(0.98, 0.78),
    glowing("#f6efe2", 0.2),
  );
  board.position.set(0, 1.35, 0);
  group.add(board, canvas);
  const wood = glowing("#8a5a33", 0.05);
  for (const [x, z, lean] of [
    [-0.32, 0.12, 0.18],
    [0.32, 0.12, -0.18],
    [0, -0.35, 0],
  ] as const) {
    const leg = new Mesh(new CylinderGeometry(0.02, 0.025, 1.7, 6), wood);
    leg.position.set(x, 0.82, z);
    leg.rotation.set(z < 0 ? -0.25 : 0.06, 0, lean);
    group.add(leg);
  }
  const frame = new Mesh(
    new TorusGeometry(0.62, 0.012, 4, 4),
    light("#ffd25a", 0.6),
  );
  frame.position.set(0, 1.35, 0.03);
  frame.rotation.z = Math.PI / 4;
  frame.scale.set(1, 0.8, 1);
  group.add(frame);
  return {
    group,
    show(made, time) {
      group.visible = made > 0;
      paint.opacity = Math.min(1, made);
      frame.visible = made >= 1;
      const pulse = 1 + Math.sin(time * 2.4) * 0.02;
      frame.scale.set(pulse, pulse * 0.8, 1);
    },
  };
}

// Mama's song: gold notes rising and circling where she sang.
function song(): { group: Group; show(made: number, time: number): void } {
  const group = new Group();
  const gold = glowing("#ffd25a", 1.6);
  const notes = Array.from({ length: 7 }, (_, index) => {
    const note = new Group();
    const head = new Mesh(new SphereGeometry(0.055, 10, 8), gold);
    head.scale.set(1.25, 0.9, 0.7);
    const stem = new Mesh(new CylinderGeometry(0.008, 0.008, 0.2, 5), gold);
    stem.position.set(0.06, 0.1, 0);
    note.add(head, stem);
    if (index % 2 === 0) {
      const flag = new Mesh(new TorusGeometry(0.05, 0.01, 4, 8, Math.PI), gold);
      flag.position.set(0.1, 0.17, 0);
      flag.rotation.z = -Math.PI / 2;
      note.add(flag);
    }
    group.add(note);
    return note;
  });
  return {
    group,
    show(made, time) {
      group.visible = made > 0;
      notes.forEach((note, index) => {
        const shown = index < Math.ceil(made * notes.length);
        note.visible = shown;
        const t = (time * 0.25 + index / notes.length) % 1;
        const angle = t * Math.PI * 4 + index;
        note.position.set(
          Math.cos(angle) * (0.35 + t * 0.3),
          1.2 + t * 1.6,
          Math.sin(angle) * (0.35 + t * 0.3),
        );
        note.rotation.y = -angle;
        note.scale.setScalar(made >= 1 ? 1 - t * 0.4 : 0.8);
      });
    },
  };
}

// Daddy's relic: a gold amulet with a teal heart, lifting out of the drawer and floating free, turning slowly in its own light.
function relic(): { group: Group; show(made: number, time: number): void } {
  const group = new Group();
  const amulet = new Group();
  const disc = new Mesh(
    new CylinderGeometry(0.16, 0.16, 0.04, 5),
    glowing("#f2bf4a", 1.1),
  );
  disc.rotation.x = Math.PI / 2;
  amulet.add(disc);
  const gem = new Mesh(new SphereGeometry(0.06, 12, 8), glowing("#2fd3c4", 2));
  gem.position.z = 0.03;
  amulet.add(gem);
  const halo = new Mesh(
    new TorusGeometry(0.28, 0.008, 4, 40),
    light("#ffd25a", 0.7),
  );
  amulet.add(halo);
  group.add(amulet);
  return {
    group,
    show(made, time) {
      group.visible = made > 0;
      amulet.position.y =
        0.95 + Math.min(1, made) * 1.1 + Math.sin(time * 1.6) * 0.04;
      amulet.rotation.y = time * 0.7;
      halo.visible = made >= 1;
      halo.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    },
  };
}

const makers = { hologram, masterpiece, release: relic, song } as const;

export function buildCreations(): Creations {
  const group = new Group();
  const shown = creations.map((creation) => {
    const made = makers[creation.id]();
    made.group.position.copy(placed(creation.id));
    group.add(made.group);
    return { creation, made };
  });
  return {
    group,
    update(state, time) {
      const moment = state.moment;
      for (const { creation, made } of shown) {
        const done = state.made.includes(creation.hero);
        const making =
          moment !== null && moment.kind === creation.id
            ? moment.step / Math.max(1, stepsOf(moment).length)
            : 0;
        made.show(done ? 1 : making, time);
      }
    },
  };
}
