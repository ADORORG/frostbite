// The backpack, the same in every level: the berries, mushrooms and pineapples picked up along the way are kept to use whenever the
// player likes, and in the quest they go on with Glitchy to the next level. A berry eaten makes fire reach farther for a while
// (`blazeTicks`); a mushroom throws a glitch blast, which rolls a long way and clears what is in its path (each level says what that
// is); a pineapple makes Glitchy grow twice as big, and then the next bump only shrinks Glitchy back instead of costing a heart.
export type Item = "berry" | "mushroom" | "pineapple";
export const itemList: readonly Item[] = ["berry", "mushroom", "pineapple"];
export const isItem = (name: string): name is Item =>
  itemList.some((item) => item === name);

export type Pack = Readonly<Record<Item, number>>;
export const emptyPack: Pack = { berry: 0, mushroom: 0, pineapple: 0 };
// At most nine of each fit in the backpack; a berry's blaze lasts twenty seconds.
export const mostOfEach = 9;
export const blazeTicks = 1_200;

// What a level of the quest hands on to the next: the backpack, and whether Glitchy is big.
export interface Kit {
  readonly big: boolean;
  readonly pack: Pack;
}
export const noKit: Kit = { big: false, pack: emptyPack };

// The last thing done with the backpack, for the screen and the sounds: an item put in it or used, or a bump the pineapple took.
export interface PackNews {
  readonly item: Item;
  readonly tick: number;
  readonly what: "packed" | "shrank" | "used";
}

export interface Powers {
  readonly big: boolean;
  // Ticks of a berry's blaze left.
  readonly blaze: number;
  readonly news: PackNews | null;
  readonly pack: Pack;
  // Bumps the pineapple took, and items used, in the level.
  readonly shrinks: number;
  readonly used: number;
}

export const startPowers = (kit: Kit = noKit): Powers => ({
  big: kit.big,
  blaze: 0,
  news: null,
  pack: kit.pack,
  shrinks: 0,
  used: 0,
});

export const kitOf = (powers: Powers): Kit => ({
  big: powers.big,
  pack: powers.pack,
});

export const packItem = (powers: Powers, item: Item, tick: number): Powers => ({
  ...powers,
  news: { item, tick, what: "packed" },
  pack: {
    ...powers.pack,
    [item]: Math.min(mostOfEach, powers.pack[item] + 1),
  },
});

// Takes an item out of the backpack to use it: null when there is none, and for a pineapple while Glitchy is already big (it stays in
// the backpack for later). What a mushroom throws is the level's business.
export function useItem(
  powers: Powers,
  item: Item,
  tick: number,
): Powers | null {
  if (powers.pack[item] <= 0 || (item === "pineapple" && powers.big))
    return null;
  const used: Powers = {
    ...powers,
    news: { item, tick, what: "used" },
    pack: { ...powers.pack, [item]: powers.pack[item] - 1 },
    used: powers.used + 1,
  };
  if (item === "berry") return { ...used, blaze: blazeTicks };
  return item === "pineapple" ? { ...used, big: true } : used;
}

// A tick of the powers: the blaze burns down.
export const wearOff = (powers: Powers): Powers =>
  powers.blaze > 0 ? { ...powers, blaze: powers.blaze - 1 } : powers;

// A bump while big shrinks Glitchy back instead of costing a heart: the powers after it, or null when Glitchy was not big.
export const shrink = (powers: Powers, tick: number): Powers | null =>
  powers.big
    ? {
        ...powers,
        big: false,
        news: { item: "pineapple", tick, what: "shrank" },
        shrinks: powers.shrinks + 1,
      }
    : null;

// Where an item lies in a level, in that level's own units.
export interface KitSpot {
  readonly item: Item;
  readonly x: number;
  readonly y: number;
}

// The items of `spots` taken now that were not before, put in the backpack: the very same lists when nothing new was taken.
export function packTaken(
  powers: Powers,
  spots: readonly KitSpot[],
  before: readonly boolean[],
  after: readonly boolean[],
  tick: number,
): { readonly kitTaken: readonly boolean[]; readonly powers: Powers } {
  let packed = powers;
  spots.forEach((spot, at) => {
    if (after[at] === true && before[at] !== true)
      packed = packItem(packed, spot.item, tick);
  });
  return packed === powers
    ? { kitTaken: before, powers }
    : { kitTaken: after, powers: packed };
}

// A glitch blast rolling over tiles (in the castle's land, and in the woods out of the maze): where it is, the way it rolls, the tiles
// it has left to go, and the tick it last moved. It moves a tile every `blastStepTicks`, at most `blastTiles` tiles.
export interface TileBlast {
  readonly dx: number;
  readonly dy: number;
  readonly left: number;
  readonly moved: number;
  readonly x: number;
  readonly y: number;
}
export const blastTiles = 10;
export const blastStepTicks = 3;

export const startTileBlast = (
  x: number,
  y: number,
  way: { readonly x: number; readonly y: number },
  tick: number,
): TileBlast => ({
  dx: way.x,
  dy: way.y,
  left: blastTiles,
  moved: tick,
  x,
  y,
});

// Where a rolling blast goes on this tick: the tile it rolls into, or null when it is not yet time to move (or it has none left to go).
export const blastNext = (
  blast: TileBlast,
  tick: number,
): { readonly x: number; readonly y: number } | null =>
  blast.left <= 0 || tick - blast.moved < blastStepTicks
    ? null
    : { x: blast.x + blast.dx, y: blast.y + blast.dy };

export const blastRolled = (
  blast: TileBlast,
  to: { readonly x: number; readonly y: number },
  tick: number,
): TileBlast => ({ ...blast, left: blast.left - 1, moved: tick, ...to });
