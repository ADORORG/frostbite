import type { GameHostBackend } from "./host.ts";
import type { LocalBackend, LocalSnapshot } from "./local-backend.ts";
import type { PlayerIdentity } from "./protocol.ts";

// How the account answers a sync: the merged state and the player's id for this game, "signed-out" when there is no account to sync with (so
// nothing more is tried), or "failed" when it could not be reached (so the next change tries again).
export type AccountSyncResult =
  | {
      readonly kind: "synced";
      // The account's id for this player in this game: random, and the same on every device.
      readonly playerId: string;
      readonly state: LocalSnapshot;
    }
  | { readonly kind: "signed-out" }
  | { readonly kind: "failed" };

export interface AccountPort {
  sync(state: LocalSnapshot): Promise<AccountSyncResult>;
}

// Where the player's state is kept right now, for the page to say truthfully:
// `account` the last sync succeeded; `pending` signed in but the last sync failed (it is retried with the next
// change); `local` there is no account to sync with, or sync has not been tried yet.
export type SyncStatus = "account" | "local" | "pending";

export interface SyncedBackend extends GameHostBackend {
  readonly status: () => SyncStatus;
}

// The local backend with the account behind it. The browser stays the copy the game reads and writes, so a
// slow or failed account never slows or breaks the game; the account is reconciled once before the game first
// reads, then sent the whole local state after each change. Sending state rather than changes means a missed
// sync is repaired by the next one, and the merge makes any replay harmless.
export function createSyncedBackend(options: {
  readonly local: LocalBackend;
  // Called when the player's id changes from this browser's to the account's, which happens once, when a sync
  // first succeeds for a signed-in player. Not called for a player who stays signed out.
  readonly onIdentity?: (identity: PlayerIdentity) => void;
  readonly onStatus?: (status: SyncStatus) => void;
  readonly remote: AccountPort;
}): SyncedBackend {
  const { local, remote } = options;
  let status: SyncStatus = "local";
  let signedOut = false;
  let accountId: string | null = null;
  let sending: Promise<void> | null = null;
  let dirty = false;

  function setStatus(next: SyncStatus) {
    if (next === status) return;
    status = next;
    options.onStatus?.(next);
  }

  // What a sync does with the merged state it gets back: `all` replaces the browser's copy (only the first, before the game
  // reads), `verified` takes only the milestones the account has replay-verified, `none` leaves the copy alone.
  type Apply = "all" | "none" | "verified";
  let verifiedWanted = false;

  async function exchange(apply: Apply): Promise<void> {
    if (signedOut) return;
    let result: AccountSyncResult;
    try {
      result = await remote.sync(local.snapshot());
      // Storage that refuses the merged state (full, or blocked) is a failed sync like any other.
      if (result.kind === "synced" && apply === "all")
        local.replace(result.state);
      if (result.kind === "synced" && apply === "verified")
        local.adoptVerified(result.state.milestones);
      if (result.kind === "synced" && result.playerId !== accountId) {
        accountId = result.playerId;
        options.onIdentity?.({ id: accountId, kind: "account" });
      }
    } catch {
      result = { kind: "failed" };
    }
    if (result.kind === "signed-out") {
      signedOut = true;
      setStatus("local");
    } else setStatus(result.kind === "failed" ? "pending" : "account");
  }

  // The first read waits for one reconcile, so the game starts from the merged state.
  const reconciled = exchange("all");

  // Sends the latest state; changes made while a send is under way are covered by one more send afterwards,
  // so the account is never sent more than one request at a time and ends with the latest state.
  function push(): void {
    dirty = true;
    if (sending !== null) return;
    sending = (async () => {
      await reconciled;
      while (dirty) {
        dirty = false;
        const apply = verifiedWanted ? "verified" : "none";
        verifiedWanted = false;
        await exchange(apply);
      }
    })().finally(() => {
      sending = null;
    });
  }

  return {
    // After the platform verified a run: one more sync, taking back the milestones it verified. Resolves when that sync is
    // done, so the game reads the verified level on its next call.
    refreshVerified: async () => {
      await reconciled;
      verifiedWanted = true;
      push();
      while (sending !== null) await sending;
    },
    // The id waits for the first reconcile like the first read does, so a signed-in player's game starts with the
    // account's id and not one that is about to change.
    identity: async () => {
      await reconciled;
      return accountId === null
        ? local.identity()
        : { id: accountId, kind: "account" };
    },
    loadProgress: async () => {
      await reconciled;
      return local.loadProgress();
    },
    milestones: async () => {
      await reconciled;
      return local.milestones();
    },
    player: () => ({ signedIn: status !== "local", walletConnected: false }),
    saveProgress: async (state, now) => {
      await reconciled;
      await local.saveProgress(state, now);
      push();
    },
    status: () => status,
    counters: async () => {
      await reconciled;
      return local.counters();
    },
    reportProgress: async (id, current, target, now) => {
      await reconciled;
      const result = await local.reportProgress(id, current, target, now);
      push();
      return result;
    },
    unlock: async (id, now, max) => {
      await reconciled;
      const result = await local.unlock(id, now, max);
      push();
      return result;
    },
  };
}
