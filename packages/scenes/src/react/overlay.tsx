"use client";

import { pickStable, playbackLimits } from "../engine/index.ts";
import { SceneCanvas } from "./canvas.tsx";
import { useScenes } from "./provider.tsx";

// A card's overlay: a scene chosen from the card's own id, so the same card looks the same on every visit. A named scene wins. It sits
// over the card's poster, blended in, and the page's own fade keeps the card's text readable.
export function SceneOverlay({
  sceneId,
  seed,
}: {
  readonly sceneId?: string;
  readonly seed: string;
}) {
  const { scenes } = useScenes();
  const scene =
    scenes.find(({ id }) => id === sceneId) ??
    scenes[pickStable(seed, scenes.length)];
  return scene === undefined ? null : (
    <div aria-hidden="true" className="scene-overlay">
      <SceneCanvas
        className="scene-canvas"
        fps={playbackLimits.overlayFps}
        force={false}
        scene={scene}
      />
    </div>
  );
}
