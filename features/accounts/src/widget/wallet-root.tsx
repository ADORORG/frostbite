"use client";

import { ShellSlotsProvider } from "@repo/ui/arcade";
import { WalletProvider } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import type { ReactNode } from "react";

import type { WalletCandidate } from "../wallet-config.ts";
import { WalletWidget } from "./wallet-widget.tsx";

// The one place the wallet connection lives for the whole app, and the widget it puts at the end of every page's
// header. Mounted once, in the app's layout, so a connection survives moving between pages and every feature that
// needs a wallet (a game, a checkout) shares it.
export function WalletRoot({
  balanceRefreshMs,
  candidates,
  children,
  network,
  onSessionChange,
  reconnectWaitMs,
}: {
  readonly balanceRefreshMs: number;
  readonly candidates: readonly WalletCandidate[];
  readonly children: ReactNode;
  readonly network: WalletNetwork;
  // What the app does after the player signs in or out (it refreshes the page, which is rendered on the server).
  readonly onSessionChange: () => void;
  readonly reconnectWaitMs: number;
}) {
  return (
    <WalletProvider network={network}>
      <ShellSlotsProvider
        headerEnd={
          <WalletWidget
            balanceRefreshMs={balanceRefreshMs}
            candidates={candidates}
            network={network}
            onSessionChange={onSessionChange}
            reconnectWaitMs={reconnectWaitMs}
          />
        }
      >
        {children}
      </ShellSlotsProvider>
    </WalletProvider>
  );
}
