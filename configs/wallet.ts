import type { GameWalletConfig } from "@ador/feature-games";
import type { WalletAuthConfig } from "@ador/feature-accounts";

// How wallet sign-in behaves and which wallets a player can choose, as the business decided them. A change is a
// reviewed change to this record.
export const walletAuthConfig = {
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
  // The owner's choice: refresh the balance every minute, and only while the wallet menu is open.
  balanceRefreshMs: 60_000,
  // A challenge can be signed for five minutes.
  challengeLifetimeMs: 300_000,
  // Three wrong signatures kill a challenge, so a guess at a signature is not worth making.
  maximumVerificationAttempts: 3,
  network: "signet",
  // The connection library reconnects to the last wallet about two seconds after load (it waits for extensions);
  // a wallet that has not come back within ten seconds is not coming back.
  reconnectWaitMs: 10_000,
  // A wallet an account removed cannot be taken by another account for 24 hours (owner decision, 2026-10-13).
  releaseHoldMs: 86_400_000,
} as const satisfies WalletAuthConfig;

// How the games pages relate to the wallet: the network a game's wallet is expected to be on. Connecting is done
// from the header widget on any page.
export const gameWalletConfig = {
  network: walletAuthConfig.network,
} as const satisfies GameWalletConfig;
