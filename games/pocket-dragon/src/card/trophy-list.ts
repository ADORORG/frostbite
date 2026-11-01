import { castleMilestones } from "../rules/castle/milestones.ts";
import { hillsMilestones } from "../rules/hills/milestones.ts";
import { milestoneIds } from "../rules/milestones.ts";
import { questMilestones } from "../rules/quest/milestones.ts";
import { charmMark, plasmaMark } from "../rules/shared-marks.ts";

// The trophies on a card: milestones, each with its title as the platform gives it (or one made from its id when the platform has not
// said) and its kind, which colours its cup. The masterful charm comes first, then the rest from the hardest won (the manifest lists
// each chapter's marks from first to last) to the first.
export type TrophyKind =
  "castle" | "hills" | "masterful" | "quest" | "shared" | "woods";

export interface Trophy {
  readonly id: string;
  readonly kind: TrophyKind;
  readonly title: string;
}

export const masterfulMark = "masterful-charm";

export function trophyKindOf(id: string): TrophyKind {
  if (id === masterfulMark) return "masterful";
  if (id === charmMark || id === plasmaMark) return "shared";
  if (hillsMilestones.includes(id)) return "hills";
  if (questMilestones.includes(id)) return "quest";
  return castleMilestones.includes(id) ? "castle" : "woods";
}

// "eggs-60" reads "EGGS 60".
export const titleFromId = (id: string): string =>
  id.split("-").join(" ").toUpperCase();

const rank = (id: string): number =>
  id === masterfulMark ? milestoneIds.length : milestoneIds.indexOf(id);

// The game's own milestones among `ids`, once each, as trophies in the order a card shows them.
export function trophiesOf(
  ids: Iterable<string>,
  titles: ReadonlyMap<string, string>,
): readonly Trophy[] {
  return [...new Set(ids)]
    .filter((id) => milestoneIds.includes(id))
    .sort((a, b) => rank(b) - rank(a))
    .map((id) => ({
      id,
      kind: trophyKindOf(id),
      title: (titles.get(id) ?? titleFromId(id)).toUpperCase(),
    }));
}
