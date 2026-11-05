"use client";

import { ShellSlotsProvider } from "@repo/ui/arcade";
import { WalletProvider } from "@frostbite/wallet/client";
import type { WalletNetwork } from "@frostbite/wallet/contracts";
import type { ReactNode } from "react";

import type { WalletCandidate } from "../wallet-config.ts";
import type { SessionState } from "./session-state.ts";
import { WalletWidget } from "./wallet-widget.tsx";

export type { SessionState };

// The one place the wallet connection lives for the whole app, and the widget it puts at the end of every page's
// header. Mounted once, in the app's layout, so a connection survives moving between pages and every feature that
// needs a wallet (a game, a checkout) shares it.
export function WalletRoot({
  balanceRefreshMs,
  candidates,
  children,
  network,
  onSignedOut,
  reconnectWaitMs,
  session,
}: {
  readonly balanceRefreshMs: number;
  readonly candidates: readonly WalletCandidate[];
  readonly children: ReactNode;
  readonly network: WalletNetwork;
  // What the app does after the player signs out (it refreshes the page, which is rendered on the server).
  readonly onSignedOut: () => void;
  readonly reconnectWaitMs: number;
  // Whether anyone is signed in, as the server read it for this page.
  readonly session: SessionState;
}) {
  return (
    <WalletProvider network={network}>
      <ShellSlotsProvider
        headerEnd={
          <WalletWidget
            balanceRefreshMs={balanceRefreshMs}
            candidates={candidates}
            network={network}
            onSignedOut={onSignedOut}
            reconnectWaitMs={reconnectWaitMs}
            session={session}
          />
        }
      >
        {children}
      </ShellSlotsProvider>
    </WalletProvider>
  );
}
