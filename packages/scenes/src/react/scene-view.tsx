"use client";

import type { Scene } from "../engine/index.ts";
import { SceneCanvas } from "./canvas.tsx";
import { useScenes } from "./provider.tsx";
import { SceneVideo } from "./scene-video.tsx";

// One scene shown the best way this browser can: drawn on a canvas, or, where there is no canvas, played from its video (or its still).
export function SceneView({
  className,
  fps,
  force,
  scene,
}: {
  readonly className: string;
  readonly fps: number;
  readonly force: boolean;
  readonly scene: Scene;
}) {
  const { canvas } = useScenes();
  return canvas ? (
    <SceneCanvas className={className} fps={fps} force={force} scene={scene} />
  ) : (
    <SceneVideo className={className} scene={scene} />
  );
}
