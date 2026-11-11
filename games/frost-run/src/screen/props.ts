import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Material,
  Mesh,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Object3D,
  type Scene,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { Breakable, Item, ItemKind } from "../rules/types.ts";
import type { Models } from "./models/load.ts";
import { toScene } from "./space.ts";

// The treasure of a round and what it waits in: crystals that turn and glow, eggs in snow nests, keys that hang in the air (the ghost keys of
// the crown only half there until frost vision shows them), and the ice crates and cages that must break first. A taken thing pops and is
// gone; a broken crate or cage is gone in a burst the effects draw.
const glowColour: Record<ItemKind, string> = {
  crystal: "#3FE0A0",
  egg: "#c9bdea",
  key: "#bfeaff",
};

function halo(colour: string): SpriteMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (context !== null) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
    gradient.addColorStop(0, `${colour}cc`);
    gradient.addColorStop(0.35, `${colour}44`);
    gradient.addColorStop(1, `${colour}00`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return new SpriteMaterial({
    blending: AdditiveBlending,
    depthWrite: false,
    map,
    toneMapped: false,
    transparent: true,
  });
}

interface ItemView {
  readonly item: Item;
  readonly root: Group;
  readonly body: Object3D;
  readonly glow: Sprite;
  readonly ghostly: Material[];
  popped: number;
}

export class PropsView {
  readonly group = new Group();
  private items = new Map<number, ItemView>();
  private crates: Object3D[] = [];
  private cages: Object3D[] = [];
  private readonly halos: Record<ItemKind, SpriteMaterial>;
  private clock = 0;
  private laidFor = -1;

  constructor(
    scene: Scene,
    private readonly models: Models,
  ) {
    scene.add(this.group);
    this.halos = {
      crystal: halo(glowColour.crystal),
      egg: halo(glowColour.egg),
      key: halo(glowColour.key),
    };
  }

  // Sets out a round's things once, when its first state is shown.
  layOut(
    stamp: number,
    items: readonly Item[],
    crates: readonly Breakable[],
    cages: readonly Breakable[],
  ): void {
    if (stamp === this.laidFor) return;
    this.laidFor = stamp;
    this.group.clear();
    this.items = new Map();
    this.crates = crates.map((crate, index) =>
      this.place("crate", crate.x, crate.y, index * 0.9),
    );
    this.cages = cages.map((cage, index) =>
      this.place("cage", cage.x, cage.y, index * 0.4),
    );
    for (const item of items) this.items.set(item.id, this.makeItem(item));
  }

  private place(
    name: "cage" | "crate",
    x: number,
    y: number,
    turn: number,
  ): Object3D {
    const part = clone(this.models(name).scene);
    part.position.copy(toScene(x, y, 0));
    part.rotation.y = turn;
    this.group.add(part);
    return part;
  }

  private makeItem(item: Item): ItemView {
    const body = clone(this.models(item.kind).scene);
    const root = new Group();
    root.position.copy(toScene(item.x, item.y, item.z));
    const ghostly: Material[] = [];
    if (item.ghost) {
      body.traverse((part) => {
        if (!(part instanceof Mesh)) return;
        const own = Array.isArray(part.material)
          ? part.material.map((each) => each.clone())
          : part.material.clone();
        part.material = own;
        for (const each of Array.isArray(own) ? own : [own]) {
          each.transparent = true;
          ghostly.push(each);
        }
      });
    }
    const glow = new Sprite(this.halos[item.kind]);
    const size = item.kind === "egg" ? 0.9 : 1.1;
    glow.scale.set(size, size, 1);
    glow.position.y = item.kind === "egg" ? 0.28 : 0.15;
    root.add(body, glow);
    root.rotation.y = item.id * 0.77;
    this.group.add(root);
    return { body, ghostly, glow, item, popped: -1, root };
  }

  update(
    dt: number,
    slow: number,
    items: readonly Item[],
    crates: readonly Breakable[],
    cages: readonly Breakable[],
    sees: boolean,
  ): void {
    this.clock += dt * slow;
    crates.forEach((crate, index) => {
      const view = this.crates[index];
      if (view !== undefined) view.visible = crate.brokenAt < 0;
    });
    cages.forEach((cage, index) => {
      const view = this.cages[index];
      if (view !== undefined) view.visible = cage.brokenAt < 0;
    });
    for (const item of items) {
      const view = this.items.get(item.id);
      if (view === undefined) continue;
      if (item.takenAt >= 0) {
        this.pop(view, dt);
        continue;
      }
      const lift =
        item.kind === "egg" ? 0 : Math.sin(this.clock * 2.1 + item.id) * 0.07;
      view.root.position.y = item.z / 1000 + lift;
      view.body.rotation.y =
        item.kind === "egg"
          ? Math.sin(this.clock * 1.4 + item.id) * 0.12
          : this.clock * (item.kind === "key" ? 1.1 : 1.6);
      if (item.kind === "egg")
        view.body.rotation.z = Math.sin(this.clock * 3.1 + item.id * 2) * 0.05;
      const shown = !item.ghost || sees;
      const shimmer = 0.12 + 0.08 * Math.sin(this.clock * 5 + item.id);
      for (const material of view.ghostly)
        material.opacity = shown ? 1 : shimmer;
      view.glow.visible = shown;
      const breath = 1 + 0.12 * Math.sin(this.clock * 3 + item.id);
      view.glow.scale.setScalar((item.kind === "egg" ? 0.9 : 1.1) * breath);
    }
  }

  private pop(view: ItemView, dt: number): void {
    if (view.popped < 0) view.popped = 0;
    view.popped += dt;
    const share = view.popped / 0.24;
    if (share >= 1) {
      view.root.visible = false;
      return;
    }
    const swell =
      share < 0.35 ? 1 + share * 1.6 : 1.56 * (1 - (share - 0.35) / 0.65);
    view.root.scale.setScalar(Math.max(0.01, swell));
    view.root.position.y += dt * 2.2;
  }
}
