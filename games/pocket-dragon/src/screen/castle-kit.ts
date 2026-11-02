import { sprite } from "@ador/game-sdk/pixels";

import { kitSpots } from "../rules/castle/places.ts";
import type { CastleState, Spot } from "../rules/castle/types.ts";
import { glitchBall, kitKey, kitPictures, rollingAt } from "./kit-sprites.ts";

// The guild's land's share of the backpack on the screen: the foods lying on the map (bobbing, until picked up), and a glitch blast
// rolling from tile to tile, drawn part way along its roll.
export function castleKit(
  context: CanvasRenderingContext2D,
  state: CastleState,
  camera: Spot,
): void {
  const bob = Math.floor(state.tick / 15) % 2;
  kitSpots.forEach((spot, at) => {
    if (state.kitTaken[at] !== true)
      sprite(
        context,
        kitPictures[spot.item],
        kitKey,
        spot.x * 16 - camera.x + 3,
        spot.y * 16 - camera.y + 3 + bob,
      );
  });
  const { blast } = state;
  if (blast === null) return;
  const rolling = rollingAt(blast, state.tick);
  glitchBall(
    context,
    rolling.x * 16 - camera.x + 3,
    rolling.y * 16 - camera.y + 3,
    10,
    state.tick,
    blast.dx === 0 ? 1 : blast.dx,
  );
}
