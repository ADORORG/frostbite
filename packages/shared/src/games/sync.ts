import { z } from "zod";

import {
  gameIdSchema,
  gameManifestLimits,
  gameMilestoneVerifications,
} from "./manifest.ts";

const timestamp = z.iso.datetime({ offset: true });

// What a game saved, as plain JSON, and when. The time is the player's device clock, bounded by the server
// to its own (see `mergeGameState`), so a wrong clock can lose a save but never outrank the present.
export const gameProgressSchema = z
  .object({ savedAt: timestamp, state: z.json() })
  .strict();

// A milestone the player earned, and how that is known: `self-reported` (the game said so; nothing with money or
// privilege may depend on it, ADR-018) or `replay-verified` (the platform replayed a run under the game's published
// rules). A browser may send either, but the account only ever believes a verdict it reached itself (see game-saves).
export const gameMilestoneRecordSchema = z
  .object({
    // How many times the player earned it: 1 for a milestone earned once, up to the manifest's maximum for a
    // repeatable one. Merged by the larger side, so a replayed sync changes nothing; two devices that each earned it
    // while offline are counted once between them, which the page says nowhere it could be mistaken for a total.
    count: z.number().int().min(1).max(gameManifestLimits.milestoneCount),
    id: gameIdSchema,
    unlockedAt: timestamp,
    verification: z.enum(gameMilestoneVerifications),
  })
  .strict();

// Progress toward the target of a milestone not yet earned (7 of 10 wins): the game's current total, merged by the
// larger side. Reaching the target earns the milestone.
export const gameCounterSchema = z
  .object({
    current: z.number().int().min(0).max(gameManifestLimits.milestoneCount),
    id: gameIdSchema,
  })
  .strict();

export const gameStateSchema = z
  .object({
    counters: z.array(gameCounterSchema),
    milestones: z.array(gameMilestoneRecordSchema),
    progress: gameProgressSchema.nullable(),
  })
  .strict();

export const syncGameStateInputSchema = z
  .object({ gameId: gameIdSchema, state: gameStateSchema })
  .strict();

// What the account answers with: the merged state, and the player's id for this game. The id is random, made
// when the player first syncs the game, and is what a game is told the player is; it cannot be worked out from
// the account or from the id another game was given.
export const syncGameStateResponseSchema = gameStateSchema
  .extend({ playerId: z.uuid() })
  .strict();

export const gameSyncRoute = {
  method: "POST",
  operationId: "syncGameState",
  path: "/api/v1/games/sync",
} as const;

export type GameCounter = z.infer<typeof gameCounterSchema>;
export type GameMilestoneRecord = z.infer<typeof gameMilestoneRecordSchema>;
export type GameProgress = z.infer<typeof gameProgressSchema>;
export type GameState = z.infer<typeof gameStateSchema>;
export type SyncGameStateInput = z.infer<typeof syncGameStateInputSchema>;
export type SyncGameStateResponse = z.infer<typeof syncGameStateResponseSchema>;

// How far ahead of the server's clock a device's clock may be before its save is not believed. Phones and
// laptops drift by seconds; a larger gap is a wrong clock or a forged time.
export const gameClockSkewMs = 5 * 60_000;

// THE merge rule (owner-adjustable in one place): the newest save wins, a tie keeps the stored one, and every
// milestone earned on either side is kept, with the earliest unlock time. A save dated beyond the clock skew
// is ignored, not corrected: moving it to "now" would move it forward again on every replay, and a wrong
// clock would then keep overwriting newer saves from other devices. A milestone's time is only a date, so one
// in the future is moved to now, and the earliest-wins rule keeps that stable. Replaying the same sync
// changes nothing.
export function mergeGameState(
  stored: GameState,
  incoming: GameState,
  now: Date,
  maxSkewMs: number = gameClockSkewMs,
): GameState {
  const believable = (value: string) =>
    Date.parse(value) <= now.getTime() + maxSkewMs;
  const offered =
    incoming.progress !== null && believable(incoming.progress.savedAt)
      ? incoming.progress
      : null;
  const progress =
    offered !== null &&
    (stored.progress === null ||
      Date.parse(offered.savedAt) > Date.parse(stored.progress.savedAt))
      ? offered
      : stored.progress;
  const milestones = new Map<string, GameMilestoneRecord>();
  for (const record of [...stored.milestones, ...incoming.milestones]) {
    const bounded =
      Date.parse(record.unlockedAt) > now.getTime()
        ? { ...record, unlockedAt: now.toISOString() }
        : record;
    const existing = milestones.get(record.id);
    // The larger count, and the stronger level with its own time: a verified level is never lost to a side that only
    // reported the milestone, and a time the platform verified is not moved by one a device reports. Between sides of
    // the same level, the earliest time.
    const winner =
      existing === undefined ||
      (bounded.verification === existing.verification
        ? Date.parse(bounded.unlockedAt) < Date.parse(existing.unlockedAt)
        : bounded.verification === "replay-verified")
        ? bounded
        : existing;
    milestones.set(record.id, {
      ...winner,
      count: Math.max(existing?.count ?? 0, record.count),
    });
  }
  const counters = new Map<string, number>();
  for (const { current, id } of [...stored.counters, ...incoming.counters])
    counters.set(id, Math.max(counters.get(id) ?? 0, current));
  return {
    counters: [...counters]
      .map(([id, current]) => ({ current, id }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    milestones: [...milestones.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    progress,
  };
}
