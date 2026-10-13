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

const localIdSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/u);

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
// What the browser holds for one game, in the shape the account stores it, so the two can be merged.
export interface LocalSnapshot {
  readonly milestones: readonly {
    readonly id: string;
    readonly unlockedAt: string;
    readonly verification: "self-reported";
  }[];
  readonly progress: {
    readonly savedAt: string;
    readonly state: JsonValue;
  } | null;
}

export interface LocalBackend extends GameHostBackend {
  // Replaces what the browser holds with a merged state from the account (the account's state already
  // includes everything this browser sent).
  replace(snapshot: LocalSnapshot): void;
  snapshot(): LocalSnapshot;
}

// A save made before saves were dated has no time; it counts as the oldest possible, so it never outranks a
// dated one but is not lost when the account has nothing.
const undatedSave = "1970-01-01T00:00:00.000Z";

export function createLocalBackend(options: {
  readonly gameId: string;
  // Makes the id a browser without one is given; random, and kept. A test supplies a fixed one.
  readonly newId?: () => string;
  readonly player?: () => PlayerInfo;
  readonly storage: KeyValueStorage;
}): LocalBackend {
  const { gameId, storage } = options;
  const progressKey = `ador:game:${gameId}:progress`;
  const savedAtKey = `ador:game:${gameId}:progress-at`;
  const milestonesKey = `ador:game:${gameId}:milestones`;
  const playerKey = `ador:game:${gameId}:player-id`;
  const newId = options.newId ?? (() => globalThis.crypto.randomUUID());

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

  function readProgress(): LocalSnapshot["progress"] {
    const state = read<JsonValue>(progressKey, jsonValueSchema);
    if (state === null && storage.getItem(progressKey) !== "null") return null;
    const savedAt = read(savedAtKey, z.iso.datetime({ offset: true }));
    return { savedAt: savedAt ?? undatedSave, state };
  }

  // This browser's id for the player in this game. A stored value that is not an id (edited by hand, or from a
  // storage that lost part of it) is replaced rather than trusted, so a game is never handed text of unknown
  // shape.
  function localId(): string {
    const stored = read(playerKey, localIdSchema);
    if (stored !== null) return stored;
    const made = newId();
    storage.setItem(playerKey, JSON.stringify(made));
    return made;
  }

  return {
    identity: async () => ({ id: localId(), kind: "local" }),
    replace: (snapshot) => {
      if (snapshot.progress !== null) {
        storage.setItem(progressKey, JSON.stringify(snapshot.progress.state));
        storage.setItem(savedAtKey, JSON.stringify(snapshot.progress.savedAt));
      }
      storage.setItem(
        milestonesKey,
        JSON.stringify(
          Object.fromEntries(
            snapshot.milestones.map(({ id, unlockedAt, verification }) => [
              id,
              { unlockedAt, verification },
            ]),
          ),
        ),
      );
    },
    snapshot: () => ({
      milestones: Object.entries(read(milestonesKey, recordsSchema) ?? {}).map(
        ([id, { unlockedAt, verification }]) => ({
          id,
          unlockedAt,
          verification,
        }),
      ),
      progress: readProgress(),
    }),
    loadProgress: async () => read<JsonValue>(progressKey, jsonValueSchema),
    milestones: async () => read(milestonesKey, recordsSchema) ?? {},
    player:
      options.player ?? (() => ({ signedIn: false, walletConnected: false })),
    saveProgress: async (state, now) => {
      storage.setItem(progressKey, JSON.stringify(state));
      storage.setItem(savedAtKey, JSON.stringify(now.toISOString()));
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
