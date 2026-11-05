import type {
  ChainStatusApi,
  StatusPolling,
} from "@frostbite/feature-chain-status/api";
import type { FeeSpeed } from "@frostbite/shared/chain";
import type { WalletNetwork } from "@frostbite/wallet/contracts";

// How the games pages relate to the wallet: the network a game's wallet is expected to be on. It belongs to the
// platform's configuration, not to any game. Connecting a wallet is the header widget's job, not a page's.
export interface GameWalletConfig {
  // Where a claim's transaction is shown on a block explorer, with `{id}` where its id goes.
  readonly explorerTxUrl: string;
  // How a claim's fee speed is offered next to the milestones: the speed it starts on, how often the chain is asked what each
  // costs. Absent: no choice is offered and claims use the platform's usual speed.
  readonly fees?: ClaimFeeSettings;
  readonly network: WalletNetwork;
  // The wallets that sign a claim for a player, by provider id; the same list staff steps are signed with.
  readonly signingWallets: readonly string[];
}

export interface ClaimFeeSettings {
  // Where the quotes come from; the platform's own route unless a test supplies another.
  readonly api?: ChainStatusApi;
  readonly defaultSpeed: FeeSpeed;
  readonly polling: StatusPolling;
}
