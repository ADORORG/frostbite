import type { HostedGame } from "@frostbite/game-sdk/host";
import {
  gameChannel,
  protocolVersion,
  type Response,
} from "@frostbite/game-sdk/protocol";

export const game: HostedGame = {
  id: "tap-tower",
  milestones: [
    {
      claimPolicy: "once",
      criteria: "Score 5.",
      description: "Five taps.",
      id: "first-five",
      title: "First five",
    },
    {
      claimPolicy: "repeatable",
      maxCount: 100,
      criteria: "Score 10.",
      description: "Ten taps.",
      id: "ten-taps",
      title: "Ten taps",
    },
  ],
};

export const request = (method: string, params: unknown = {}, id = "r1") => ({
  channel: gameChannel,
  id,
  method,
  params,
  version: protocolVersion,
});

export { createMemoryGameBackend as memoryBackend } from "../../src/memory-game-backend.ts";

export const outcome = (response: Response | undefined) =>
  response === undefined ? "none" : response.ok ? "ok" : response.error.code;
