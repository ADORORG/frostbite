import { z } from "zod";

import type { GameHostBackend } from "./host.ts";
import {
  jsonValueSchema,
  type JsonValue,
  type PlayerInfo,
} from "./protocol.ts";

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const recordsSchema = z.record(
  z.string(),
  z
    .object({
      unlockedAt: z.iso.datetime({ offset: true }),
      verification: z.literal("self-reported"),
    })
    .strict(),
);

// The player's progress and milestones kept in this browser, under keys for this game alone, for a player who
// is not signed in. A game never touches the storage; the page does, on its behalf. What the storage holds is
// read back through the same schemas as anything else, so a corrupt or edited value is treated as empty rather
// than trusted or thrown.
export function createLocalBackend(options: {
  readonly gameId: string;
  readonly player?: () => PlayerInfo;
  readonly storage: KeyValueStorage;
}): GameHostBackend {
  const { gameId, storage } = options;
  const progressKey = `ador:game:${gameId}:progress`;
  const milestonesKey = `ador:game:${gameId}:milestones`;

  function read<Output>(key: string, schema: z.ZodType<Output>): Output | null {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return null;
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  return {
    loadProgress: async () => read<JsonValue>(progressKey, jsonValueSchema),
    milestones: async () => read(milestonesKey, recordsSchema) ?? {},
    player:
      options.player ?? (() => ({ signedIn: false, walletConnected: false })),
    saveProgress: async (state) => {
      storage.setItem(progressKey, JSON.stringify(state));
    },
    unlock: async (id, now) => {
      const records = read(milestonesKey, recordsSchema) ?? {};
      const existing = records[id];
      if (existing !== undefined)
        return { alreadyUnlocked: true, unlockedAt: existing.unlockedAt };
      const unlockedAt = now.toISOString();
      storage.setItem(
        milestonesKey,
        JSON.stringify({
          ...records,
          [id]: { unlockedAt, verification: "self-reported" },
        }),
      );
      return { alreadyUnlocked: false, unlockedAt };
    },
  };
}
