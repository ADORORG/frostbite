import type { ChainStatusApi } from "@ador/feature-chain-status/api";
import type { FeeSpeed } from "@ador/shared/chain";
import type { WalletNetwork } from "@ador/wallet/contracts";

// How the games pages relate to the wallet: the network a game's wallet is expected to be on. It belongs to the
// platform's configuration, not to any game. Connecting a wallet is the header widget's job, not a page's.
export interface GameWalletConfig {
  // How a claim's fee speed is offered next to the milestones: the speed it starts on, how often the chain is asked what each
  // costs, and about how large a claim is (to tell a cost). Absent: no choice is offered and claims use the platform's usual speed.
  readonly fees?: ClaimFeeSettings;
  readonly network: WalletNetwork;
}

export interface ClaimFeeSettings {
  // Where the quotes come from; the platform's own route unless a test supplies another.
  readonly api?: ChainStatusApi;
  readonly defaultSpeed: FeeSpeed;
  readonly exampleVbytes: number;
  readonly refreshMs: number;
}
