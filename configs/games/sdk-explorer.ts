import { defineGame } from "@ador/shared/games";

import { targetChains } from "../chains.ts";

const [signet] = targetChains;
if (signet === undefined) throw new Error("No target chain is configured.");

// The SDK explorer, in /games/sdk-explorer: it calls every method the platform offers a game and shows what
// came back, so a builder can see each answer in the real isolated frame. It is registered only where the
// platform is run for development or tests (see configs/games.ts), never in a deployment players use. It
// declares the wallet capability so that the address call can be seen answering.
export const sdkExplorerGame = defineGame({
  capabilities: ["wallet"],
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
  network: signet.chainId,
  schemaVersion: 1,
  summary: "Calls every part of the game SDK and shows the answers.",
  title: "SDK Explorer",
  version: "0.1.0",
});
