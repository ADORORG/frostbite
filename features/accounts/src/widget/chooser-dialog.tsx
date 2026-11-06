"use client";

import { ArcadeDialog } from "@repo/ui/arcade";
import {
  useWalletChooser,
  type WalletConnectionClient,
} from "@frostbite/wallet/client";
import { useEffect, useRef } from "react";

import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChoices } from "../ui/wallet-picker.tsx";

// The wallet chooser as a dialog the page opens from anywhere (the header button, a game asking for a wallet,
// "Switch wallet"). It closes itself when the choice has been made: when a wallet that was not connected when it
// opened is connected now, or a different wallet from the one connected when it opened. A wallet that was already
// connected does not close it, or "Switch wallet" would shut the dialog the moment it opened.
export function WalletChooserDialog({
  candidates,
  wallet,
}: {
  readonly candidates: readonly WalletCandidate[];
  readonly wallet: WalletConnectionClient;
}) {
  const { dismiss, open } = useWalletChooser();
  const { address, connected, connecting, provider } = wallet;
  const identity = connected ? `${provider ?? ""}:${address}` : null;
  const openedWith = useRef<string | null>(null);
  const wasOpen = useRef(false);
  const wasConnecting = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      wasConnecting.current = false;
      return;
    }
    if (!wasOpen.current) {
      wasOpen.current = true;
      openedWith.current = identity;
      return;
    }
    if (connecting) wasConnecting.current = true;
    // Chosen again: connecting started and has finished with a wallet connected, even if it is the same one.
    const reconnected = wasConnecting.current && !connecting && connected;
    if (reconnected || (identity !== null && identity !== openedWith.current))
      dismiss();
  }, [connected, connecting, dismiss, identity, open]);
  return (
    <ArcadeDialog onClose={dismiss} open={open} title="Choose your wallet">
      <WalletChoices candidates={candidates} wallet={wallet} />
    </ArcadeDialog>
  );
}
