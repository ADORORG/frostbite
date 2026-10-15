import type { WalletConnectionClient } from "./connection-client.ts";

// Where the wallet connection lives between the app and the wallet library. The library is fetched only when something needs it
// (a wallet is remembered, or someone asks to connect), so the app reads the connection from here: an idle one until the library
// has loaded and published its own.
export interface ConnectionState {
  readonly live: WalletConnectionClient | null;
  // Whether the library has been asked for.
  readonly wanted: boolean;
}

export interface ConnectionStore {
  get(): ConnectionState;
  publish(live: WalletConnectionClient | null): void;
  subscribe(listener: () => void): () => void;
  // Asks for the library to be loaded. Asking again changes nothing.
  wake(): void;
  // Resolves with the library's connection once it is published and `ready` says of it that it is settled, or with whatever is
  // published when `timeoutMs` has passed (the library says for itself that a wallet is missing).
  whenLive(
    ready?: (live: WalletConnectionClient) => boolean,
    timeoutMs?: number,
  ): Promise<WalletConnectionClient>;
}

export function createConnectionStore(): ConnectionStore {
  let state: ConnectionState = { live: null, wanted: false };
  const listeners = new Set<() => void>();
  const set = (next: ConnectionState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => state,
    publish: (live) => {
      if (live === state.live) return;
      set({ ...state, live });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    wake: () => {
      if (!state.wanted) set({ ...state, wanted: true });
    },
    whenLive: (ready = () => true, timeoutMs = 0) =>
      new Promise((resolve) => {
        let waited = timeoutMs <= 0;
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Resolves with the connection once it is published and settled, or, after the wait, once it is published at all.
        function check() {
          const { live } = state;
          if (live === null || !(waited || ready(live))) return;
          clearTimeout(timer);
          listeners.delete(check);
          resolve(live);
        }
        listeners.add(check);
        if (!waited)
          timer = setTimeout(() => {
            waited = true;
            check();
          }, timeoutMs);
        check();
      }),
  };
}
