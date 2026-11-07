import type { EffectName } from "./audio.ts";
import type { Item, Powers } from "./rules/kit.ts";

// The backpack's sounds, the same in every level: a food put in it, one used (a blaze, a blast, growing big), and a bump the pineapple
// took.
const usedSounds: Readonly<Record<Item, EffectName>> = {
  berry: "blaze",
  mushroom: "blast",
  pineapple: "grow",
};

export function packSounds(
  before: Powers,
  after: Powers,
): readonly EffectName[] {
  const { news } = after;
  if (news === null || news === before.news) return [];
  if (news.what === "packed") return ["pack"];
  return [news.what === "used" ? usedSounds[news.item] : "shrink"];
}
