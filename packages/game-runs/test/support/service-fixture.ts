import { vi } from "vitest";

import { resolveGameRunPolicy } from "../../src/policy.ts";
import { createGameRunsService } from "../../src/service.ts";
import { memoryRepository } from "./memory-repository.ts";

export const digest = "a".repeat(64);
export const recordDigest = "b".repeat(64);
export const start = new Date("2026-10-15T12:00:00.000Z");
export const hour = 3_600_000;

export function setup(
  options: {
    game?: { verifiable: string[]; verifierSha256: string } | null;
    verify?: (gameId: string, record: unknown) => unknown;
  } = {},
) {
  const store = memoryRepository();
  const clock = { now: start };
  let counter = 0;
  const verify = vi.fn(
    options.verify ??
      (() => ({
        digest: recordDigest,
        earned: ["first-win", "extra"],
        status: "verified",
      })),
  );
  const game = {
    current:
      options.game === undefined
        ? { verifiable: ["first-win"], verifierSha256: digest }
        : options.game,
  };
  const service = createGameRunsService({
    clock: () => clock.now,
    game: () =>
      game.current === null
        ? null
        : {
            verifiable: new Set(game.current.verifiable),
            verifierSha256: game.current.verifierSha256,
          },
    newId: () => `run-${String((counter += 1))}`,
    newSeed: () => 4_000_000_000,
    policy: resolveGameRunPolicy(),
    repository: store.repository,
    verify: verify as never,
  });
  return { clock, game, service, store, verify };
}
export const recordFor = (seed: number, claims: string[] = ["first-win"]) => ({
  claims,
  config: {},
  gameId: "any-game",
  inputs: [],
  schemaVersion: 1,
  seed,
  verifier: "rules",
  verifierVersion: 1,
});
