import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Object3D,
  type PlaneGeometry as Plane,
  type Scene,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  dart as dartRule,
  snowball as snowballRule,
} from "../rules/constants.ts";
import type { Bolt, Dart, Snowball } from "../rules/types.ts";
import { makeBlob, placeBlob } from "./blob.ts";
import type { Models } from "./models/load.ts";
import { mix } from "./space.ts";

// What is thrown at the hero: snowballs that drop in from the sky and roll (turning about the right axis for where they go), ice darts that
// hang at the edge with a line showing their path before they fly, and the hero's own frost bolts. Each is drawn between the last two ticks,
// so it moves smoothly whatever the screen's rate.
interface Rolling {
  readonly root: Group;
  readonly ball: Object3D;
  readonly blob: Mesh<Plane, MeshBasicMaterial>;
  seen: number;
}

interface Flying {
  readonly root: Group;
  readonly line: Mesh<Plane, MeshBasicMaterial>;
  seen: number;
}

const dropTime = snowballRule.incomingTicks * 3;
const lineGeometry = new PlaneGeometry(1, 1)
  .rotateX(-Math.PI / 2)
  .translate(0, 0, 0.5);
const spinAxis = new Vector3();
const spinTurn = new Quaternion();

export class HazardsView {
  private readonly group = new Group();
  private readonly balls = new Map<number, Rolling>();
  private readonly darts = new Map<number, Flying>();
  private readonly bolts = new Map<number, Group>();
  private frame = 0;
  private clock = 0;

  constructor(
    scene: Scene,
    private readonly models: Models,
  ) {
    scene.add(this.group);
  }

  // Takes everything off the stage at once (a round is over, or the run is): the shadows and the warning lines go with what cast them.
  clear(): void {
    for (const each of this.darts.values()) each.line.material.dispose();
    this.group.clear();
    this.balls.clear();
    this.darts.clear();
    this.bolts.clear();
  }

  update(
    dt: number,
    slow: number,
    share: number,
    now: {
      readonly snowballs: readonly Snowball[];
      readonly darts: readonly Dart[];
      readonly bolts: readonly Bolt[];
      readonly hazardClock: number;
    },
    before: {
      readonly snowballs: readonly Snowball[];
      readonly darts: readonly Dart[];
      readonly bolts: readonly Bolt[];
    },
  ): void {
    this.frame += 1;
    this.clock += dt * slow;
    const last = <T extends { readonly id: number }>(
      list: readonly T[],
      id: number,
    ): T | undefined => list.find((each) => each.id === id);
    for (const ball of now.snowballs)
      this.showBall(
        ball,
        last(before.snowballs, ball.id),
        share,
        now.hazardClock,
        dt * slow,
      );
    for (const dart of now.darts)
      this.showDart(dart, last(before.darts, dart.id), share, now.hazardClock);
    for (const bolt of now.bolts)
      this.showBolt(bolt, last(before.bolts, bolt.id), share);
    this.sweep();
  }

  private showBall(
    ball: Snowball,
    was: Snowball | undefined,
    share: number,
    clock: number,
    dt: number,
  ): void {
    let view = this.balls.get(ball.id);
    if (view === undefined) {
      const body = clone(this.models("snowball").scene);
      const root = new Group();
      root.add(body);
      const blob = makeBlob(1, 0.6);
      this.group.add(root, blob);
      view = { ball: body, blob, root, seen: 0 };
      this.balls.set(ball.id, view);
    }
    view.seen = this.frame;
    const r = ball.r / 1000;
    const x = mix((was ?? ball).x, ball.x, share) / 1000;
    const z = mix((was ?? ball).y, ball.y, share) / 1000;
    const falling = Math.max(0, Math.min(1, (ball.rollsAt - clock) / dropTime));
    const y = r + falling * falling * 11;
    view.root.position.set(x, y, z);
    view.ball.scale.setScalar(ball.r / 500);
    if (falling <= 0) {
      const speed = Math.hypot(ball.vx, ball.vy) * 0.06;
      spinAxis.set(ball.vy, 0, -ball.vx).normalize();
      if (spinAxis.lengthSq() > 0)
        view.ball.quaternion.premultiply(
          spinTurn.setFromAxisAngle(spinAxis, -(speed / r) * dt),
        );
    }
    placeBlob(view.blob, x, z, y - r, r * 2.4);
  }

  private showDart(
    dart: Dart,
    was: Dart | undefined,
    share: number,
    clock: number,
  ): void {
    let view = this.darts.get(dart.id);
    if (view === undefined) {
      const root = new Group();
      root.add(clone(this.models("dart").scene));
      const line = new Mesh(
        lineGeometry,
        new MeshBasicMaterial({
          blending: AdditiveBlending,
          color: "#9fe8ff",
          depthWrite: false,
          toneMapped: false,
          transparent: true,
        }),
      );
      this.group.add(root, line);
      view = { line, root, seen: 0 };
      this.darts.set(dart.id, view);
    }
    view.seen = this.frame;
    const x = mix((was ?? dart).x, dart.x, share) / 1000;
    const z = mix((was ?? dart).y, dart.y, share) / 1000;
    const heading = Math.atan2(dart.vx, dart.vy);
    view.root.position.set(x, dartRule.height / 1000, z);
    view.root.rotation.set(0, heading, 0);
    const waiting = (dart.fliesAt - clock) / (dartRule.telegraphTicks * 3);
    const telegraph = Math.max(0, Math.min(1, waiting));
    view.root.rotateZ(telegraph > 0 ? this.clock * 9 : 0);
    // The warning line runs from the dart along its path, brightest just before it flies.
    const left = Math.max(0, dart.range - dart.travelled) / 1000;
    view.line.visible = left > 0.5;
    view.line.position.set(x, 0.05, z);
    view.line.rotation.y = heading;
    view.line.scale.set(0.08 + 0.08 * (1 - telegraph), 1, left);
    const blink =
      telegraph > 0
        ? 0.18 + 0.4 * (1 - telegraph) * (0.6 + 0.4 * Math.sin(this.clock * 24))
        : 0.08;
    view.line.material.opacity = blink;
  }

  private showBolt(bolt: Bolt, was: Bolt | undefined, share: number): void {
    let view = this.bolts.get(bolt.id);
    if (view === undefined) {
      view = new Group();
      view.add(clone(this.models("bolt").scene));
      this.group.add(view);
      this.bolts.set(bolt.id, view);
    }
    view.userData.seen = this.frame;
    view.position.set(
      mix((was ?? bolt).x, bolt.x, share) / 1000,
      0.62,
      mix((was ?? bolt).y, bolt.y, share) / 1000,
    );
    view.rotation.set(this.clock * 7, this.clock * 11, 0);
  }

  // Whatever the rules no longer hold is gone (the effects have already burst it).
  private sweep(): void {
    for (const [id, view] of this.balls)
      if (view.seen !== this.frame) {
        view.root.removeFromParent();
        view.blob.removeFromParent();
        this.balls.delete(id);
      }
    for (const [id, view] of this.darts)
      if (view.seen !== this.frame) {
        view.root.removeFromParent();
        view.line.removeFromParent();
        view.line.material.dispose();
        this.darts.delete(id);
      }
    for (const [id, view] of this.bolts)
      if (view.userData.seen !== this.frame) {
        view.removeFromParent();
        this.bolts.delete(id);
      }
  }
}
