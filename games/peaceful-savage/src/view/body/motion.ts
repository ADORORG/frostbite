import { Vector3 } from "three";

import { noise } from "../palette.ts";
import type { Expression, Face } from "./face.ts";
import type { Hair } from "./hair.ts";
import {
  applyPose,
  type Channel,
  clampTo,
  type Pose,
  type Rig,
  sides,
} from "./rig.ts";

// How a body moves, frame by frame, in layers: what it is doing (a pose, given by whoever drives it), the walk (stride from speed, hips
// that bob and sway, shoulders turning against the hips, arms that swing, a lean into the walk and into turns), and life (breathing,
// blinks, eyes then head turning to what matters, curls that bounce). Every change of pose is eased, never snapped. On uneven ground each
// foot is set on the ground by bending its own leg (two-bone IK).
export interface MotionInput {
  readonly dt: number;
  readonly expression: Expression;
  // The ground's height under a point of the world.
  readonly ground: (x: number, z: number) => number;
  readonly lookAt: Vector3 | null;
  // The pose of what the body is doing; null to let the walk and life do it all.
  readonly pose: Pose | null;
  // True when the pose wants the arms (a hand-key, a hug): the walk then leaves them alone.
  readonly poseArms: boolean;
  readonly speed: number;
  readonly time: number;
  readonly turn: number;
}

export interface Motion {
  // The pose being shown now, eased toward what was asked.
  readonly current: Readonly<Record<string, number>>;
  update(input: MotionInput): void;
}

const ease = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

export function createMotion(
  rig: Rig,
  face: Face,
  hair: Hair,
  seed: number,
): Motion {
  const random = noise(seed);
  const current: Record<string, number> = {};
  let stride = random();
  let nextBlink = 1 + random() * 3;
  let blinking = -1;
  const headWas = new Vector3();
  const headNow = new Vector3();
  const velocityWas = new Vector3();
  const springs = hair.springs.map(() => ({
    offset: new Vector3(),
    velocity: new Vector3(),
  }));
  const b = rig.build;
  const legLength = b.thigh + b.shin;

  // How much of a run there is in the stride: none at a walk, all of it from a little past a fast walk.
  const runOf = (speed: number): number =>
    Math.max(0, Math.min(1, (speed - 2.3) / 0.8));

  function walk(speed: number, turn: number, arms: boolean): Pose {
    const amount = Math.min(1.25, speed / 1.5);
    if (amount < 0.02) return {};
    const run = runOf(speed);
    const t = stride * Math.PI * 2;
    const swing = Math.sin(t);
    // Running: a lean into it, a bounce, knees lifted high, arms bent and pumping.
    const pose: Record<string, number> = {
      "hips.drop": -Math.abs(Math.cos(t)) * (0.028 + run * 0.03) * amount,
      "hips.sway": swing * 0.02 * amount,
      "hips.turn": swing * (0.13 + run * 0.05) * amount,
      "spine.bend": (0.05 + run * 0.14) * amount,
      "spine.side": -turn * 0.05,
      "spine.twist": -swing * (0.17 + run * 0.08) * amount,
      "head.nod": -(0.03 + run * 0.08) * amount,
    };
    for (const side of sides) {
      const s = side === "L" ? 1 : -1;
      pose[`leg.front${side}`] = s * swing * (0.5 + run * 0.22) * amount;
      pose[`knee${side}`] =
        0.1 + Math.max(0, s * Math.cos(t)) * (1.05 + run * 0.55) * amount;
      pose[`ankle${side}`] = -s * swing * 0.18 * amount;
      if (!arms) {
        pose[`arm.front${side}`] = -s * swing * (0.42 + run * 0.3) * amount;
        pose[`elbow${side}`] = 0.25 + 0.3 * amount + run * 0.95;
      }
    }
    return pose;
  }

  // Bends each leg so its foot stands on the ground under it: the body sits on the lower foot, the higher one folds.
  function plant(
    target: Record<string, number>,
    ground: (x: number, z: number) => number,
  ): void {
    rig.root.updateMatrixWorld(true);
    const heights = sides.map((side) => {
      const ankle = rig.joint(`ankle${side}`).getWorldPosition(new Vector3());
      return ground(ankle.x, ankle.z);
    });
    const low = Math.min(...heights);
    rig.root.position.y = low;
    sides.forEach((side, index) => {
      const lift = Math.min(legLength * 0.45, (heights[index] ?? low) - low);
      if (lift <= 0.002) return;
      const d = legLength - lift;
      const knee =
        Math.PI -
        Math.acos(
          Math.min(
            1,
            (b.thigh ** 2 + b.shin ** 2 - d ** 2) / (2 * b.thigh * b.shin),
          ),
        );
      const hip = Math.acos(
        Math.min(1, (b.thigh ** 2 + d ** 2 - b.shin ** 2) / (2 * b.thigh * d)),
      );
      target[`knee${side}`] = (target[`knee${side}`] ?? 0) + knee;
      target[`leg.front${side}`] = (target[`leg.front${side}`] ?? 0) + hip;
      target[`ankle${side}`] = (target[`ankle${side}`] ?? 0) - (knee - hip);
    });
  }

  return {
    current,
    update(input) {
      const dt = Math.min(0.1, Math.max(0, input.dt));
      // A run's stride is longer, so the feet do not blur.
      stride +=
        (input.speed * dt) /
        Math.max(0.4, legLength * (1.35 + runOf(input.speed) * 0.55));
      const target: Record<string, number> = { ...(input.pose ?? {}) };
      for (const [name, value] of Object.entries(
        walk(input.speed, input.turn, input.poseArms),
      ))
        target[name] = (target[name] ?? 0) + value;
      // Breathing, all the time; a slow shift of weight when still.
      target["chest.bend"] =
        (target["chest.bend"] ?? 0) + Math.sin(input.time * 1.6 + seed) * 0.025;
      if (input.speed < 0.05)
        target["hips.roll"] =
          (target["hips.roll"] ?? 0) +
          Math.sin(input.time * 0.35 + seed) * 0.025;
      // Eyes first, then the head, turn to what matters.
      if (input.lookAt !== null) {
        const local = rig.root.worldToLocal(input.lookAt.clone());
        const height = rig.legLength + b.torso + b.neck;
        const yaw = Math.atan2(local.x, local.z);
        const pitch = Math.atan2(
          local.y - height,
          Math.hypot(local.x, local.z),
        );
        const yawHead = Math.max(-1.0, Math.min(1.0, yaw * 0.7));
        target["head.turn"] =
          (target["head.turn"] ?? 0) + (Math.abs(yaw) < 2.2 ? yawHead : 0);
        target["head.nod"] = (target["head.nod"] ?? 0) - pitch * 0.5;
        face.look(
          Math.max(-0.5, Math.min(0.5, yaw - yawHead)),
          Math.max(-0.35, Math.min(0.35, pitch * 0.5)),
        );
      } else face.look(0, 0);
      plant(target, input.ground);
      const channels = new Set([
        ...Object.keys(target),
        ...Object.keys(current),
      ]);
      for (const channel of channels)
        current[channel] = ease(
          current[channel] ?? 0,
          clampTo(channel, target[channel] ?? 0),
          11,
          dt,
        );
      const pose: Partial<Record<Channel, number>> = {};
      Object.assign(pose, current);
      applyPose(rig, pose);
      // A blink every two to six seconds.
      nextBlink -= dt;
      if (nextBlink <= 0 && blinking < 0) {
        blinking = 0;
        nextBlink = 2 + random() * 4;
      }
      if (blinking >= 0) blinking += dt;
      if (blinking > 0.16) blinking = -1;
      face.blink(
        blinking < 0
          ? input.expression === "calm"
            ? 0.35
            : 0
          : Math.sin((blinking / 0.16) * Math.PI),
      );
      face.brows(
        input.expression === "worry"
          ? -0.6
          : input.expression === "open"
            ? 0.5
            : 0.1,
      );
      face.show(input.expression);
      // Curls bounce: each puff on a spring that the head's own movement pulls.
      rig.root.updateMatrixWorld(true);
      rig.joint("head").getWorldPosition(headNow);
      const velocity = headNow
        .clone()
        .sub(headWas)
        .divideScalar(Math.max(dt, 1e-3));
      const pull = velocity.clone().sub(velocityWas).multiplyScalar(-0.0016);
      headWas.copy(headNow);
      velocityWas.copy(velocity);
      hair.springs.forEach((spring, index) => {
        const state = springs[index];
        if (state === undefined || dt === 0) return;
        state.velocity
          .addScaledVector(pull, 60)
          .addScaledVector(state.offset, -140 * dt)
          .multiplyScalar(Math.exp(-7 * dt));
        state.offset
          .addScaledVector(state.velocity, dt)
          .clampLength(0, b.head * 0.25);
        spring.joint.position.copy(spring.rest).add(state.offset);
      });
    },
  };
}
