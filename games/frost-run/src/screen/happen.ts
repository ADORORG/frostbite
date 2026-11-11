import { Vector3 } from "three";

import type { EffectName } from "../audio.ts";
import { cueOf } from "../cues.ts";
import type { Happening } from "../rules/types.ts";
import type { CameraRig } from "./camera.ts";
import type { Effects } from "./fx.ts";
import type { Stage } from "./stage.ts";

// What the screen and the speakers do when the rules say something happened. Only a crystal's take lights the orange flash.
export interface Moment {
  readonly sfx: (name: EffectName) => void;
  readonly flash: () => void;
  readonly shot: () => void;
}

const at = new Vector3();
let flashLeft = 0;

export function showHappening(
  happening: Happening,
  playerHeight: number,
  fx: Effects,
  camera: CameraRig,
  stage: Stage,
  moment: Moment,
): void {
  at.set(happening.x / 1000, 0.1, happening.y / 1000);
  const cue = cueOf(happening);
  if (cue.sfx !== null) moment.sfx(cue.sfx);
  if (cue.flash) moment.flash();
  switch (happening.kind) {
    case "take": {
      at.y = 0.5 + playerHeight;
      if (happening.detail === 0) {
        fx.burst({
          at,
          colour: "#3FE0A0",
          count: 26,
          glow: true,
          lift: 4,
          size: 0.09,
          speed: 3.4,
        });
        fx.ring(at.setY(0.05), "#3FE0A0", 2.2, 0.45);
        stage.flash.position.set(at.x, 1.2 + playerHeight, at.z);
        flashLeft = 0.26;
      } else if (happening.detail === 1) {
        fx.burst({
          at,
          colour: "#d8cdf5",
          count: 22,
          glow: true,
          lift: 3.2,
          size: 0.07,
          speed: 2.6,
        });
        fx.burst({ at, colour: "#f3efff", count: 10, size: 0.06, speed: 2 });
      } else {
        fx.burst({
          at,
          colour: "#cff4ff",
          count: 24,
          glow: true,
          lift: 3.6,
          size: 0.08,
          speed: 3,
        });
        fx.ring(at.setY(0.05), "#bfeaff", 1.8, 0.5);
      }
      return;
    }
    case "hit":
      at.y = 0.6;
      fx.burst({
        at,
        colour: "#f4f8ff",
        count: 30,
        lift: 3.4,
        size: 0.12,
        speed: 3.6,
      });
      camera.shake(0.9);
      return;
    case "free-hit":
      at.y = 0.7;
      fx.burst({
        at,
        colour: "#ffffff",
        count: 20,
        glow: true,
        lift: 3,
        size: 0.07,
        speed: 2.4,
      });
      fx.burst({
        at,
        colour: "#f4f8ff",
        count: 16,
        lift: 3,
        size: 0.1,
        speed: 3,
      });
      camera.shake(0.35);
      return;
    case "splash":
    case "plunge":
      at.y = happening.kind === "splash" ? -0.25 : -1;
      fx.ring(at, "#9fe8ff", 2.4, 0.8);
      fx.burst({
        at,
        colour: "#bfe9ff",
        count: 26,
        lift: 4.6,
        size: 0.1,
        speed: 2.2,
      });
      return;
    case "shatter":
      at.y = 0.6;
      fx.burst({
        at,
        colour: "#e8f4ff",
        count: 22,
        lift: 2.8,
        size: 0.1,
        speed: 3.4,
      });
      return;
    case "crush":
    case "burst":
      at.y = 0.5;
      fx.burst({
        at,
        colour: "#f4f8ff",
        count: happening.kind === "crush" ? 34 : 24,
        lift: 3.6,
        size: 0.13,
        speed: 4,
      });
      fx.ring(at.setY(0.05), "#e6f6ff", 1.6, 0.4);
      if (happening.kind === "crush") camera.shake(0.25);
      return;
    case "crate":
    case "cage":
      at.y = 0.6;
      fx.burst({
        at,
        colour: "#a9ddf4",
        count: 36,
        lift: 4.2,
        size: 0.13,
        speed: 4.2,
      });
      fx.burst({
        at,
        colour: "#cff4ff",
        count: 18,
        glow: true,
        lift: 3,
        size: 0.06,
        speed: 3,
      });
      fx.ring(at.setY(0.05), "#a9ddf4", 2.6, 0.5);
      camera.shake(0.3);
      return;
    case "hop":
    case "land":
    case "roll":
      fx.burst({
        at,
        colour: "#eef6ff",
        count: happening.kind === "land" ? 10 : 7,
        lift: 1.1,
        size: 0.07,
        speed: 1.4,
        life: 0.45,
      });
      return;
    case "bolt":
      moment.shot();
      return;
    case "grow":
      at.y = 0.05;
      fx.ring(at, "#cfe8ff", 3.4, 0.7);
      fx.burst({
        at: at.setY(0.8),
        colour: "#e2f2ff",
        count: 30,
        glow: true,
        lift: 3,
        size: 0.08,
        speed: 3,
      });
      camera.shake(0.4);
      return;
    case "vision":
      fx.ring(at.setY(0.05), "#6cc4ee", 6, 1.1);
      return;
    case "round-clear":
      at.y = 1.2;
      fx.burst({
        at,
        colour: "#e8fbff",
        count: 40,
        glow: true,
        lift: 5,
        size: 0.08,
        speed: 4,
      });
      return;
    case "round-start":
      camera.intro();
      return;
    case "dart":
      return;
    case "round-end":
      return;
  }
}

// The orange light fades in a quarter of a second after a crystal's take, and is dark the rest of the time.
export function fadeFlash(stage: Stage, dt: number): void {
  flashLeft = Math.max(0, flashLeft - dt);
  stage.flash.intensity = flashLeft > 0 ? 9 * (flashLeft / 0.26) ** 1.5 : 0;
}
