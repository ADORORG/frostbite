import type { ExpiringStore } from "@ador/cache/expiring-store";
import type { Requester } from "@ador/client-http";
import type { WalletNetwork } from "@ador/wallet/contracts";

import {
  walletBalanceResponseSchema,
  walletBalanceRoute,
} from "../balance/contract.ts";

export interface BalanceTarget {
  readonly address: string;
  readonly network: WalletNetwork;
}

export interface BalanceReading {
  readonly asOf: string;
  // Waiting for its first confirmation; not spendable yet.
  readonly pendingSats: number;
  // Confirmed, so spendable.
  readonly satoshis: number;
}

// What the widget may say about the balance, and only what is true:
// - idle: nothing is being asked (no wallet, or the menu has never been open for this wallet);
// - loading: the first answer for this wallet is on its way;
// - ready / refreshing: a number from the platform's data source, and whether a newer one is being fetched;
// - stale: the last try failed, so the older number is shown as older;
// - unavailable: the platform has no number to give (no data source, or it failed) and nothing earlier to show;
// - failed: the request itself did not work and nothing earlier is known.
export type BalanceState =
  | "failed"
  | "idle"
  | "loading"
  | "ready"
  | "refreshing"
  | "stale"
  | "unavailable";

export interface BalanceSnapshot {
  readonly reading: BalanceReading | null;
  readonly reason: "not-configured" | "source-failed" | null;
  readonly state: BalanceState;
}

const keyOf = (target: BalanceTarget) => `${target.network}:${target.address}`;

// A wallet's balance, as a small store. It asks only while the menu is open and a wallet is connected: once when
// it opens, then every `intervalMs`, plus whenever the player asks. A reading belongs to one wallet on one network;
// a different wallet starts from nothing, and an answer that arrives for a wallet that has been replaced is dropped.
// With a `cache` (readings the tabs of this browser share, kept for one interval) a reading another tab or an earlier page took
// is shown at once and not asked for again until it is an interval old; a player's own ask always goes to the platform.
export function createBalanceStore(dependencies: {
  readonly cache?: ExpiringStore<BalanceReading>;
  readonly intervalMs: number;
  readonly now?: () => Date;
  readonly request: Requester;
}) {
  const { cache, intervalMs, now = () => new Date(), request } = dependencies;
  let target: BalanceTarget | null = null;
  let open = false;
  let reading: BalanceReading | null = null;
  let reason: BalanceSnapshot["reason"] = null;
  let state: BalanceState = "idle";
  let timer: ReturnType<typeof setInterval> | null = null;
  let latest = 0;
  let snapshot: BalanceSnapshot | null = null;
  const listeners = new Set<() => void>();

  function publish() {
    snapshot = null;
    for (const listener of listeners) listener();
  }

  async function refresh(): Promise<void> {
    if (target === null) return;
    const asking = target;
    const mine = (latest += 1);
    state = reading === null ? "loading" : "refreshing";
    publish();
    try {
      const answer = await request(
        walletBalanceRoute,
        walletBalanceResponseSchema,
        { body: asking },
      );
      if (mine !== latest) return;
      if (answer.status === "ready") {
        reading = {
          asOf: answer.asOf,
          pendingSats: answer.pendingSats,
          satoshis: answer.satoshis,
        };
        reason = null;
        state = "ready";
        cache?.write(keyOf(asking), { readAt: now(), value: reading });
      } else {
        reason = answer.reason;
        state = reading === null ? "unavailable" : "stale";
      }
    } catch {
      // Whatever went wrong (the network, a refusal, an answer in a shape we do not accept), there is no new number.
      if (mine !== latest) return;
      reason = null;
      state = reading === null ? "failed" : "stale";
    }
    publish();
  }

  // Takes up a reading the browser holds that is younger than an interval, instead of asking.
  function adopt(): boolean {
    if (target === null || cache === undefined) return false;
    const held = cache.read(keyOf(target));
    if (held === null) return false;
    reading = held.value;
    reason = null;
    state = "ready";
    publish();
    return true;
  }

  function ask() {
    if (!adopt()) void refresh();
  }

  function schedule() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (!open || target === null) return;
    ask();
    timer = setInterval(ask, intervalMs);
  }

  return {
    refresh,
    setOpen(next: boolean) {
      if (next === open) return;
      open = next;
      schedule();
    },
    setTarget(next: BalanceTarget | null) {
      if (
        next?.address === target?.address &&
        next?.network === target?.network
      )
        return;
      // A wallet that is no longer connected leaves nothing of its balance in the browser.
      if (target !== null) cache?.remove(keyOf(target));
      target = next;
      reading = null;
      reason = null;
      state = "idle";
      latest += 1;
      publish();
      schedule();
    },
    snapshot: (): BalanceSnapshot => (snapshot ??= { reading, reason, state }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type BalanceStore = ReturnType<typeof createBalanceStore>;
