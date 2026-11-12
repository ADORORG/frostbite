import { box, type Box, type Point } from "./geometry.ts";

// The Savage house at the red rim of town, and the meadow in front of it, as the rules know them: walls, the big furniture a body walks
// round, and the places the story happens. The house runs from x -12 m to 12 m and z 0 to 14 m; its front door faces north onto the
// meadow. The three-dimensional view dresses these same boxes; it never adds one a body could walk into.

// The outer walls, with their ways in and out: the front door; the tall window of the office, which is a way in too, up its steps; the
// kitchen's side door at the top of the curved stair; and the sliding windows of the two bedrooms, which open onto the grass. Then the
// hall's two walls, each with a doorway into the two rooms beside it; and the walls between the rooms of each wing.
export const shell: readonly Box[] = [
  box(-12_100, -100, -900, 100),
  box(900, -100, 8_400, 100),
  box(10_400, -100, 12_100, 100),
  box(-12_100, 13_900, 6_500, 14_100),
  box(8_100, 13_900, 12_100, 14_100),
  box(-12_100, -100, -11_900, 4_200),
  box(-12_100, 5_800, -11_900, 9_600),
  box(-12_100, 11_400, -11_900, 14_100),
  box(11_900, -100, 12_100, 14_100),
  box(-3_100, 0, -2_900, 2_400),
  box(-3_100, 3_800, -2_900, 9_600),
  box(-3_100, 11_000, -2_900, 14_000),
  box(2_900, 0, 3_100, 2_400),
  box(2_900, 3_800, 3_100, 9_600),
  box(2_900, 11_000, 3_100, 14_000),
  box(-12_000, 6_900, -3_000, 7_100),
  box(3_000, 6_900, 12_000, 7_100),
];

// The ways through the outer walls (the front door first), each the gap it stands in: for the view, which arches each one.
export const ways: readonly Box[] = [
  box(-900, -100, 900, 100),
  box(8_400, -100, 10_400, 100),
  box(-12_100, 4_200, -11_900, 5_800),
  box(-12_100, 9_600, -11_900, 11_400),
  box(6_500, 13_900, 8_100, 14_100),
];

// The grass goes all round the house. Its edge is a hedge on every side, where the trees begin.
export const field: readonly Box[] = [
  box(-16_100, -27_100, 16_100, -26_900),
  box(-16_100, -27_100, -15_900, 19_100),
  box(15_900, -27_100, 16_100, 19_100),
  box(-16_100, 18_900, 16_100, 19_100),
];

// Furniture too big to step over, room by room.
const furniture: readonly Box[] = [
  // The kitchen: the long counter (stove, sink), the cold box against the west wall, the island, the table and the chair drawn up to
  // it.
  box(-11_800, 100, -5_200, 900),
  box(-11_900, 2_150, -11_200, 3_050),
  box(-9_000, 3_000, -6_400, 4_000),
  box(-6_000, 5_000, -4_200, 6_200),
  box(-6_630, 5_370, -6_170, 5_830),
  // The children's room: two beds, the toy chest, the workbench, the drum.
  box(-11_800, 7_400, -9_800, 8_600),
  box(-11_800, 12_400, -9_800, 13_800),
  box(-8_000, 7_300, -7_000, 7_900),
  box(-6_000, 13_000, -3_800, 13_800),
  box(-4_420, 8_180, -3_980, 8_620),
  // The office: the desk, the shelves of books, the armchair, and the stands the globe and the record player sit on.
  box(7_000, 2_400, 9_800, 3_200),
  box(11_300, 600, 11_900, 6_200),
  box(4_000, 5_400, 5_000, 6_400),
  box(5_000, 400, 5_400, 800),
  box(6_100, 6_300, 6_500, 6_700),
  // The parents' room: the round bed, the loom, the wardrobe, the vanity, the music box's stand and the plant.
  box(8_200, 10_000, 11_400, 13_200),
  box(4_200, 12_800, 6_200, 13_600),
  box(11_300, 7_400, 11_900, 9_400),
  box(3_100, 12_150, 3_550, 13_050),
  box(9_000, 7_300, 9_400, 7_700),
  box(6_400, 7_300, 6_800, 7_700),
  // The hall: the trunk of the tree, the couch, the little table the lamp stands on, the shelf the deck sits on, the plant.
  box(-700, 5_300, 700, 6_700),
  box(-2_400, 12_900, 2_400, 13_700),
  box(1_700, 11_500, 2_400, 12_100),
  box(2_300, 5_600, 2_800, 6_400),
  box(-2_700, 11_600, -2_300, 12_000),
  // The meadow: the post of the traffic light, the swing's seat and the trunk of the tree it hangs from, the bench, the post box.
  box(-8_150, -9_150, -7_850, -8_850),
  box(10_300, -7_200, 10_900, -6_800),
  box(11_650, -7_250, 12_150, -6_750),
  box(-4_000, -4_400, -2_400, -3_900),
  box(5_850, -3_150, 6_150, -2_850),
  // On the porch: Kai's workbench, where he is building something.
  box(-3_500, -2_800, -2_100, -2_300),
];

// The front door. It stands open: the porch and the meadow are part of home from the start.
export const frontDoor: Box = ways[0] ?? box(-900, -100, 900, 100);

export const walls: readonly Box[] = [...shell, ...field, ...furniture];

// Where a run begins, before anyone is chosen: the hall, just inside the front door, facing the tree. Once chosen, the lead begins at
// their own place (below).
export const startPoint: Point = { x: 0, z: 1_800 };
export const startHeading = 8;

// The places the story happens.
export const places = {
  // Kai's workbench on the porch, where his crystal tower is built again.
  bench: { x: -2_800, z: -2_550 },
  // The ancestor tree, in the hall. Its trunk is the box above; a hand on it reaches from about a metre away.
  deck: { x: 2_550, z: 6_000 },
  drawer: { x: 8_400, z: 3_200 },
  // The hill in the meadow that the giant snake rests under and rises out of; `hillRadius` is how near the family must come to wake it.
  hill: { x: 0, z: -18_000 },
  lamp: { x: 2_050, z: 11_800 },
  loom: { x: 5_200, z: 13_200 },
  stove: { x: -8_000, z: 900 },
  tree: { x: 0, z: 6_000 },
} as const satisfies Record<string, Point>;

export const hillRadius = 6_500;

// Zora's garden: three beds of earth in the meadow near where she plays, to plant and tend.
export const gardenBeds: readonly Point[] = [
  { x: 4_200, z: -9_800 },
  { x: 6_000, z: -10_600 },
  { x: 7_800, z: -9_800 },
];
// The tree's trunk is wide, so it is reached from farther than a small thing is.
export const treeReach = 1_900;

// Where each of the family is when the run begins, doing what they do: Daddy at his desk in the home office, Kai on the porch building
// something, Zora out in the meadow, Mama at the ancestor tree. The lead starts at their own place; the others are found there.
export const familySpots = {
  ali: { x: 8_400, z: 3_900 },
  heerah: { x: 1_200, z: 6_600 },
  kai: { x: -2_700, z: -1_800 },
  zora: { x: 6_500, z: -7_000 },
} as const satisfies Record<string, Point>;

// The way each faces there: Daddy to his desk, Kai to his bench, Zora toward the house, Mama to the tree.
export const familyFacing = {
  ali: 0,
  heerah: 12,
  kai: 0,
  zora: 8,
} as const satisfies Record<string, number>;
