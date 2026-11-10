import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
  type Scene,
} from "three";

import { leads } from "../rules/leads.ts";
import { HeroView } from "./hero.ts";
import type { Models } from "./models/load.ts";

// The hero select: the five heroes in a ring on the floe, each on a glowing ring of frost, turning so the one being looked at stands at the
// front, facing the camera and posing. The others idle and watch.
const radius = 2.7;
const centre = new Vector3(0, 0, -1.2);
const waiting = {
  airborne: false,
  ducking: false,
  facing: 0,
  grown: false,
  hovering: false,
  lost: false,
  place: new Vector3(),
  rolling: false,
  safe: false,
  select: false,
  shooting: false,
  speed: 0,
  stunned: false,
  won: false,
} as const;
const posing = { ...waiting, select: true } as const;
const modelOf = {
  hrimm: "hero-hrimm",
  lumen: "hero-lumen",
  nib: "hero-nib",
  pip: "hero-pip",
  volt: "hero-volt",
} as const;

export class Turntable {
  readonly group = new Group();
  private readonly heroes: HeroView[] = [];
  private readonly rings: Mesh<RingGeometry, MeshBasicMaterial>[] = [];
  private turn = 0;
  private turnSpeed = 0;
  private chosen = 0;
  private readonly at = new Vector3();

  constructor(scene: Scene, models: Models) {
    this.group.position.copy(centre);
    scene.add(this.group);
    const ringShape = new RingGeometry(0.62, 0.78, 48).rotateX(-Math.PI / 2);
    leads.forEach((lead, index) => {
      const hero = new HeroView(models(modelOf[lead.id]), lead);
      const angle = (index / leads.length) * Math.PI * 2;
      const seat = new Group();
      seat.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
      seat.rotation.y = angle;
      seat.add(hero.root);
      const ring = new Mesh(
        ringShape,
        new MeshBasicMaterial({
          blending: AdditiveBlending,
          color: "#9fe8ff",
          depthWrite: false,
          toneMapped: false,
          transparent: true,
        }),
      );
      ring.position.y = 0.03;
      seat.add(ring, hero.blob);
      hero.blob.position.set(0, 0.02, 0);
      this.group.add(seat);
      this.heroes.push(hero);
      this.rings.push(ring);
    });
  }

  get count(): number {
    return this.heroes.length;
  }

  choose(index: number): void {
    this.chosen = ((index % this.count) + this.count) % this.count;
    this.heroes[this.chosen]?.play("Select", 0.2, true);
  }

  // Where the chosen hero stands, in the scene.
  front(): Vector3 {
    return this.at.set(centre.x, 0, centre.z + radius);
  }

  set shown(on: boolean) {
    this.group.visible = on;
  }

  update(dt: number): void {
    if (!this.group.visible) return;
    // Turn the ring the short way round to the chosen hero.
    const want = -(this.chosen / this.count) * Math.PI * 2;
    let gap = (want - this.turn) % (Math.PI * 2);
    if (gap > Math.PI) gap -= Math.PI * 2;
    if (gap < -Math.PI) gap += Math.PI * 2;
    this.turnSpeed += (gap * 60 - this.turnSpeed * 11) * dt;
    this.turn += this.turnSpeed * dt;
    this.group.rotation.y = this.turn;
    this.heroes.forEach((hero, index) => {
      const front = index === this.chosen;
      hero.update(dt, front ? posing : waiting);
      // The blob shadow is placed in the seat's own space.
      hero.blob.position.set(0, 0.02, 0);
      const ring = this.rings[index];
      if (ring !== undefined) {
        ring.material.opacity = front ? 0.85 : 0.22;
        ring.scale.setScalar(
          front ? 1.15 + 0.05 * Math.sin(performance.now() / 300) : 1,
        );
      }
    });
  }
}
