import type { Scene } from "../../src/engine/index.ts";
import { recordingSurface, type Drawn } from "./surface.ts";

// What a scene draws at one moment of its loop.
export const frameOf = (scene: Scene, t: number): readonly Drawn[] => {
  const surface = recordingSurface();
  scene.make().draw(surface, t);
  return surface.drawn;
};

// The same, from a scene that has already been made, so a test can look at many moments of one run.
export function framesOf(scene: Scene) {
  const made = scene.make();
  return {
    at: (t: number): readonly Drawn[] => {
      const surface = recordingSurface();
      made.draw(surface, t);
      return surface.drawn;
    },
    loopSeconds: made.loopSeconds,
  };
}
