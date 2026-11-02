import type { WoodsState } from "../rules/woods/types.ts";
import { frostTint } from "./frost-look.ts";
import { drawPack } from "./pack-hud.ts";
import { drawBase } from "./woods-base.ts";
import { baseHud } from "./woods-base-hud.ts";
import { drawMaze } from "./woods-draw.ts";
import { drawScene } from "./woods-scenes.ts";

// The Whispering Woods on the screen: the maze through Glitchy's eyes, then the woods and DeFu's lair seen from above, and the scenes
// between. With `layered`, the woods outside the maze are already drawn in three dimensions behind this screen, so only what is written
// over them (and the bars of a scene) is drawn here, on a clear screen. In test mode the maze has no clock.
export function drawWoods(
  context: CanvasRenderingContext2D,
  state: WoodsState,
  layered = false,
  test = false,
): void {
  const { base } = state;
  if (base === null) {
    drawMaze(context, state, test);
    return;
  }
  if (state.scene !== null) {
    drawScene(context, state, base, layered);
    return;
  }
  if (!layered) drawBase(context, state, base);
  frostTint(context, state, base);
  baseHud(context, state, base);
  drawPack(context, state.powers, state.tick);
}
