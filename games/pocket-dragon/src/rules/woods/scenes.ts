import type { SceneId, WoodsState } from "./types.ts";

// The scenes of the woods, played in the rules so that a run's clock counts them: nothing else moves while one plays, and the action
// key skips it. Out of the maze the camera rises over the trees; at the lair's gate DeFu shows herself; and the end is the rocket
// defused (peace) or launched. Their words are the screen's (`screen/woods-scenes.ts`).
export const sceneTicks: Readonly<Record<SceneId, number>> = {
  launch: 300,
  lair: 360,
  peace: 360,
  rise: 300,
};

export const playScene = (state: WoodsState, id: SceneId): WoodsState => ({
  ...state,
  scene: { id, start: state.tick },
});

// A scene ends once it has run its length.
export function sceneOn(state: WoodsState): WoodsState {
  const { scene } = state;
  return scene !== null && state.tick - scene.start >= sceneTicks[scene.id]
    ? { ...state, scene: null }
    : state;
}

// Skipped, a scene ends at once; DeFu's lair then begins at once too.
export function skipScene(state: WoodsState): WoodsState {
  const { base, scene } = state;
  if (scene === null) return state;
  return scene.id === "lair" && base !== null
    ? { ...state, base: { ...base, lairStart: state.tick }, scene: null }
    : { ...state, scene: null };
}
