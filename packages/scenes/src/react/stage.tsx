"use client";

import { playbackLimits, type Scene } from "../engine/index.ts";
import { SceneView } from "./scene-view.tsx";

// A moving background showing the scene it is given, or nothing yet when there is none. It fills its parent, which must be positioned.
// Whoever chooses the scene (a backdrop, a page with a selector) uses this to show it.
export function SceneStage({ scene }: { readonly scene: Scene | null }) {
  return (
    <div aria-hidden="true" className="scene-backdrop" data-scene={scene?.id}>
      {scene === null ? null : (
        <SceneView
          className="scene-canvas"
          fps={playbackLimits.backdropFps}
          force
          scene={scene}
        />
      )}
    </div>
  );
}
