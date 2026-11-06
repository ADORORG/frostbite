import { defineGame } from "@frostbite/shared/games";

import { targetChains } from "../chains.ts";

const [betaTarget] = targetChains;
if (betaTarget === undefined) throw new Error("No target chain is configured.");

// The SDK explorer, in /games/sdk-explorer: it calls every method the platform offers a game and shows what
// came back, so a builder can see each answer in the real isolated frame. It is registered only where the
// platform is run for development or tests (see configs/games.ts), never in a deployment players use. It
// declares the wallet capability so that the address call can be seen answering, and a rewards contract with the
// `milestone:claim` capability so that asking for a claim can be seen answering (today: not supported, since no contract is
// deployed for it).
export const sdkExplorerGame = defineGame({
  capabilities: ["milestone:claim", "run:submit", "wallet"],
  description:
    "Press a button to call the platform and see what comes back. Events the platform sends on its own appear in the same list.",
  id: "sdk-explorer",
  launch: { mode: "embedded" },
  milestones: [
    {
      claimPolicy: "repeatable",
      criteria: "Press milestones.unlock; each press is counted, up to five.",
      description: "You made a call to the platform and it answered.",
      id: "first-call",
      maxCount: 5,
      title: "First call",
    },
    {
      claimPolicy: "once",
      criteria: "Press milestones.progress ten times.",
      description: "You reported progress ten times.",
      id: "ten-presses",
      target: 10,
      title: "Ten presses",
    },
  ],
  network: betaTarget.chainId,
  rewards: { templateId: "game-rewards", templateVersion: "1.0.0" },
  schemaVersion: 1,
  summary: "Calls every part of the game SDK and shows the answers.",
  tags: ["developer"],
  title: "SDK Explorer",
  version: "0.1.0",
});
