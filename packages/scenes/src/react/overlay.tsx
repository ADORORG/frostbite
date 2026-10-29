"use client";

import { pickStable, playbackLimits } from "../engine/index.ts";
import { SceneView } from "./scene-view.tsx";
import { useScenes } from "./provider.tsx";

// A card's overlay: a scene chosen from the card's own id, so the same card looks the same on every visit. A named scene wins. It sits
// over the card's poster, blended in, and the page's own fade keeps the card's text readable.
export function SceneOverlay({
  art = false,
  sceneId,
  seed,
}: {
  // The scene is the card's picture (it has none of its own), so it plays at full strength instead of blended over a poster.
  readonly art?: boolean;
  readonly sceneId?: string;
  readonly seed: string;
}) {
  const { scenes } = useScenes();
  const scene =
    scenes.find(({ id }) => id === sceneId) ??
    scenes[pickStable(seed, scenes.length)];
  return scene === undefined ? null : (
    <div
      aria-hidden="true"
      data-scene={scene.id}
      className={art ? "scene-overlay scene-overlay--art" : "scene-overlay"}
    >
      <SceneView
        className="scene-canvas"
        fps={playbackLimits.overlayFps}
        force={false}
        scene={scene}
      />
    </div>
  );
}
