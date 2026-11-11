import { Vector3, type PerspectiveCamera } from "three";

// The camera: one rig that eases toward a pose and never snaps. While a round is played it rides above and behind the hero, looking a little
// ahead of where it runs (further back when the hero grows); a new round opens with a sweep down from high over the scene; the hero select
// looks at the front of the turntable; the end of a run circles the hero slowly. A hit shakes it, unless the player asked for less motion.
type Mode = "chase" | "finale" | "select";

// Where the hero select leaves its hero in sight: the middle of that room and how tall it is, as shares of the screen.
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

export interface CameraRig {
  readonly chase: () => void;
  readonly finale: () => void;
  // Says where on the screen the hero select's hero is to stand.
  readonly frame: (room: Frame) => void;
  // Starts the sweep down into a new round.
  readonly intro: () => void;
  readonly select: (front: Vector3) => void;
  readonly shake: (amount: number) => void;
  readonly update: (
    dt: number,
    focus: Vector3,
    velocity: Vector3,
    grown: number,
  ) => void;
}

const ease = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const settle = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
// How tall a hero on the turntable is taken to be, and how far it may stand over the writing above and below its room.
const heroSpan = 1.25;
const overlap = 1.35;

export function createCameraRig(
  camera: PerspectiveCamera,
  stillness: () => boolean,
): CameraRig {
  let mode: Mode = "select";
  let sweep = 1;
  let shaking = 0;
  let clock = 0;
  let orbit = 0;
  let room: Frame = { height: 1, x: 0.5, y: 0.5 };
  let shiftX = 0;
  let shiftY = 0;
  const front = new Vector3();
  const look = new Vector3(0, 1, 0);
  const wantPlace = new Vector3();
  const wantLook = new Vector3();
  const high = new Vector3();
  const lead = new Vector3();
  camera.position.set(0, 9, 14);

  function chasePose(focus: Vector3, velocity: Vector3, grown: number): void {
    const back = (camera.aspect < 1 ? 1.22 : 1) * (1 + 0.5 * grown);
    lead.copy(velocity).multiplyScalar(0.28).clampLength(0, 2.2);
    wantPlace.set(
      focus.x + lead.x * 0.4,
      focus.y * 0.35 + 5.3 * back,
      focus.z + 6.1 * back + lead.z * 0.4,
    );
    wantLook.set(
      focus.x + lead.x,
      focus.y * 0.5 + 0.7 + 0.4 * grown,
      focus.z - 1.1 + lead.z,
    );
  }

  return {
    chase() {
      mode = "chase";
    },
    frame(next) {
      room = next;
    },
    finale() {
      mode = "finale";
      orbit = Math.atan2(
        camera.position.x - look.x,
        camera.position.z - look.z,
      );
    },
    intro() {
      mode = "chase";
      sweep = 0;
    },
    select(at) {
      mode = "select";
      front.copy(at);
    },
    shake(amount) {
      if (!stillness()) shaking = Math.min(1, shaking + amount);
    },
    update(dt, focus, velocity, grown) {
      clock += dt;
      let rate = 3.2;
      if (mode === "select") {
        // The card covers part of the screen, so the hero is framed in the room it leaves: the camera stands far enough back for the hero
        // to fit that room's height, and the lens is shifted (below) so the hero stands in its middle.
        const reach = 2 * Math.tan((camera.fov * Math.PI) / 360);
        const back = Math.max(
          camera.aspect < 1 ? 4.4 : 3.6,
          heroSpan / (reach * Math.max(0.05, room.height) * overlap),
        );
        wantPlace.set(
          front.x + Math.sin(clock * 0.25) * 0.3,
          front.y + 1.35,
          front.z + back,
        );
        wantLook.set(front.x, front.y + 0.62, front.z);
        rate = 2.4;
      } else if (mode === "finale") {
        orbit += dt * 0.22;
        wantPlace.set(
          focus.x + Math.sin(orbit) * 5.2,
          focus.y + 2.6,
          focus.z + Math.cos(orbit) * 5.2,
        );
        wantLook.set(focus.x, focus.y + 0.8, focus.z);
        rate = 1.8;
      } else {
        chasePose(focus, velocity, grown);
        if (sweep < 1) {
          sweep = Math.min(1, sweep + dt / 2.4);
          const t = ease(sweep);
          high.set(focus.x * 0.3 + 9, 24, focus.z + 26);
          wantPlace.lerpVectors(high, wantPlace, t);
          rate = 2 + 10 * t;
        }
      }
      camera.position.lerp(wantPlace, settle(rate, dt));
      look.lerp(wantLook, settle(rate * 1.5, dt));
      camera.lookAt(look);
      // The lens shift eases like the camera does, and is let go of once a run has the whole screen.
      const wantX = mode === "select" ? 0.5 - room.x : 0;
      const wantY = mode === "select" ? 0.5 - room.y : 0;
      const near = stillness() ? 1 : settle(rate * 1.5, dt);
      shiftX += (wantX - shiftX) * near;
      shiftY += (wantY - shiftY) * near;
      const { aspect } = camera;
      if (Math.abs(shiftX) + Math.abs(shiftY) > 0.0005)
        camera.setViewOffset(aspect, 1, shiftX * aspect, shiftY, aspect, 1);
      else if (camera.view?.enabled === true) camera.clearViewOffset();
      if (shaking > 0.001) {
        const amount = shaking * shaking * 0.35;
        camera.position.x += Math.sin(clock * 61) * amount;
        camera.position.y += Math.sin(clock * 47 + 1.3) * amount;
        shaking *= Math.exp(-7 * dt);
        camera.lookAt(look);
      }
    },
  };
}
