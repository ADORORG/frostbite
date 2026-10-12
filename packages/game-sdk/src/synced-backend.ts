import type { GameHostBackend } from "./host.ts";
import type { LocalBackend, LocalSnapshot } from "./local-backend.ts";

// How the account answers a sync: the merged state, "signed-out" when there is no account to sync with (so
// nothing more is tried), or "failed" when it could not be reached (so the next change tries again).
export type AccountSyncResult =
  | { readonly kind: "synced"; readonly state: LocalSnapshot }
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
  readonly onStatus?: (status: SyncStatus) => void;
  readonly remote: AccountPort;
}): SyncedBackend {
  const { local, remote } = options;
  let status: SyncStatus = "local";
  let signedOut = false;
  let sending: Promise<void> | null = null;
  let dirty = false;

  function setStatus(next: SyncStatus) {
    if (next === status) return;
    status = next;
    options.onStatus?.(next);
  }

  async function exchange(applyResult: boolean): Promise<void> {
    if (signedOut) return;
    let result: AccountSyncResult;
    try {
      result = await remote.sync(local.snapshot());
      // Storage that refuses the merged state (full, or blocked) is a failed sync like any other.
      if (result.kind === "synced" && applyResult) local.replace(result.state);
    } catch {
      result = { kind: "failed" };
    }
    if (result.kind === "signed-out") {
      signedOut = true;
      setStatus("local");
    } else setStatus(result.kind === "failed" ? "pending" : "account");
  }

  // The first read waits for one reconcile, so the game starts from the merged state.
  const reconciled = exchange(true);

  // Sends the latest state; changes made while a send is under way are covered by one more send afterwards,
  // so the account is never sent more than one request at a time and ends with the latest state.
  function push(): void {
    dirty = true;
    if (sending !== null) return;
    sending = (async () => {
      await reconciled;
      while (dirty) {
        dirty = false;
        await exchange(false);
      }
    })().finally(() => {
      sending = null;
    });
  }

  return {
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
    unlock: async (id, now) => {
      await reconciled;
      const result = await local.unlock(id, now);
      push();
      return result;
    },
  };
}
