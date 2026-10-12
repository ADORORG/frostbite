import { z } from "zod";

import type { GameClient } from "./client.ts";

// What a game that was written for `localStorage` is given in place of it. The isolated frame has no storage of
// its own, so this keeps the keys in memory and saves the ones the game names through the platform
// (`progress.save`), the same save every game uses, so they follow the player across browsers like any other
// progress. Keys not named are kept for the visit only. The game asks for nothing new; it is still the page that
// owns what is kept.
export interface PlatformStorage {
  readonly length: number;
  clear(): void;
  // Resolves when what the game has set is saved, or failed to be: for a game about to close.
  flush(): Promise<void>;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const savedSchema = z
  .object({ storage: z.record(z.string(), z.string()) })
  .strict();

// A game's saved progress when it has none yet, or none this shim wrote: nothing, so the game starts afresh.
export async function createPlatformStorage(options: {
  readonly client: Pick<GameClient, "progress">;
  // The keys worth keeping across visits. Everything else lives only as long as the page.
  readonly persistedKeys: readonly string[];
  // How long after the last change the save is made, so a burst of changes is one save.
  readonly saveDelayMs?: number;
}): Promise<PlatformStorage> {
  const persisted = new Set(options.persistedKeys);
  const delay = options.saveDelayMs ?? 1_000;
  const values = new Map<string, string>();
  const loaded = savedSchema.safeParse(
    await options.client.progress.load().catch(() => null),
  );
  if (loaded.success)
    for (const [key, value] of Object.entries(loaded.data.storage))
      if (persisted.has(key)) values.set(key, value);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> = Promise.resolve();

  function save(): Promise<void> {
    timer = undefined;
    const storage = Object.fromEntries(
      [...values].filter(([key]) => persisted.has(key)),
    );
    // A refused or failed save leaves the values in memory; the next change tries again.
    saving = saving.then(() =>
      options.client.progress.save({ storage }).catch(() => undefined),
    );
    return saving;
  }

  function changed(key: string): void {
    if (!persisted.has(key) || timer !== undefined) return;
    timer = setTimeout(() => void save(), delay);
  }

  return {
    clear: () => {
      const keys = [...values.keys()];
      values.clear();
      for (const key of keys) changed(key);
    },
    flush: () => {
      if (timer === undefined) return saving;
      clearTimeout(timer);
      return save();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      if (values.delete(key)) changed(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
      changed(key);
    },
  };
}
