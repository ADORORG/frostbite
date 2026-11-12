import {
  type BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshToonMaterial,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { noise, sigils } from "../palette.ts";
import { toon } from "../toon.ts";
import { taperedTube } from "../body/tube.ts";
import { figures, galaxy, leaves, under } from "./canopy.ts";
import { buildStrand, steadyStrands } from "./strands.ts";

// The ancestor tree in the hall: the book's tree of light. Three strands of trunk twist round each other (the third out of balance, see
// strands.ts) and part into great branches that arch out under the hall's vault, fork, and end in clusters of leaves; roots spread over the floor; the figures of the grands and the
// greats sit along the boughs; a galaxy turns under the vault above. It is the dial of the whole house: moonlit silver and barely
// glowing at the start, its gold lines, leaves and figures warming as wounds are healed and the family comes home, blazing when lit.
export interface Tree {
  readonly group: Group;
  // How lit the tree is (0 to 1), and the time.
  // How lit it is (0 to 1), the time, and how brightly the third strand flares as it lights fully (0 to 1).
  update(lit: number, time: number, dt: number, flare?: number): void;
}

const silverBark = new Color("#8c8fb0");
const goldBark = new Color("#d99a3a");
const silverLeaf = [
  new Color("#9aa6d8"),
  new Color("#c3c8ea"),
  new Color("#7f8fc8"),
];
const goldLeaf = [
  new Color("#ffcf5a"),
  new Color("#ffe39a"),
  new Color("#42d4c4"),
];

interface Grown {
  readonly bark: BufferGeometry[];
  readonly perches: Vector3[];
  readonly tips: Vector3[];
}

function bough(
  grown: Grown,
  from: Vector3,
  toward: Vector3,
  length: number,
  thick: number,
  depth: number,
  random: () => number,
): void {
  const points: Vector3[] = [from.clone()];
  let at = from.clone();
  let heading = toward.clone().normalize();
  for (let step = 0; step < 6; step += 1) {
    heading = heading
      .add(
        new Vector3(
          (random() - 0.5) * 0.25,
          0.06 - step * 0.035,
          (random() - 0.5) * 0.25,
        ),
      )
      .normalize();
    at = under(at.clone().addScaledVector(heading, length / 6));
    points.push(at);
  }
  grown.bark.push(
    taperedTube(points, { radius: (t) => thick * (1 - t * 0.62), sides: 8 }),
  );
  const middle = points[3];
  if (middle !== undefined) grown.perches.push(middle.clone());
  if (depth === 0) {
    grown.tips.push(at.clone());
    return;
  }
  for (let fork = 0; fork < 3; fork += 1) {
    const start = points[2 + fork * 2] ?? at;
    const out = new Vector3(
      heading.x + (random() - 0.5) * 1.1,
      0.35 + random() * 0.4,
      heading.z + (random() - 0.5) * 1.1,
    );
    bough(grown, start, out, length * 0.55, thick * 0.4, depth - 1, random);
  }
}

function grow(random: () => number): Grown {
  const grown: Grown = { bark: [], perches: [], tips: [] };
  grown.bark.push(...steadyStrands());
  // The great boughs, arching out along the hall and under the vault.
  for (let at = 0; at < 6; at += 1) {
    const angle = (at / 6) * Math.PI * 2 + random() * 0.4;
    const out = new Vector3(
      Math.cos(angle) * 0.75,
      0.62,
      Math.sin(angle) * 1.15,
    );
    bough(
      grown,
      new Vector3(0, 2.35, 0),
      out,
      2.7 + random() * 0.6,
      0.2,
      1,
      random,
    );
  }
  // Roots over the floor.
  for (let root = 0; root < 10; root += 1) {
    const angle = (root / 10) * Math.PI * 2 + random() * 0.3;
    const reach = 1.5 + random() * 0.8;
    const points = Array.from({ length: 6 }, (_, step) => {
      const t = step / 5;
      return new Vector3(
        Math.cos(angle + t * 0.4) * reach * t,
        0.32 * (1 - t) + 0.04,
        Math.sin(angle + t * 0.4) * reach * t,
      );
    });
    grown.bark.push(
      taperedTube(points, { radius: (t) => 0.2 * (1 - t * 0.85), sides: 8 }),
    );
  }
  return grown;
}

export function buildTree(): Tree {
  const random = noise(1_701);
  const group = new Group();
  const grown = grow(random);
  const bark: MeshToonMaterial = toon(
    { value: 1 },
    {
      color: silverBark.clone(),
      emissive: "#ffc04a",
      emissiveIntensity: 0.05,
      emissiveMap: sigils(53, 0.8),
      rim: 0.3,
    },
  );
  const wood = new Mesh(
    mergeGeometries(grown.bark) ?? new SphereGeometry(0.4),
    bark,
  );
  wood.castShadow = true;
  group.add(wood);
  const crown = leaves(grown.tips, random);
  const sitters = figures(grown.perches, random);
  const stars = galaxy(random);
  const strand = buildStrand();
  group.add(crown, sitters, stars, strand.mesh);
  const tint = new Color();
  let shown = -1;
  return {
    group,
    update(lit, time, dt, flare = 0) {
      const target = Math.max(0, Math.min(1, lit));
      const next =
        shown < 0
          ? target
          : shown + (target - shown) * (1 - Math.exp(-1.5 * dt));
      const changed = Math.abs(next - shown) > 0.004;
      shown = next;
      const pulse = Math.sin(time * 1.4) * 0.5 + 0.5;
      bark.color.copy(silverBark).lerp(goldBark, shown);
      strand.update(shown, time, pulse, flare);
      bark.emissiveIntensity =
        0.12 + shown * 1.6 + pulse * 0.15 * (0.3 + shown);
      // Leaves and figures glow brighter than white as the tree lights, so they bloom.
      if (crown.material instanceof MeshBasicMaterial)
        crown.material.color.setScalar(
          0.6 + shown * 0.95 + pulse * 0.1 + flare * 0.5,
        );
      if (sitters.material instanceof MeshBasicMaterial)
        sitters.material.color.setScalar(0.45 + shown * 1.25);
      if (changed) {
        for (let at = 0; at < crown.count; at += 1) {
          const pick = at % 3;
          tint
            .copy(silverLeaf[pick] ?? silverBark)
            .lerp(goldLeaf[pick] ?? goldBark, shown);
          crown.setColorAt(at, tint);
        }
        if (crown.instanceColor !== null)
          crown.instanceColor.needsUpdate = true;
      }
      stars.rotation.y = time * 0.05;
      if (stars.material instanceof PointsMaterial)
        stars.material.opacity = 0.18 + shown * 0.7;
    },
  };
}
