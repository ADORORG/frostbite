import type { WalletNetwork } from "@ador/wallet/contracts";

// How the games pages reach a wallet: the network the wallet is asked to connect on, and the page where a
// player connects one. Both belong to the platform's configuration, not to any game.
export interface GameWalletConfig {
  readonly connectHref: string;
  readonly network: WalletNetwork;
}
