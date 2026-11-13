import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// PERMAFROST: falling blocks on a ten by twenty board. Every milestone is decided by the rules alone (`games/permafrost/src/rules/milestones.ts`),
// so each can be replay-checked: the game publishes its rules as a verifier, the platform replays a run it issued a seed for, and the milestone
// is then held as replay-verified. That shows the run followed the rules, not that a person played it. The digest pins the built file: a change
// to the rules is a change here, and a test fails until it is. The leaderboard ranks the run's score, which the same replay reports.
const once = (
  id: string,
  title: string,
  criteria: string,
  description: string,
) =>
  ({
    claimPolicy: "once",
    criteria,
    description,
    id,
    title,
    verification: "replay-verified",
  }) as const;

export const permafrostGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "A ten by twenty board of glowing blocks, a purple T piece about to land on a stack of colour, with the piece held on the left and the pieces to come on the right.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Blocks fall, and you turn and slide them into whole rows. Hold one back for later, drop another where the ghost shows, and clear four at once for the big scores. The ice speeds up with every ten rows, and from level twelve it starts to rise from below. Thirty-two milestones, from your first row to twenty levels, are each checked by replaying your run.",
  id: "permafrost",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-line",
      "First row",
      "Clear 1 row.",
      "You cleared your first row.",
    ),
    once(
      "lines-10",
      "Ten rows",
      "Clear 10 rows in one run.",
      "You cleared ten rows.",
    ),
    once(
      "lines-25",
      "Twenty-five rows",
      "Clear 25 rows in one run.",
      "You cleared twenty-five rows.",
    ),
    once(
      "lines-50",
      "Fifty rows",
      "Clear 50 rows in one run.",
      "You cleared fifty rows.",
    ),
    once(
      "lines-100",
      "One hundred rows",
      "Clear 100 rows in one run.",
      "You cleared a hundred rows.",
    ),
    once(
      "lines-150",
      "One fifty rows",
      "Clear 150 rows in one run.",
      "You cleared a hundred and fifty rows.",
    ),
    once(
      "lines-200",
      "Two hundred rows",
      "Clear 200 rows in one run.",
      "You cleared two hundred rows, and the ice was rising all the while.",
    ),
    once(
      "level-3",
      "Level three",
      "Reach level 3.",
      "You reached level three.",
    ),
    once("level-5", "Level five", "Reach level 5.", "You reached level five."),
    once("level-10", "Level ten", "Reach level 10.", "You reached level ten."),
    once(
      "level-15",
      "Level fifteen",
      "Reach level 15.",
      "You reached level fifteen.",
    ),
    once(
      "level-20",
      "Level twenty",
      "Reach level 20.",
      "You reached level twenty, where the pieces fall as fast as the game goes.",
    ),
    once(
      "score-1k",
      "One thousand",
      "Score 1,000 points in one run.",
      "You scored a thousand points.",
    ),
    once(
      "score-5k",
      "Five thousand",
      "Score 5,000 points in one run.",
      "You scored five thousand points.",
    ),
    once(
      "score-20k",
      "Twenty thousand",
      "Score 20,000 points in one run.",
      "You scored twenty thousand points.",
    ),
    once(
      "score-50k",
      "Fifty thousand",
      "Score 50,000 points in one run.",
      "You scored fifty thousand points.",
    ),
    once(
      "score-100k",
      "One hundred thousand",
      "Score 100,000 points in one run.",
      "You scored a hundred thousand points.",
    ),
    once(
      "score-250k",
      "Quarter million",
      "Score 250,000 points in one run.",
      "You scored a quarter of a million points.",
    ),
    once(
      "first-four",
      "Four at once",
      "Clear four rows with one piece.",
      "You cleared four rows with a single piece.",
    ),
    once(
      "fours-5",
      "Five fours",
      "Clear four rows at once, five times in one run.",
      "You cleared four rows at once five times.",
    ),
    once(
      "fours-20",
      "Twenty fours",
      "Clear four rows at once, twenty times in one run.",
      "You cleared four rows at once twenty times.",
    ),
    once(
      "combo-3",
      "Combo of three",
      "Clear rows with three pieces in a row.",
      "You cleared rows with three pieces in a row.",
    ),
    once(
      "combo-6",
      "Combo of six",
      "Clear rows with six pieces in a row.",
      "You cleared rows with six pieces in a row.",
    ),
    once(
      "combo-10",
      "Combo of ten",
      "Clear rows with ten pieces in a row.",
      "You cleared rows with ten pieces in a row.",
    ),
    once(
      "back-to-back",
      "Back to back",
      "Clear four rows at once, then four rows at once again.",
      "You cleared four rows twice running, with only smaller gaps between.",
    ),
    once(
      "back-to-back-5",
      "Five back to back",
      "Make five back-to-back clears of four rows in one run.",
      "You made five back-to-back clears of four rows.",
    ),
    once(
      "perfect-clear",
      "Clean slate",
      "Clear every cell from the board.",
      "You cleared the whole board.",
    ),
    once(
      "sprint-3min",
      "Three-minute sprint",
      "Clear 40 rows within three minutes.",
      "You cleared forty rows inside three minutes.",
    ),
    once(
      "sprint-90s",
      "Ninety-second sprint",
      "Clear 40 rows within ninety seconds.",
      "You cleared forty rows inside ninety seconds.",
    ),
    once(
      "first-hold",
      "Held back",
      "Hold a piece for later.",
      "You held a piece back for later.",
    ),
    once(
      "rising-10",
      "Ice rising",
      "Survive 10 rows of rising ice.",
      "You held out against ten rows of rising ice.",
    ),
    once(
      "rising-25",
      "Ice age",
      "Survive 25 rows of rising ice.",
      "You held out against twenty-five rows of rising ice.",
    ),
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary:
    "Falling blocks that speed up and then start to rise: clear rows before the ice reaches the top.",
  tags: ["puzzle", "arcade", "endless"],
  title: "Permafrost",
  verification: {
    replay: {
      id: "permafrost",
      sha256:
        "77adbc404d5f11edac95ce61521c06a7ee5692a797be36b09b7f4f86135de1d3",
      version: 1,
    },
  },
  version: "0.1.0",
});
