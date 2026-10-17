"use client";

export { walletNetworkUnavailableReason } from "./network-availability.ts";
export { classifyWalletConnectionError } from "./connection-error.ts";
export { useWalletChooser } from "./chooser.tsx";
export { hasRememberedWallet } from "./remembered.ts";
export { useStepWallet } from "./step-signer.ts";
export type { StepWallet } from "./step-signer.ts";
export { WalletRefusedError } from "../bridge/step-signer.ts";
export type { WalletConnectionFailure } from "./connection-error.ts";
export type { WalletConnectionClient } from "./connection-client.ts";

import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { WalletNetwork } from "../contracts.ts";
import { WalletChooserProvider } from "./chooser.tsx";
import {
  idleConnection,
  type WalletConnectionClient,
} from "./connection-client.ts";
import {
  createConnectionStore,
  type ConnectionStore,
} from "./connection-store.ts";
import { hasRememberedWallet } from "./remembered.ts";

// The module that holds the wallet library, fetched on demand. A bundler makes it a chunk of its own.
const LaserEyesBridge = lazy(() => import("./live-connection.tsx"));

// How long a connect that had to wait for the library waits for it to find the wallet asked for, before trying anyway.
const extensionWaitMs = 3_000;

interface WalletContext {
  readonly idle: WalletConnectionClient;
  readonly store: ConnectionStore;
}

const Connection = createContext<WalletContext | null>(null);

interface WalletProviderProps {
  readonly children: ReactNode;
  readonly network: WalletNetwork;
}

// The wallet connection for the app. It costs nothing until it is needed: the library behind it is loaded when a wallet was
// remembered from an earlier visit (so it can reconnect), when someone asks for the chooser, or when something connects.
export function WalletProvider({ children, network }: WalletProviderProps) {
  const [store] = useState(createConnectionStore);
  const context = useMemo<WalletContext>(
    () => ({
      idle: idleConnection(network, async (provider) => {
        store.wake();
        // The library finds the installed wallets a moment after it starts; connecting before it has would find none.
        await (
          await store.whenLive(
            (live) => live.isInstalled(provider),
            extensionWaitMs,
          )
        ).connect(provider);
      }),
      store,
    }),
    [network, store],
  );
  useEffect(() => {
    if (hasRememberedWallet()) store.wake();
  }, [store]);
  const wanted = useSyncExternalStore(
    store.subscribe,
    () => store.get().wanted,
    () => false,
  );
  return (
    <Connection.Provider value={context}>
      <WalletChooserProvider onRequest={store.wake}>
        {children}
      </WalletChooserProvider>
      {wanted ? (
        <Suspense fallback={null}>
          <LaserEyesBridge network={network} store={store} />
        </Suspense>
      ) : null}
    </Connection.Provider>
  );
}

// The connection: the library's once it has loaded, an idle one (nothing connected) until then.
export function useWalletConnection(): WalletConnectionClient {
  const context = useContext(Connection);
  if (context === null)
    throw new Error("The wallet connection needs a WalletProvider above it.");
  const live = useSyncExternalStore(
    context.store.subscribe,
    () => context.store.get().live,
    () => null,
  );
  return live ?? context.idle;
}
