"use client";

import { SceneStage } from "./stage.tsx";
import { useChosenScene } from "./use-chosen.ts";

// A section's moving background: a scene chosen at random on each visit (never the same as another backdrop on the page while there are
// others), or the one named. It fills its parent, which must be positioned; the page puts its own scrim over it for the text. The scene
// is chosen after the page has loaded, so what the server sent is the plain box and nothing flashes or disagrees.
export function SceneBackdrop({ sceneId }: { readonly sceneId?: string }) {
  return <SceneStage scene={useChosenScene(sceneId)} />;
}
