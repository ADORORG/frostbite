"use client";

import { playbackLimits } from "../engine/index.ts";
import { SceneCanvas } from "./scene-canvas.tsx";
import { useChosenScene } from "./use-chosen-scene.ts";

// A section's moving background: a scene chosen at random on each visit (never the same as another backdrop on the page while there are
// others), or the one named. It fills its parent, which must be positioned; the page puts its own scrim over it for the text. The scene
// is chosen after the page has loaded, so what the server sent is the plain box and nothing flashes or disagrees.
export function SceneBackdrop({ sceneId }: { readonly sceneId?: string }) {
  const scene = useChosenScene(sceneId);
  return (
    <div aria-hidden="true" className="scene-backdrop">
      {scene === null ? null : (
        <SceneCanvas
          className="scene-canvas"
          fps={playbackLimits.backdropFps}
          force
          scene={scene}
        />
      )}
    </div>
  );
}
