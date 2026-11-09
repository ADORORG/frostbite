import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";

import { greyAt, greyHomes } from "../../rules/greys.ts";
import type { PlayState } from "../../rules/types.ts";
import { metres } from "./rooms.ts";

// The grey ones: small sly snakes, each a coil of smoke with heavy, sorrowful eyes (never fangs, never red eyes: they are grief, not
// monsters). They are only seen in Savage Vision, or once seen; a healed one turns gold and rises toward the tree as a little light.
const segments = 40;

interface Snake {
  readonly body: Mesh<TubeGeometry, MeshStandardMaterial>;
  readonly group: Group;
  readonly head: Group;
  lift: number;
  shown: number;
}

function coil(time: number, phase: number): Vector3[] {
  const points: Vector3[] = [];
  for (let at = 0; at <= 10; at += 1) {
    const t = at / 10;
    const angle = t * Math.PI * 1.6 + phase;
    const wave = Math.sin(time * 2 + t * 6 + phase) * 0.06;
    points.push(
      new Vector3(
        Math.cos(angle) * (0.42 - t * 0.2) + wave,
        0.06 + t * 0.32 + Math.sin(t * Math.PI) * 0.05,
        Math.sin(angle) * (0.42 - t * 0.2),
      ),
    );
  }
  return points;
}

function snake(): Snake {
  const group = new Group();
  const material = new MeshStandardMaterial({
    color: "#a7a9b2",
    emissive: new Color("#ffc04a"),
    emissiveIntensity: 0,
    opacity: 0.82,
    roughness: 0.9,
    transparent: true,
  });
  const body = new Mesh(
    new TubeGeometry(
      new CatmullRomCurve3(coil(0, 0)),
      segments,
      0.07,
      8,
      false,
    ),
    material,
  );
  group.add(body);
  const head = new Group();
  const skull = new Mesh(new SphereGeometry(0.11, 14, 10), material);
  skull.scale.set(1, 0.75, 1.3);
  head.add(skull);
  // Sorrowful eyes: pale, with heavy lids half down.
  for (const s of [1, -1]) {
    const eye = new Mesh(
      new SphereGeometry(0.025, 8, 6),
      new MeshStandardMaterial({ color: "#e9e4d8", roughness: 0.3 }),
    );
    eye.position.set(s * 0.06, 0.03, 0.09);
    head.add(eye);
    const lid = new Mesh(
      new SphereGeometry(0.03, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      material,
    );
    lid.position.copy(eye.position);
    lid.rotation.x = 0.5;
    head.add(lid);
  }
  group.add(head);
  return { body, group, head, lift: 0, shown: 0 };
}

export interface Greys {
  readonly group: Group;
  update(state: PlayState, vision: boolean, time: number, dt: number): void;
}

export function buildGreys(): Greys {
  const group = new Group();
  const snakes = greyHomes.map(() => {
    const made = snake();
    group.add(made.group);
    return made;
  });
  const scratch = new Vector3();
  return {
    group,
    update(state, vision, time, dt) {
      snakes.forEach((each, index) => {
        const grey = state.greys[index];
        const home = greyHomes[index];
        if (grey === undefined || home === undefined) return;
        const at = greyAt(home, grey.spot, grey.phase, state.tick);
        const target = new Vector3(metres(at.x), 0, metres(at.z));
        if (each.shown === 0) each.group.position.copy(target);
        each.group.position.lerp(target, 1 - Math.exp(-3 * dt));
        const visible = grey.seen || vision;
        each.shown +=
          ((visible ? 1 : 0) - each.shown) * (1 - Math.exp(-4 * dt));
        each.lift = grey.healed ? Math.min(6, each.lift + dt * 0.8) : 0;
        each.group.position.y = each.lift;
        each.group.visible = each.shown > 0.02 && each.lift < 5.8;
        const material = each.body.material;
        material.opacity =
          each.shown * (grey.healed ? 1 - each.lift / 6 : 0.82);
        material.color.set(grey.healed ? "#ffd27a" : "#a7a9b2");
        material.emissiveIntensity = grey.healed ? 1.6 : vision ? 0.15 : 0;
        // The coil moves like smoke: its curve is drawn again each frame.
        const curve = new CatmullRomCurve3(coil(time, index));
        const fresh = new TubeGeometry(curve, segments, 0.07, 8, false);
        const position = fresh.getAttribute("position");
        const own = each.body.geometry.getAttribute("position");
        if (
          own instanceof BufferAttribute &&
          position instanceof BufferAttribute
        ) {
          own.copy(position);
          own.needsUpdate = true;
        }
        fresh.dispose();
        curve.getPoint(1, scratch);
        each.head.position.copy(scratch);
        const facing = curve.getTangent(1);
        each.head.rotation.set(0, Math.atan2(facing.x, facing.z), 0);
      });
    },
  };
}
