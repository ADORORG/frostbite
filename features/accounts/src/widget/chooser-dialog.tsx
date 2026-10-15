"use client";

import { ArcadeDialog } from "@repo/ui/arcade";
import {
  useWalletChooser,
  type WalletConnectionClient,
} from "@ador/wallet/client";
import { useEffect } from "react";

import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChoices } from "../ui/wallet-picker.tsx";

// The wallet chooser as a dialog the page opens from anywhere (the header button, a game asking for a wallet). It
// closes itself once a wallet is connected, so the player is back where they were.
export function WalletChooserDialog({
  candidates,
  wallet,
}: {
  readonly candidates: readonly WalletCandidate[];
  readonly wallet: WalletConnectionClient;
}) {
  const chooser = useWalletChooser();
  const { connected } = wallet;
  const { dismiss, open } = chooser;
  useEffect(() => {
    if (connected && open) dismiss();
  }, [connected, dismiss, open]);
  return (
    <ArcadeDialog onClose={dismiss} open={open} title="Choose your wallet">
      <WalletChoices candidates={candidates} wallet={wallet} />
    </ArcadeDialog>
  );
}
