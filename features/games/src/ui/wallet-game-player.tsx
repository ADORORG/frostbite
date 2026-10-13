"use client";

import { walletInfoSchema } from "@ador/game-sdk/protocol";
import { useWalletConnection, WalletProvider } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useMemo, type ComponentProps } from "react";

import { GamePlayer } from "./game-player.tsx";

type PlayerProps = Omit<ComponentProps<typeof GamePlayer>, "wallet">;

function ConnectedPlayer({
  connectHref,
  player,
}: {
  readonly connectHref: string;
  readonly player: PlayerProps;
}) {
  const { address, connected, network } = useWalletConnection();
  // Only an address the protocol accepts is passed on; anything else is treated as no wallet rather than sent
  // to the game in a shape it cannot read.
  const current = useMemo(() => {
    if (!connected) return null;
    const parsed = walletInfoSchema.safeParse({ address, network });
    return parsed.success ? parsed.data : null;
  }, [address, connected, network]);
  return <GamePlayer {...player} wallet={{ connectHref, current }} />;
}

// The game's stage with the player's wallet behind it, for a game that declared the wallet capability. The
// wallet provider is mounted only here, so a game that does not ask for a wallet carries none of it.
export function WalletGamePlayer({
  connectHref,
  network,
  ...player
}: PlayerProps & {
  readonly connectHref: string;
  readonly network: WalletNetwork;
}) {
  return (
    <WalletProvider network={network}>
      <ConnectedPlayer connectHref={connectHref} player={player} />
    </WalletProvider>
  );
}
