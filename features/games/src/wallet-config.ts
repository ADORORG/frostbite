import type { WalletNetwork } from "@ador/wallet/contracts";

// How the games pages relate to the wallet: the network a game's wallet is expected to be on. It belongs to the
// platform's configuration, not to any game. Connecting a wallet is the header widget's job, not a page's.
export interface GameWalletConfig {
  readonly network: WalletNetwork;
}
