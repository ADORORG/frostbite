"use client";

import { walletInfoSchema } from "@ador/game-sdk/protocol";
import { useWalletChooser, useWalletConnection } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useMemo, type ComponentProps } from "react";

import { GamePlayer } from "./game-player.tsx";

type PlayerProps = Omit<ComponentProps<typeof GamePlayer>, "wallet">;

// The game's stage with the player's wallet behind it, for a game that declared the wallet capability. The wallet
// connection and the chooser belong to the app (the header widget); this only reads the connection and asks for the
// chooser, so a game that does not ask for a wallet is never told about one.
export function WalletGamePlayer({
  network,
  ...player
}: PlayerProps & { readonly network: WalletNetwork }) {
  const {
    address,
    connected,
    network: connectedNetwork,
  } = useWalletConnection();
  const { request } = useWalletChooser();
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
    <GamePlayer
      {...player}
      wallet={{ connect: request, current, expectedNetwork: network }}
    />
  );
}
