import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// ICICLE DROP: slide ice tiles on a four by four board, join two of a kind into the next, and try for the biggest. Every milestone is
// decided by the rules alone (`games/icicle-drop/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules
// as a verifier, the platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run
// followed the rules, not that a person played it. The digest pins the built file: a change to the rules is a change here, and a test
// fails until it is. The owner approved the milestone list on 2026-10-29; changing a goal changes the rules (and so the digest below).
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

export const icicleDropGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "A four by four board of glowing ice tiles in every colour, from small blue ones to a huge cyan 2048.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Slide the ice tiles with the arrow keys or a swipe. Two tiles of a kind join into the next, and the board fills up fast. Build big tiles, chain your joins, and keep the board tidy. Every milestone is checked by replaying your run.",
  id: "icicle-drop",
  launch: { mode: "embedded" },
  milestones: [
    once("tile-64", "Sixty-four", "Make a 64 tile.", "You made a 64."),
    once("tile-128", "One twenty-eight", "Make a 128 tile.", "You made a 128."),
    once("tile-256", "Two fifty-six", "Make a 256 tile.", "You made a 256."),
    once("tile-512", "Five twelve", "Make a 512 tile.", "You made a 512."),
    once(
      "tile-1024",
      "Ten twenty-four",
      "Make a 1024 tile.",
      "You made a 1024.",
    ),
    once(
      "tile-2048",
      "Twenty forty-eight",
      "Make a 2048 tile.",
      "You made the 2048.",
    ),
    once(
      "tile-4096",
      "Forty ninety-six",
      "Make a 4096 tile.",
      "You went past 2048 to a 4096.",
    ),
    once(
      "score-1k",
      "A thousand",
      "Score 1,000 in one run.",
      "You scored a thousand.",
    ),
    once(
      "score-2500",
      "Twenty-five hundred",
      "Score 2,500 in one run.",
      "You scored two and a half thousand.",
    ),
    once(
      "score-5k",
      "Five thousand",
      "Score 5,000 in one run.",
      "You scored five thousand.",
    ),
    once(
      "score-10k",
      "Ten thousand",
      "Score 10,000 in one run.",
      "You scored ten thousand.",
    ),
    once(
      "score-25k",
      "Twenty-five thousand",
      "Score 25,000 in one run.",
      "You scored twenty-five thousand.",
    ),
    once(
      "moves-100",
      "Hundred moves",
      "Make 100 moves in one run.",
      "You kept a run going for a hundred moves.",
    ),
    once(
      "moves-250",
      "Two fifty moves",
      "Make 250 moves in one run.",
      "You kept a run going for 250 moves.",
    ),
    once(
      "moves-500",
      "Five hundred moves",
      "Make 500 moves in one run.",
      "You kept a run going for 500 moves.",
    ),
    once(
      "moves-1000",
      "Thousand moves",
      "Make 1,000 moves in one run.",
      "You kept a run going for a thousand moves.",
    ),
    once(
      "double-up",
      "Double up",
      "Join two pairs of tiles in one move.",
      "You joined two pairs at once.",
    ),
    once(
      "four-at-once",
      "Four at once",
      "Join four pairs of tiles in one move.",
      "You joined four pairs at once.",
    ),
    once(
      "avalanche",
      "Avalanche",
      "Join six pairs of tiles in one move.",
      "You joined six pairs in one move.",
    ),
    once(
      "on-a-roll",
      "On a roll",
      "Join tiles on five moves in a row.",
      "You joined tiles five moves running.",
    ),
    once(
      "hot-streak",
      "Hot streak",
      "Join tiles on ten moves in a row.",
      "You joined tiles ten moves running.",
    ),
    once(
      "unbreakable",
      "Unbreakable",
      "Join tiles on twenty moves in a row.",
      "You joined tiles twenty moves running.",
    ),
    once(
      "corner-king",
      "Corner king",
      "Hold your biggest tile, a 256 or more, in a corner.",
      "You kept your biggest tile in the corner.",
    ),
    once(
      "spacious",
      "Spacious",
      "Hold a 128 with at least eight cells empty.",
      "You held a 128 with room to spare.",
    ),
    once(
      "close-shave",
      "Close shave",
      "Fill every cell of the board and still have a move.",
      "You filled the board and found a way out.",
    ),
    once(
      "quick-128",
      "Quick one twenty-eight",
      "Make a 128 tile within 100 moves.",
      "You built a 128 in a hundred moves or fewer.",
    ),
  ],
  network: betaTarget.chainId,
  scene: "blocks",
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary:
    "A sliding ice-tile puzzle: join two of a kind and chase the big tile.",
  tags: ["puzzle"],
  title: "Icicle Drop",
  verification: {
    replay: {
      id: "icicle-drop",
      sha256:
        "cec65347beb0ac33d2a6088ff0a742e92f0390cbadc35d8711436cf50f24a7e8",
      version: 1,
    },
  },
  version: "0.1.0",
});
