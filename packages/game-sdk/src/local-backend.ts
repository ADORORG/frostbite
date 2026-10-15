import { z } from "zod";

import type { GameHostBackend } from "./host.ts";
import {
  jsonValueSchema,
  type JsonValue,
  type PlayerInfo,
  type VerificationLevel,
  verificationSchema,
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
      // A record written before milestones were counted has none: it was earned once.
      count: z.number().int().min(1).default(1),
      unlockedAt: z.iso.datetime({ offset: true }),
      verification: verificationSchema,
    })
    .strict(),
);

const totalsSchema = z.record(z.string(), z.number().int().min(0));

// The player's progress and milestones kept in this browser, under keys for this game alone, for a player who
// is not signed in. A game never touches the storage; the page does, on its behalf. What the storage holds is
// read back through the same schemas as anything else, so a corrupt or edited value is treated as empty rather
// than trusted or thrown.
// What the browser holds for one game, in the shape the account stores it, so the two can be merged.
export interface LocalSnapshot {
  // The totals reported toward milestones that have a target.
  readonly counters: readonly {
    readonly current: number;
    readonly id: string;
  }[];
  readonly milestones: readonly {
    readonly count: number;
    readonly id: string;
    readonly unlockedAt: string;
    readonly verification: VerificationLevel;
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
  const countersKey = `ador:game:${gameId}:counters`;
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
            snapshot.milestones.map(
              ({ count, id, unlockedAt, verification }) => [
                id,
                { count, unlockedAt, verification },
              ],
            ),
          ),
        ),
      );
      storage.setItem(
        countersKey,
        JSON.stringify(
          Object.fromEntries(
            snapshot.counters.map(({ current, id }) => [id, current]),
          ),
        ),
      );
    },
    snapshot: () => ({
      counters: Object.entries(read(countersKey, totalsSchema) ?? {}).map(
        ([id, current]) => ({ current, id }),
      ),
      milestones: Object.entries(read(milestonesKey, recordsSchema) ?? {}).map(
        ([id, { count, unlockedAt, verification }]) => ({
          count,
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
    counters: async () => read(countersKey, totalsSchema) ?? {},
    reportProgress: async (id, current, target, now) => {
      const totals = read(countersKey, totalsSchema) ?? {};
      const held = Math.min(Math.max(totals[id] ?? 0, current), target);
      if (held !== totals[id])
        storage.setItem(countersKey, JSON.stringify({ ...totals, [id]: held }));
      const records = read(milestonesKey, recordsSchema) ?? {};
      const existing = records[id];
      if (existing !== undefined || held < target)
        return {
          current: held,
          newlyUnlocked: false,
          unlockedAt: existing?.unlockedAt ?? null,
        };
      const unlockedAt = now.toISOString();
      storage.setItem(
        milestonesKey,
        JSON.stringify({
          ...records,
          [id]: { count: 1, unlockedAt, verification: "self-reported" },
        }),
      );
      return { current: held, newlyUnlocked: true, unlockedAt };
    },
    unlock: async (id, now, max) => {
      const records = read(milestonesKey, recordsSchema) ?? {};
      const existing = records[id];
      if (existing !== undefined) {
        // A repeat is counted while below the most the manifest allows; above it, it is ignored.
        const counted = existing.count < max;
        const count = counted ? existing.count + 1 : existing.count;
        if (counted)
          storage.setItem(
            milestonesKey,
            JSON.stringify({ ...records, [id]: { ...existing, count } }),
          );
        return {
          alreadyUnlocked: true,
          count,
          counted,
          unlockedAt: existing.unlockedAt,
        };
      }
      const unlockedAt = now.toISOString();
      storage.setItem(
        milestonesKey,
        JSON.stringify({
          ...records,
          [id]: { count: 1, unlockedAt, verification: "self-reported" },
        }),
      );
      return { alreadyUnlocked: false, count: 1, counted: false, unlockedAt };
    },
  };
}
