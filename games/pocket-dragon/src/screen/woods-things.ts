import type { Place, WoodsState } from "../rules/woods/types.ts";
import { glitchBall, kitThings } from "./kit-sprites.ts";
import {
  charmPictures,
  charmSeen,
  eggPicture,
  partPictures,
} from "./woods-stash-look.ts";
import {
  chestOpen,
  chestShut,
  lanternDark,
  lanternLit,
  moonChestOpen,
  moonChestPicture,
  stoneLit,
  stoneRead,
} from "./woods-look.ts";

// What stands in the maze as a picture facing the player: the chests (open or shut), the moon chest, the clue stones (read or not), the
// lanterns (lit or not), and what is still to pick up: the launcher's parts, the eggs, the charms seen from close by, and the backpack's
// foods. And a glitch blast rolling away down the maze, just after a mushroom is used.
export interface Thing {
  readonly picture: readonly string[];
  readonly place: Place;
}

export function thingsOf(state: WoodsState): readonly Thing[] {
  const { level } = state;
  return [
    ...level.chests.map((place, at) => ({
      picture: state.chests[at] === true ? chestOpen : chestShut,
      place,
    })),
    {
      picture: state.moonChest ? moonChestOpen : moonChestPicture,
      place: level.moonChest,
    },
    ...level.clues.map((place, at) => ({
      picture: state.clues[at] === true ? stoneRead : stoneLit,
      place,
    })),
    ...level.lanterns.map((place, at) => ({
      picture: state.lanterns[at] === true ? lanternLit : lanternDark,
      place,
    })),
    ...level.parts.flatMap((place, at) =>
      state.parts[at] === true
        ? []
        : [{ picture: partPictures[at] ?? eggPicture, place }],
    ),
    ...level.eggs.flatMap((place, at) =>
      state.eggs[at] === true ? [] : [{ picture: eggPicture, place }],
    ),
    ...level.charms.flatMap((place, at) =>
      charmSeen(state, at)
        ? [{ picture: charmPictures[at] ?? eggPicture, place }]
        : [],
    ),
    ...level.kit.flatMap((spot, at) =>
      state.kitTaken[at] === true
        ? []
        : [{ picture: kitThings[spot.item], place: spot }],
    ),
  ];
}

// The ball rolls from Glitchy's feet away to the horizon in half a second, shrinking as it goes.
export const blastLookTicks = 30;

export function mazeBlastLook(
  context: CanvasRenderingContext2D,
  state: WoodsState,
): void {
  const { news } = state.powers;
  if (news?.item !== "mushroom" || news.what !== "used") return;
  const since = state.tick - news.tick;
  if (since >= blastLookTicks) return;
  const size = Math.round(28 - (since * 24) / blastLookTicks);
  const y = 128 - (since * 52) / blastLookTicks;
  glitchBall(context, 128 - size / 2, y - size, size, state.tick, 1);
}
