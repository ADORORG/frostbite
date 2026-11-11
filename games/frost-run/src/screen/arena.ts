import {
  Box3,
  Group,
  Mesh,
  Vector3,
  type Material,
  type Object3D,
} from "three";

import type { Model } from "./models/load.ts";
import { frostIce, standard } from "./shaders.ts";

// The three places a run is played, each as Blender built it: the floe in open water, the sound of islets, and the crown under the aurora.
// Only one is on the stage at a time. What floats bobs on the swell; clouds drift; the water and the aurora move in their own shaders. A
// tall thing that stands between the camera and the hero (the crown's pillars) fades until the hero is clear of it.
interface Bobber {
  readonly part: Object3D;
  readonly rest: Vector3;
  readonly phase: number;
}

interface Occluder {
  readonly materials: Material[];
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  opacity: number;
}

const bounds = new Box3();
const middle = new Vector3();
const size = new Vector3();

// Gives a part materials of its own, so it can fade without fading everything else that shares them.
function ownMaterials(part: Object3D): Material[] {
  const owned: Material[] = [];
  part.traverse((each) => {
    if (!(each instanceof Mesh)) return;
    const list = (
      Array.isArray(each.material) ? each.material : [each.material]
    ).map((material) => {
      const copy = material.clone();
      const look = standard(copy);
      if (look !== null && material.name === "arena_ice") frostIce(look);
      copy.transparent = true;
      owned.push(copy);
      return copy;
    });
    each.material = list.length === 1 && list[0] !== undefined ? list[0] : list;
  });
  return owned;
}

export class ArenaView {
  readonly group = new Group();
  private readonly bobbers: Bobber[] = [];
  private readonly drifters: Bobber[] = [];
  private readonly occluders: Occluder[] = [];
  private clock = 0;

  constructor(model: Model) {
    this.group.add(model.scene);
    let index = 0;
    for (const part of [...model.scene.children]) {
      index += 1;
      const entry = { part, phase: index * 1.37, rest: part.position.clone() };
      if (/^(Chunk|Bergs)/u.test(part.name)) this.bobbers.push(entry);
      if (/^Clouds/u.test(part.name)) this.drifters.push(entry);
      if (/^Pillar\d/u.test(part.name)) {
        // Blender wrote each pillar where it stands, about the scene's middle, so where it is comes from its own shape.
        bounds.setFromObject(part).getCenter(middle);
        bounds.getSize(size);
        this.occluders.push({
          materials: ownMaterials(part),
          opacity: 1,
          radius: Math.max(size.x, size.z) / 2,
          x: middle.x,
          z: middle.z,
        });
      }
    }
    this.group.visible = false;
  }

  update(dt: number, slow: number): void {
    if (!this.group.visible) return;
    this.clock += dt * slow;
    for (const { part, phase, rest } of this.bobbers) {
      const big = part.name.startsWith("Bergs") ? 0.35 : 1;
      part.position.y =
        rest.y + Math.sin(this.clock * 0.9 + phase) * 0.06 * big;
      part.rotation.x = Math.sin(this.clock * 0.7 + phase * 1.3) * 0.03 * big;
      part.rotation.z = Math.cos(this.clock * 0.6 + phase) * 0.03 * big;
    }
    for (const { part, phase, rest } of this.drifters) {
      part.rotation.y = this.clock * 0.012 + phase * 0.01;
      part.position.y = rest.y + Math.sin(this.clock * 0.2 + phase) * 0.3;
    }
  }

  // Fades whatever stands on the floor between the camera and the hero (seen from above, within its own width of the line between them).
  clearView(dt: number, eye: Vector3, focus: Vector3): void {
    for (const occluder of this.occluders) {
      const dx = focus.x - eye.x;
      const dz = focus.z - eye.z;
      const length = dx * dx + dz * dz;
      const along =
        length === 0
          ? 0
          : ((occluder.x - eye.x) * dx + (occluder.z - eye.z) * dz) / length;
      const off = Math.hypot(
        occluder.x - (eye.x + dx * along),
        occluder.z - (eye.z + dz * along),
      );
      const between = along > 0 && along < 1.08 && off < occluder.radius + 0.6;
      const want = between ? 0.22 : 1;
      occluder.opacity += (want - occluder.opacity) * (1 - Math.exp(-9 * dt));
      for (const material of occluder.materials) {
        material.opacity = occluder.opacity;
        material.depthWrite = occluder.opacity > 0.96;
      }
    }
  }
}
