import type { GameHeat } from "@frostbite/shared/games";
import { heatLevels } from "@frostbite/shared/games";
import { HeatMeter, HotSticker } from "@repo/ui/arcade";

import { heatCopy } from "../domain/heat-copy.ts";

// What a game's card shows of its heat: the sticker when it is among the hot ones, and the meter for any game that is ranked. A game that is
// not ranked shows neither, so the cards of a quiet platform look as they always did.
export function heatProps(heat: GameHeat | undefined) {
  if (heat === undefined) return {};
  const stage = heatCopy.stage(heat.heat);
  return {
    heat: (
      <HeatMeter
        description={heatCopy.describe(heat.heat)}
        label={stage}
        level={heat.heat}
        levels={heatLevels}
      />
    ),
    ...(heat.hot ? { hot: <HotSticker>{heatCopy.hot}</HotSticker> } : {}),
  };
}
