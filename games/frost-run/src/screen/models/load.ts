import {
  Mesh,
  type AnimationClip,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  aurora,
  frostIce,
  holo,
  pulse,
  spirit,
  standard,
  water,
} from "../shaders.ts";
import { modelNames, packed, type ModelName } from "./packed.ts";

// The models Blender made, read from the text they were packed into (the frame may load no files). Each is parsed once; the screen clones
// what it needs from them.
export interface Model {
  readonly clips: readonly AnimationClip[];
  readonly scene: Object3D;
}
// Each model by its name.
export type Models = (name: ModelName) => Model;

function bytesOf(text: string): ArrayBuffer {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1)
    bytes[at] = binary.charCodeAt(at);
  return bytes.buffer;
}

// How each of Blender's materials is finished in the shader, by its name.
const crystalPulse = (material: MeshStandardMaterial): void =>
  pulse(material, "frost-crystal", 3.2, 0.4);
const gemPulse = (material: MeshStandardMaterial): void =>
  pulse(material, "frost-gem", 2.2, 0.35);
const looks: Readonly<
  Record<string, (material: MeshStandardMaterial) => void>
> = {
  arena_aurora: aurora,
  arena_ice: frostIce,
  arena_water: water,
  cage_tip: gemPulse,
  crystal_core: crystalPulse,
  crystal_edge: crystalPulse,
  holo_body: holo,
  holo_face: holo,
  holo_hoof: holo,
  holo_horn: holo,
  holo_wool: holo,
  key_gem: gemPulse,
  miner_lamp: gemPulse,
  spirit_body: spirit,
  spirit_face: spirit,
};

const casts = (name: ModelName): boolean => !name.startsWith("arena");

function finish(name: ModelName, scene: Object3D): void {
  const seen = new Set<string>();
  scene.traverse((part) => {
    if (!(part instanceof Mesh)) return;
    const arena = name.startsWith("arena");
    part.castShadow =
      casts(name) ||
      /Rock|Berg|Pillar|Peak/u.test(part.name + (part.parent?.name ?? ""));
    part.receiveShadow = arena || name === "cage" || name === "crate";
    const materials = Array.isArray(part.material)
      ? part.material
      : [part.material];
    for (const each of materials) {
      const material = standard(each);
      if (material === null || seen.has(material.uuid)) continue;
      seen.add(material.uuid);
      looks[material.name]?.(material);
    }
  });
}

export async function loadModels(): Promise<Models> {
  const loader = new GLTFLoader();
  const entries = await Promise.all(
    modelNames.map(async (name) => {
      const gltf = await loader.parseAsync(bytesOf(packed[name]), "");
      finish(name, gltf.scene);
      return [name, { clips: gltf.animations, scene: gltf.scene }] as const;
    }),
  );
  const byName = new Map<ModelName, Model>(entries);
  return (name) => {
    const model = byName.get(name);
    if (model === undefined) throw new Error(`The model ${name} did not load.`);
    return model;
  };
}
