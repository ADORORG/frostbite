import {
  type BufferGeometry,
  Color,
  Mesh,
  type MeshToonMaterial,
  Vector3,
} from "three";

import { sigils } from "../palette.ts";
import { toon } from "../toon.ts";
import { taperedTube } from "../body/tube.ts";

// The ancestor tree's trunk is three strands twisting round each other. Two hold steady. The third has lost its balance: it bows out of
// the braid, its twist lags behind the others, and its light pulses and fades like a faltering heartbeat, at times almost gone. As the
// family restores the house it winds back into the braid, steadies, beats in time with the other two, and glows gold.
export interface Strand {
  readonly mesh: Mesh;
  // How lit the tree is (0 to 1, already eased), the time, the steady strands' beat (0 to 1), and how brightly it flares as it lights
  // fully at the farewell (0 to 1).
  update(lit: number, time: number, beat: number, flare?: number): void;
}

const rows = 21;
const third = (Math.PI * 2) / 3;
const thickness = { radius: (t: number) => 0.27 - t * 0.08, sides: 12 };

// One strand's line up the trunk. `loose` 0 is in the braid; at 1 the strand bows out, lags and sags.
function path(strand: number, loose: number): Vector3[] {
  return Array.from({ length: rows }, (_, at) => {
    const t = at / (rows - 1);
    const bow = Math.sin(Math.PI * t) * loose;
    const angle = strand + t * Math.PI * 2.1 - bow * 1.1;
    const radius = 0.27 * (1 - t * 0.3) + bow * 0.34;
    return new Vector3(
      Math.cos(angle) * radius,
      t * 2.55 - bow * 0.12,
      Math.sin(angle) * radius,
    );
  });
}

// The two steady strands, as bark for the trunk.
export function steadyStrands(): BufferGeometry[] {
  return [0, third].map((strand) => taperedTube(path(strand, 0), thickness));
}

const smooth = (from: number, to: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

// A heart that falters: a beat and a softer echo, under a long, slow fading in and out.
export function faltering(time: number): number {
  const phase = (time * 0.85) % 1;
  const near = (at: number): number => {
    const away = Math.min(Math.abs(phase - at), 1 - Math.abs(phase - at));
    return Math.exp(-((away / 0.07) ** 2));
  };
  const fade = 0.5 + 0.5 * Math.sin(time * 0.41) * Math.sin(time * 0.17 + 1);
  return (near(0) + near(0.24) * 0.55) * (0.15 + fade * 0.85);
}

const faded = new Color("#5d5878");
const golden = new Color("#f2b84b");

export function buildStrand(): Strand {
  const balanced = taperedTube(path(third * 2, 0), thickness);
  const loose = taperedTube(path(third * 2, 1), thickness);
  balanced.morphAttributes.position = [loose.getAttribute("position")];
  balanced.morphAttributes.normal = [loose.getAttribute("normal")];
  const material: MeshToonMaterial = toon(
    { value: 1 },
    {
      color: faded.clone(),
      emissive: "#ffc04a",
      emissiveIntensity: 0.1,
      emissiveMap: sigils(57, 1.2),
      rim: 0.3,
      transparent: true,
    },
  );
  const mesh = new Mesh(balanced, material);
  mesh.castShadow = true;
  return {
    mesh,
    update(lit, time, beat, flare = 0) {
      const balance = smooth(0.08, 0.95, lit);
      const unsteady = 1 - balance;
      const flicker = faltering(time);
      material.emissiveIntensity =
        unsteady * (0.04 + flicker * 1.3) +
        balance * (0.35 + lit * 1.7 + beat * 0.2) +
        flare * 3;
      material.opacity = Math.min(
        1,
        unsteady * (0.3 + Math.min(1, flicker) * 0.6) + balance,
      );
      material.color.copy(faded).lerp(golden, balance);
      const influences = mesh.morphTargetInfluences;
      if (influences !== undefined)
        influences[0] = unsteady * (1 + Math.sin(time * 3.3) * 0.05);
    },
  };
}
