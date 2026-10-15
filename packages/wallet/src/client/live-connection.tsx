"use client";

import type {} from "../vendor/lasereyes-react.d.ts";

import {
  LaserEyesProvider,
  SUPPORTED_WALLETS,
  useLaserEyes,
} from "@omnisat/lasereyes-react";
import { useEffect } from "react";

import type { WalletNetwork } from "../contracts.ts";
import type { WalletConnectionClient } from "./connection-client.ts";
import type { ConnectionStore } from "./connection-store.ts";
import type { LaserEyesProviderId } from "../conformance/contracts.ts";

// Core 0.0.85 maps this normalized protocol to UniSat's "bip322-simple" and Xverse BIP322.
const laserEyesBip322Protocol = "bip322";

function providerAvailability(
  state: ReturnType<typeof useLaserEyes>,
  provider: LaserEyesProviderId,
): boolean {
  const availability = {
    binance: state.hasBinance,
    keplr: state.hasKeplr,
    leather: state.hasLeather,
    "magic-eden": state.hasMagicEden,
    okx: state.hasOkx,
    op_net: state.hasOpNet,
    orange: state.hasOrange,
    oyl: state.hasOyl,
    phantom: state.hasPhantom,
    sparrow: state.hasSparrow,
    tokeo: state.hasTokeo,
    unisat: state.hasUnisat,
    wizz: state.hasWizz,
    xverse: state.hasXverse,
  } as const satisfies Readonly<Record<LaserEyesProviderId, boolean>>;
  return availability[provider];
}

export function useLiveWalletConnection(): WalletConnectionClient {
  const state = useLaserEyes();
  const installationUrl = (provider: LaserEyesProviderId): string => {
    const wallet = SUPPORTED_WALLETS[provider];
    if (wallet === undefined) {
      throw new Error(`LaserEyes has no installation URL for ${provider}.`);
    }
    return wallet.url;
  };
  return {
    address: state.address,
    connected: state.connected,
    connecting: state.isConnecting,
    network: state.network,
    provider: state.provider ?? null,
    connect: state.connect,
    disconnect: state.disconnect,
    signMessage: async (message) => {
      if (
        !state.connected ||
        state.provider === undefined ||
        state.address.length === 0
      ) {
        throw new Error("A connected wallet account is required.");
      }
      return state.signMessage(message, {
        toSignAddress: state.address,
        protocol: laserEyesBip322Protocol,
      });
    },
    isInstalled: (provider) => providerAvailability(state, provider),
    installationUrl,
  };
}

// Reads the library's state and publishes it to the store the rest of the app reads. It renders nothing.
function Publisher({ store }: { readonly store: ConnectionStore }) {
  const client = useLiveWalletConnection();
  useEffect(() => store.publish(client));
  useEffect(() => () => store.publish(null), [store]);
  return null;
}

// The only place the wallet library is mounted. It is loaded on demand, so a page that never needs a wallet never fetches it.
export default function LaserEyesBridge({
  network,
  store,
}: {
  readonly network: WalletNetwork;
  readonly store: ConnectionStore;
}) {
  return (
    <LaserEyesProvider config={{ network }}>
      <Publisher store={store} />
    </LaserEyesProvider>
  );
}
