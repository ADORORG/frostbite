import {
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  type AnimationAction,
  type Mesh,
  type MeshBasicMaterial,
  type Object3D,
  type PlaneGeometry,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

import type { Lead } from "../rules/leads.ts";
import { makeBlob, placeBlob } from "./blob.ts";
import type { Model } from "./models/load.ts";

// One hero on the screen: the rig Blender made, with its eleven clips blended by what the hero is doing, and on top of them what only the
// moment knows: the turn into a heading, the lean into a turn, the squash of a landing, the spin of a roll, the swell of growing and the
// flicker of the moment after a hit. Nothing here changes a run; it only shows one.
export type Clip =
  | "Duck"
  | "Hit"
  | "Hop"
  | "Hover"
  | "Idle"
  | "Lose"
  | "Roll"
  | "Run"
  | "Select"
  | "Shoot"
  | "Win";

const once: ReadonlySet<Clip> = new Set([
  "Duck",
  "Hit",
  "Hop",
  "Lose",
  "Shoot",
]);

export interface HeroFrame {
  readonly airborne: boolean;
  readonly ducking: boolean;
  readonly facing: number;
  readonly grown: boolean;
  readonly hovering: boolean;
  readonly lost: boolean;
  readonly place: Vector3;
  readonly rolling: boolean;
  readonly safe: boolean;
  readonly select: boolean;
  readonly shooting: boolean;
  readonly speed: number;
  readonly stunned: boolean;
  readonly won: boolean;
}

const shortest = (from: number, to: number): number => {
  let turn = (to - from) % (Math.PI * 2);
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  return turn;
};

export class HeroView {
  readonly root = new Group();
  private readonly tilt = new Group();
  private readonly body: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<Clip, AnimationAction>();
  private readonly shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly centre: number;
  private readonly grownScale: number;
  private current: Clip | null = null;
  private yaw = 0;
  private turnRate = 0;
  private squash = 0;
  private squashSpeed = 0;
  private size = 1;
  private sizeSpeed = 0;
  private spin = 0;
  private wasAirborne = false;
  private clock = 0;

  constructor(
    model: Model,
    readonly lead: Lead,
  ) {
    this.body = clone(model.scene);
    this.centre = lead.height / 2000;
    this.grownScale = 2000 / lead.height;
    this.body.position.y = -this.centre;
    this.tilt.position.y = this.centre;
    this.tilt.add(this.body);
    this.root.add(this.tilt);
    this.mixer = new AnimationMixer(this.body);
    for (const clip of model.clips) {
      const name = clip.name;
      if (!isClip(name)) continue;
      const action = this.mixer.clipAction(clip);
      if (once.has(name)) {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      } else action.setLoop(LoopRepeat, Infinity);
      this.actions.set(name, action);
    }
    this.shadow = makeBlob((lead.radius / 1000) * 2.6);
    this.play("Idle", 0);
  }

  // The blob shadow lives on the floor, not in the hero, so it is added to the scene beside it.
  get blob(): Object3D {
    return this.shadow;
  }

  play(clip: Clip, fade = 0.15, restart = false): void {
    const next = this.actions.get(clip);
    if (next === undefined) return;
    if (this.current === clip && !restart) return;
    const last =
      this.current === null ? undefined : this.actions.get(this.current);
    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (last !== undefined && last !== next && fade > 0)
      last.crossFadeTo(next, fade, false);
    else if (last !== undefined && last !== next) last.stop();
    this.current = clip;
  }

  private choose(frame: HeroFrame): Clip {
    if (frame.select) return "Select";
    if (frame.won) return "Win";
    if (frame.lost) return "Lose";
    if (frame.stunned) return "Hit";
    if (frame.rolling) return "Roll";
    if (frame.airborne) return frame.hovering ? "Hover" : "Hop";
    if (frame.ducking) return "Duck";
    if (frame.shooting) return "Shoot";
    return frame.speed > 22 ? "Run" : "Idle";
  }

  update(dt: number, frame: HeroFrame): void {
    this.clock += dt;
    const clip = this.choose(frame);
    const landed = this.wasAirborne && !frame.airborne;
    if (frame.airborne && !this.wasAirborne && !frame.hovering)
      this.play("Hop", 0.06, true);
    else this.play(clip, clip === "Hit" || clip === "Duck" ? 0.06 : 0.16);
    this.wasAirborne = frame.airborne;
    const running = this.actions.get("Run");
    running?.setEffectiveTimeScale(
      Math.min(1.7, Math.max(0.6, frame.speed / this.lead.runSpeed)),
    );
    this.mixer.update(dt);

    // Turn toward the heading, and lean into the turn.
    const heading = frame.facing;
    const turn = shortest(this.yaw, heading);
    const step = turn * (1 - Math.exp(-14 * dt));
    this.yaw += step;
    this.turnRate +=
      ((dt > 0 ? step / dt : 0) - this.turnRate) * (1 - Math.exp(-10 * dt));
    this.root.position.copy(frame.place);
    this.root.rotation.y = this.yaw;

    // A landing squashes, then springs back.
    if (landed) this.squashSpeed -= 3.2;
    this.squashSpeed += (-this.squash * 140 - this.squashSpeed * 12) * dt;
    this.squash += this.squashSpeed * dt;

    // Growing swells past the new size and settles.
    const wantSize = frame.grown ? this.grownScale : 1;
    this.sizeSpeed += ((wantSize - this.size) * 90 - this.sizeSpeed * 11) * dt;
    this.size += this.sizeSpeed * dt;

    // A roll spins the hero over its own middle.
    const speed = frame.speed * 0.06;
    this.spin = frame.rolling
      ? this.spin + (speed / Math.max(0.3, this.centre)) * dt
      : this.spin * Math.exp(-12 * dt);
    const lean = Math.max(
      -0.32,
      Math.min(0.32, -this.turnRate * 0.045 * Math.min(1, frame.speed / 60)),
    );
    this.tilt.rotation.set(
      this.spin + (frame.speed > 22 && !frame.airborne ? 0.06 : 0),
      0,
      lean,
    );
    const stretch = Math.max(-0.4, Math.min(0.4, this.squash));
    this.tilt.scale.set(
      this.size * (1 - stretch * 0.5),
      this.size * (1 + stretch),
      this.size * (1 - stretch * 0.5),
    );
    this.tilt.position.y = this.centre * this.size;
    this.body.visible = !frame.safe || Math.floor(this.clock * 14) % 2 === 0;
    placeBlob(
      this.shadow,
      frame.place.x,
      frame.place.z,
      frame.place.y,
      (this.lead.radius / 1000) * 2.6 * this.size,
    );
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    this.shadow.removeFromParent();
  }
}

const clips: ReadonlySet<string> = new Set([
  "Duck",
  "Hit",
  "Hop",
  "Hover",
  "Idle",
  "Lose",
  "Roll",
  "Run",
  "Select",
  "Shoot",
  "Win",
]);
const isClip = (name: string): name is Clip => clips.has(name);

// The heading of one of the sixteen ways, as a turn about the up axis (a hero is modelled facing south, toward the camera).
export const headingOf = (dx: number, dy: number): number => Math.atan2(dx, dy);

export const scratch = new Vector3();
