"use client";

export { walletNetworkUnavailableReason } from "./network-availability.ts";
export { classifyWalletConnectionError } from "./connection-error.ts";
export { useWalletChooser } from "./chooser.tsx";
export type { WalletConnectionFailure } from "./connection-error.ts";

import type {} from "../vendor/lasereyes-react.d.ts";

import {
  LaserEyesProvider,
  SUPPORTED_WALLETS,
  useLaserEyes,
} from "@omnisat/lasereyes-react";
import type { ReactNode } from "react";

import type { WalletNetwork } from "../contracts.ts";
import { WalletChooserProvider } from "./chooser.tsx";
import type { LaserEyesProviderId } from "../conformance/contracts.ts";

// Core 0.0.85 maps this normalized protocol to UniSat's "bip322-simple" and Xverse BIP322.
const laserEyesBip322Protocol = "bip322";

export interface WalletConnectionClient {
  readonly address: string;
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly network: WalletNetwork;
  readonly provider: LaserEyesProviderId | null;
  connect(provider: LaserEyesProviderId): Promise<void>;
  disconnect(): void;
  signMessage(message: string): Promise<string>;
  isInstalled(provider: LaserEyesProviderId): boolean;
  installationUrl(provider: LaserEyesProviderId): string;
}

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

export function useWalletConnection(): WalletConnectionClient {
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

interface WalletProviderProps {
  readonly children: ReactNode;
  readonly network: WalletNetwork;
}

export function WalletProvider({ children, network }: WalletProviderProps) {
  return (
    <LaserEyesProvider config={{ network }}>
      <WalletChooserProvider>{children}</WalletChooserProvider>
    </LaserEyesProvider>
  );
}
