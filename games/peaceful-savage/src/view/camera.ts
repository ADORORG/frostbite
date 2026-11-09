import { type PerspectiveCamera, Vector3 } from "three";

import type { Box } from "../rules/geometry.ts";
import { clearance, overGround } from "./clearance.ts";
import type { Placed } from "./family.ts";
import type { Framing } from "./farewell.ts";

// A camera that knows the family. It is one boom on springs round the lead, eased toward the shot the moment asks for, never snapped:
//
// - follow: behind the lead, just above head height, looking past the head to the way ahead; back and up a little more for each of the
//   family walking with them, so nobody stands in the way. The boom turns slower than the body, so a sharp turn shows the lead's profile
//   for a beat before the camera swings round behind again;
// - lean: when the lead leans in beside someone, the boom swings round to the front and pulls back to show the whole body;
// - group: with the family gathered, it widens and lifts to keep them all in;
// - talk: over the lead's shoulder toward whoever (or whatever grey one) they are with;
// - hands: in close on the hands as a hand-key rises and lands, from the front and a little to the side;
// - breath: a little further back, on the chest and the face, as the breath fills and lets go;
// - dance: pulled back and round, to see the whole body dance;
// - vision: lifted and pulled back, so the gold thread ahead can be seen;
// - finale: low and wide on the hill, looking up at the giant snake (it cuts between this and the hands on the six keys);
// - farewell: the farewell's own shots (see farewell.ts);
// - select: in front of the one on the turntable.
//
// The boom never passes through a wall: where one stands between the lead's head and the camera, the camera comes in to this side of it
// (keeping its height); for a close shot, and for following, it looks round the lead for an angle with nothing in the way first.
export type Intent =
  | "breath"
  | "dance"
  | "farewell"
  | "finale"
  | "follow"
  | "group"
  | "hands"
  | "lean"
  | "select"
  | "talk"
  | "vision";

export interface CameraFrame {
  readonly camera: PerspectiveCamera;
  readonly dt: number;
  // Who or what else is in the shot (the one talked to, the snake), if anyone.
  readonly focus: Vector3 | null;
  // The farewell's shot, while it plays.
  readonly framing: Framing | null;
  readonly group: readonly Placed[];
  // Between the lead's hands.
  readonly hands: Vector3 | null;
  // The height of the ground at a point (it rises on the hill), so the camera never goes under it.
  readonly ground?: (x: number, z: number) => number;
  readonly intent: Intent;
  readonly lead: Placed;
  readonly walls: readonly Box[];
}

export interface CameraRig {
  // Jumps straight to the shot (on the first frame, or after a cut).
  cut(): void;
  update(frame: CameraFrame): void;
}

interface Shot {
  readonly distance: number;
  // A close shot may look round the lead for an angle with no wall in the way.
  readonly flex?: true;
  readonly fov: number;
  readonly height: number;
  readonly look: Vector3;
  // The boom's angle, behind the lead (0) or in front (pi).
  readonly swing: number;
}

const forward = (yaw: number): Vector3 =>
  new Vector3(Math.sin(yaw), 0, Math.cos(yaw));

function shotFor(frame: CameraFrame): Shot {
  const { lead } = frame;
  const h = lead.height;
  const head = lead.at.clone().add(new Vector3(0, h * 0.88, 0));
  switch (frame.intent) {
    case "lean":
      return {
        distance: h * 2.1,
        fov: 44,
        height: h * 0.62,
        look: lead.at.clone().add(new Vector3(0, h * 0.5, 0)),
        swing: Math.PI,
      };
    case "group": {
      const middle = frame.group
        .reduce((sum, one) => sum.add(one.at), lead.at.clone())
        .divideScalar(frame.group.length + 1);
      const spread = frame.group.reduce(
        (far, one) => Math.max(far, one.at.distanceTo(middle)),
        0,
      );
      return {
        distance: h * 2.2 + spread * 1.6,
        fov: 52,
        height: h * 1.45,
        look: middle.add(new Vector3(0, h * 0.62, 0)),
        swing: 0.35,
      };
    }
    case "talk": {
      const other =
        frame.focus ?? head.clone().add(forward(lead.yaw).multiplyScalar(2));
      return {
        distance: h * 1.55,
        fov: 46,
        height: h * 1.02,
        look: head.clone().lerp(other, 0.6),
        swing: 0.55,
      };
    }
    case "vision":
      return {
        distance: h * 2.5,
        fov: 54,
        height: h * 1.7,
        look: head.clone().add(forward(lead.yaw).multiplyScalar(3.2)),
        swing: 0,
      };
    case "hands": {
      const hands =
        frame.hands ?? lead.at.clone().add(new Vector3(0, h * 0.6, 0));
      return {
        distance: 0.45 + h * 0.38,
        flex: true,
        fov: 40,
        height: h * 0.68,
        look: hands.clone().lerp(head, 0.2),
        swing: 2.35,
      };
    }
    case "breath":
      return {
        distance: h * 1.25,
        flex: true,
        fov: 42,
        height: h * 0.8,
        look: lead.at.clone().add(new Vector3(0, h * 0.74, 0)),
        swing: 2.6,
      };
    case "dance":
      return {
        distance: h * 2.4,
        fov: 46,
        height: h * 0.75,
        look: lead.at.clone().add(new Vector3(0, h * 0.5, 0)),
        swing: 0.75,
      };
    // The farewell (see farewell.ts): the camera stands before its anchor, looking where the farewell says.
    case "farewell": {
      const framing = frame.framing;
      return {
        distance: framing?.distance ?? 5.5,
        fov: framing?.fov ?? 52,
        height: framing?.height ?? 1.5,
        look: framing?.look ?? lead.at.clone().add(new Vector3(0, h, 0)),
        swing: 0,
      };
    }
    case "finale": {
      const snake = frame.focus ?? lead.at.clone().add(new Vector3(0, 4, -4));
      return {
        distance: 8.5,
        fov: 58,
        height: 1.1,
        look: lead.at.clone().lerp(snake, 0.55),
        swing: 0.9,
      };
    }
    case "select":
      return {
        distance: h * 2.4 + 2.2,
        fov: 44,
        height: h * 0.8,
        look: lead.at
          .clone()
          .lerp(frame.focus ?? lead.at, 0.35)
          .add(new Vector3(0, h * 0.82, 0)),
        swing: Math.PI,
      };
    case "follow": {
      // Back and up a little more for each of the family walking with the lead, so none of them stands between the camera and the lead.
      const near = frame.group.filter(
        (one) => one.at.distanceTo(lead.at) < 4,
      ).length;
      return {
        distance: Math.max(2.4, h * 1.85) + near * 0.55,
        flex: true,
        fov: 50 + near * 1.5,
        height: h * 1.1 + 0.18 + near * 0.35,
        look: head.add(forward(lead.yaw).multiplyScalar(1.6 + near * 0.35)),
        swing: 0,
      };
    }
  }
}

// The ways round the lead a close shot tries, in turn, when a wall stands in the way of the one it asks for.
const aside = [0, 0.8, -0.8, 1.5, -1.5];

export function createCameraRig(): CameraRig {
  const position = new Vector3();
  const look = new Vector3();
  let swing = 0;
  let boom = 0;
  let fov = 50;
  let fresh = true;
  let flexed = 0;
  return {
    cut() {
      fresh = true;
    },
    update(frame) {
      const shot = shotFor(frame);
      const { lead, dt } = frame;
      const ease = (rate: number) => (fresh ? 1 : 1 - Math.exp(-rate * dt));
      // The boom trails the body's turn; the swing to the front or back is slower still.
      const gap = (to: number, from: number) =>
        Math.atan2(Math.sin(to - from), Math.cos(to - from));
      boom += gap(lead.yaw, boom) * ease(2.1);
      const head = lead.at.clone().add(new Vector3(0, shot.height, 0));
      const clearAt = (offset: number) =>
        clearance(
          head,
          head
            .clone()
            .sub(
              forward(boom + shot.swing + offset).multiplyScalar(shot.distance),
            ),
          frame.walls,
        );
      if (shot.flex !== true || clearAt(0) >= 0.98) flexed = 0;
      else if (clearAt(flexed) < 0.98)
        flexed = aside.reduce(
          (best, offset) => (clearAt(offset) > clearAt(best) ? offset : best),
          0,
        );
      swing += gap(shot.swing + flexed, swing) * ease(1.6);
      const yaw = boom + swing;
      let wanted = head.clone().sub(forward(yaw).multiplyScalar(shot.distance));
      const clear = clearance(head, wanted, frame.walls);
      // Brought in on this side of a wall, the camera keeps its height, so it still looks over the family rather than into them.
      if (clear < 1)
        wanted = head
          .clone()
          .lerp(wanted, Math.max(0.15, clear - 0.08))
          .setY(wanted.y);
      // Never under the hill, nor looking through it: lifted over the ground, where it stands and as it eases there.
      const ground = frame.ground ?? (() => 0);
      wanted.y += overGround(wanted, head, ground);
      position.lerp(wanted, ease(4.5));
      position.y += overGround(position, head, ground);
      look.lerp(shot.look, ease(6));
      fov += (shot.fov - fov) * ease(3);
      fresh = false;
      frame.camera.position.copy(position);
      frame.camera.fov = fov;
      frame.camera.updateProjectionMatrix();
      frame.camera.lookAt(look);
    },
  };
}
