import type { GameWalletConfig } from "@ador/feature-games";
import type { WalletConnectionConfig } from "@ador/feature-wallet-connection";
import { walletQualificationDefaults } from "@ador/shared/wallet-qualification";

export const walletConnectionConfig = {
  candidates: [
    { id: "xverse", label: "Xverse" },
    { id: "unisat", label: "UniSat" },
    { id: "leather", label: "Leather" },
    { id: "okx", label: "OKX" },
    { id: "phantom", label: "Phantom" },
    { id: "magic-eden", label: "Magic Eden" },
    { id: "oyl", label: "Oyl" },
    { id: "orange", label: "Orange" },
    { id: "wizz", label: "Wizz" },
    { id: "tokeo", label: "Tokeo" },
    { id: "keplr", label: "Keplr" },
    { id: "binance", label: "Binance" },
    { id: "op_net", label: "OP_NET" },
  ],
  network: "signet",
  qualification: walletQualificationDefaults,
} as const satisfies WalletConnectionConfig;

// How the games pages reach a wallet: the same network as the connection page, and that page's address, where a
// player connects one before a game that asked for it can see the address.
export const gameWalletConfig = {
  connectHref: "/connect",
  network: walletConnectionConfig.network,
} as const satisfies GameWalletConfig;
