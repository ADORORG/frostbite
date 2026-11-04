import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// FROST RUNNER: an endless runner over the ice. Jump the spikes, slide under the icicles, take the shards. Every milestone is decided by
// the rules alone (`games/frost-runner/src/rules/milestones.ts`), so each can be replay-checked: the game publishes its rules as a
// verifier, the platform replays a run it issued a seed for, and the milestone is then held as replay-verified. That shows the run
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

export const frostRunnerGame = defineGame({
  capabilities: ["milestone:claim", "run:submit"],
  cover: {
    alt: "A runner in a cyan suit and yellow scarf racing across ice under the northern lights, with pink spikes ahead and an icicle hanging overhead.",
    image: "cover.svg",
    video: null,
  },
  description:
    "Run across the ice. Tap the top of the screen to jump the spikes and the bottom to slide under the icicles, and take the shards as you go. The world speeds up the further you get, and every milestone is checked by replaying your run.",
  id: "frost-runner",
  launch: { mode: "embedded" },
  milestones: [
    once(
      "first-steps",
      "First steps",
      "Run 100 metres.",
      "You ran your first 100 metres.",
    ),
    once(
      "quarter-km",
      "Quarter kilometre",
      "Run 250 metres.",
      "You ran a quarter of a kilometre.",
    ),
    once(
      "half-km",
      "Half a kilometre",
      "Run 500 metres.",
      "You ran half a kilometre.",
    ),
    once(
      "one-km",
      "One kilometre",
      "Run 1,000 metres.",
      "You ran a full kilometre.",
    ),
    once(
      "two-km",
      "Two kilometres",
      "Run 2,000 metres.",
      "You ran two kilometres in one run.",
    ),
    once(
      "three-km",
      "Three kilometres",
      "Run 3,000 metres.",
      "You ran three kilometres in one run.",
    ),
    once(
      "shard-10",
      "Shard collector",
      "Collect 10 shards in one run.",
      "You collected ten shards.",
    ),
    once(
      "shard-50",
      "Shard hoarder",
      "Collect 50 shards in one run.",
      "You collected fifty shards.",
    ),
    once(
      "shard-100",
      "Shard baron",
      "Collect 100 shards in one run.",
      "You collected a hundred shards.",
    ),
    once(
      "shard-250",
      "Shard king",
      "Collect 250 shards in one run.",
      "You collected two hundred and fifty shards.",
    ),
    once(
      "sky-picker",
      "Sky picker",
      "Collect 10 high shards, which only a jump reaches.",
      "You plucked ten shards out of the air.",
    ),
    once(
      "hurdler",
      "Hurdler",
      "Get past 10 obstacles in one run.",
      "You got past ten obstacles.",
    ),
    once(
      "steeplechase",
      "Steeplechase",
      "Get past 50 obstacles in one run.",
      "You got past fifty obstacles.",
    ),
    once(
      "obstacle-course",
      "Obstacle course",
      "Get past 100 obstacles in one run.",
      "You got past a hundred obstacles.",
    ),
    once(
      "unstoppable",
      "Unstoppable",
      "Get past 200 obstacles in one run.",
      "You got past two hundred obstacles.",
    ),
    once(
      "close-call",
      "Close call",
      "Clear a spike with almost no room to spare.",
      "You cleared a spike by a whisker.",
    ),
    once(
      "daredevil",
      "Daredevil",
      "Have 10 close calls in one run.",
      "You cut it fine ten times.",
    ),
    once(
      "thread-the-needle",
      "Thread the needle",
      "Have 25 close calls in one run.",
      "You cut it fine twenty-five times.",
    ),
    once(
      "leap-of-faith",
      "Leap of faith",
      "Jump 25 times in one run.",
      "You jumped twenty-five times.",
    ),
    once(
      "limbo",
      "Limbo",
      "Slide 25 times in one run.",
      "You slid twenty-five times.",
    ),
    once(
      "acrobat",
      "Acrobat",
      "Jump 40 times and slide 40 times in one run.",
      "You jumped and slid forty times each.",
    ),
    once(
      "minute-man",
      "Minute man",
      "Stay alive for one minute.",
      "You lasted a whole minute.",
    ),
    once(
      "blizzard-pace",
      "Blizzard pace",
      "Reach the top speed.",
      "You ran as fast as the ice allows.",
    ),
  ],
  network: betaTarget.chainId,
  scene: "runner",
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary:
    "An endless runner: jump spikes, slide under icicles, take the shards.",
  tags: ["endless", "reflex", "arcade"],
  title: "Frost Runner",
  verification: {
    replay: {
      id: "frost-runner",
      sha256:
        "c0d4804f067069ad54795671be85ea58aec744099a1db78d88beb42e68ddcf0f",
      version: 1,
    },
  },
  version: "0.1.0",
});
