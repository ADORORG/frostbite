import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";

import type { WoodsState } from "../rules/woods/types.ts";
import { toward } from "./parts.ts";
import { buildWorld } from "./world.ts";

// The three-dimensional view of the woods outside the maze, drawn on its own canvas behind the game screen (whose words and counts are
// drawn over it). It is made the first time it is needed; where the browser has no WebGL 2 it is not made at all, and the screen draws
// the woods flat instead. It reads the state and changes nothing.
export interface DepthView {
  show(state: WoodsState): void;
}

const aspect = 16 / 9;

export function createDepthView(
  canvas: HTMLCanvasElement,
  now: () => number = () => performance.now(),
): DepthView | null {
  if (typeof WebGL2RenderingContext === "undefined") return null;
  const context = canvas.getContext("webgl2", {
    antialias: true,
    powerPreference: "high-performance",
  });
  if (!(context instanceof WebGL2RenderingContext)) return null;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, canvas, context });
  } catch {
    return null;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
  const world = buildWorld();
  const camera = new PerspectiveCamera(34, aspect, 0.1, 90);
  const looking = new Vector3();
  let last: number | null = null;
  let fitted = "";
  return {
    show(state) {
      const { base } = state;
      if (base === null) return;
      // The picture keeps the screen's shape inside the canvas's box, as the game screen does, so the two line up.
      const boxWidth = canvas.clientWidth > 0 ? canvas.clientWidth : 512;
      const boxHeight = canvas.clientHeight > 0 ? canvas.clientHeight : 288;
      const width = Math.round(Math.min(boxWidth, boxHeight * aspect));
      const height = Math.round(width / aspect);
      const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
      const size = `${String(width)}x${String(height)}@${String(ratio)}`;
      if (size !== fitted) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        fitted = size;
      }
      const time = now() / 1_000;
      const dt = last === null ? 1 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      const shot = world.show(state, base, time, dt);
      const glide = shot.glide && dt < 1;
      camera.position.set(
        glide ? toward(camera.position.x, shot.from[0], dt, 5) : shot.from[0],
        glide ? toward(camera.position.y, shot.from[1], dt, 5) : shot.from[1],
        glide ? toward(camera.position.z, shot.from[2], dt, 5) : shot.from[2],
      );
      looking.set(
        glide ? toward(looking.x, shot.look[0], dt, 6) : shot.look[0],
        glide ? toward(looking.y, shot.look[1], dt, 6) : shot.look[1],
        glide ? toward(looking.z, shot.look[2], dt, 6) : shot.look[2],
      );
      camera.lookAt(looking);
      renderer.render(world.scene, camera);
    },
  };
}
