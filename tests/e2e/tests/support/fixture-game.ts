import { gameKindsOf } from "@frostbite/shared/games";
import { fixtureTapsGame } from "@repo/configs/games/fixture-taps";

// The game the browser tests use whenever they need "a game": a small one registered only in a test run (configs/games.ts), so adding or
// removing a real game never touches these tests. Its words come from its manifest, not from a copy here.
const [firstMilestone] = fixtureTapsGame.milestones;
if (firstMilestone === undefined)
  throw new Error("The fixture game has no milestones.");
const tapsForFirstMilestone = Number(/\d+/u.exec(firstMilestone.criteria)?.[0]);
if (!Number.isInteger(tapsForFirstMilestone))
  throw new Error(
    "The fixture game's first milestone does not name a number of taps.",
  );

export const fixtureGame = {
  href: `/games/${fixtureTapsGame.id}`,
  id: fixtureTapsGame.id,
  firstMilestone,
  milestones: fixtureTapsGame.milestones,
  // A word of the title that finds this game and no other when typed in the games search.
  searchWord: (fixtureTapsGame.title.split(" ").at(-1) ?? "").toLowerCase(),
  // Taps in the game's page that earn the first milestone (read from the milestone's own criteria in the manifest).
  tapsForFirstMilestone,
  // The filter chip that finds it (its first kind of game).
  kind: gameKindsOf(fixtureTapsGame.tags)[0] ?? "",
  title: fixtureTapsGame.title,
  version: fixtureTapsGame.version,
} as const;
