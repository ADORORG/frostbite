"use client";

import { ExplorerBoundary } from "@ador/feature-chain-status/transaction";
import { walletInfoSchema } from "@ador/game-sdk/protocol";
import {
  useStepWallet,
  useWalletChooser,
  useWalletConnection,
} from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useMemo, type ComponentProps } from "react";

import type { ClaimFeeSettings } from "../wallet-config.ts";
import { GamePlayer } from "./game-player.tsx";

type PlayerProps = Omit<ComponentProps<typeof GamePlayer>, "claims" | "wallet">;

// The game's stage with the player's wallet behind it, for a game that declared the wallet capability. The wallet
// connection and the chooser belong to the app (the header widget); this only reads the connection and asks for the
// chooser, so a game that does not ask for a wallet is never told about one.
export function WalletGamePlayer({
  claimable = false,
  exposeWallet = true,
  explorerTxUrl,
  fees,
  network,
  signingWallets,
  ...player
}: PlayerProps & {
  // The game's milestones can be claimed: the page uses the connection to claim, without the game being told about it.
  readonly claimable?: boolean;
  // The game declared the wallet capability, so it is told what is connected.
  readonly exposeWallet?: boolean;
  // Where a claim's transaction is followed on a block explorer.
  readonly explorerTxUrl: string;
  // How a claim's fee speed is offered, where it is.
  readonly fees?: ClaimFeeSettings;
  readonly network: WalletNetwork;
  // The wallets the deployment lets sign a claim (a policy list, not a guess about what a wallet can do).
  readonly signingWallets: readonly string[];
}) {
  const {
    address,
    connected,
    network: connectedNetwork,
  } = useWalletConnection();
  const { request } = useWalletChooser();
  const { sign } = useStepWallet(signingWallets);
  // Only an address the protocol accepts is passed on; anything else is treated as no wallet rather than sent
  // to the game in a shape it cannot read.
  const current = useMemo(() => {
    if (!connected) return null;
    const parsed = walletInfoSchema.safeParse({
      address,
      network: connectedNetwork,
    });
    return parsed.success ? parsed.data : null;
  }, [address, connected, connectedNetwork]);
  return (
    <ExplorerBoundary txUrl={explorerTxUrl}>
      <GamePlayer
        {...player}
        claims={
          claimable
            ? {
                ...(fees === undefined ? {} : { fees }),
                ...(sign === undefined ? {} : { sign }),
                wallet: current,
              }
            : undefined
        }
        wallet={
          exposeWallet
            ? { connect: request, current, expectedNetwork: network }
            : undefined
        }
      />
    </ExplorerBoundary>
  );
}
