"use client";

import { Avatar, Popover } from "@repo/ui/arcade";
import {
  hasRememberedWallet,
  useWalletChooser,
  useWalletConnection,
} from "@ador/wallet/client";
import { signInPath } from "@ador/shared/auth/sign-in-path";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useEffect, useState, useSyncExternalStore } from "react";

import { createRequester, sameOriginFetch } from "@ador/client-http";
import type { AccountOutcome } from "@ador/shared/account-outcomes";

import { signOut } from "../client/sign-out.ts";
import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChooserDialog } from "./chooser-dialog.tsx";
import { shortAddress } from "./format.ts";
import type { SessionState } from "./session-state.ts";
import { useBalance } from "./use-balance.ts";
import { WalletMenu } from "./wallet-menu.tsx";

const subscribeToNothing = () => () => {};
const nothingRemembered = () => false;

// The wallet in the header of every page. With no wallet and nobody signed in it is one button that opens the wallet chooser; otherwise
// it shows the connected wallet's picture, short address and balance, and opens a menu. The balance is read while a wallet is connected
// and the tab is showing. Who is signed in is what the server said when it rendered the page (`session`); signing in is the sign-in
// page's, which a link here leads to, and the menu's one change to the session is signing out.
export function WalletWidget({
  balanceRefreshMs,
  candidates,
  network,
  onSignedOut,
  reconnectWaitMs,
  session,
}: {
  readonly balanceRefreshMs: number;
  readonly candidates: readonly WalletCandidate[];
  readonly network: WalletNetwork;
  // Called after signing out succeeded; the app renders the page again, so it shows what a signed-out visitor may see.
  readonly onSignedOut: () => void;
  readonly reconnectWaitMs: number;
  readonly session: SessionState;
}) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const [signingOut, setSigningOut] = useState(false);
  const [failure, setFailure] = useState<AccountOutcome | null>(null);
  // A wallet the library remembers comes back a moment after load; until it does, or the wait runs out, say so
  // instead of showing "Account" or "Connect wallet" as if there were none. The server's markup assumes none, so the
  // first client render agrees with it and the remembered wallet is noticed right after.
  const remembered = useSyncExternalStore(
    subscribeToNothing,
    hasRememberedWallet,
    nothingRemembered,
  );
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!remembered) return;
    const giveUp = setTimeout(() => setGaveUp(true), reconnectWaitMs);
    return () => clearTimeout(giveUp);
  }, [reconnectWaitMs, remembered]);
  const waiting = remembered && !gaveUp && !wallet.connected;
  const signedIn = session === "signed-in";
  // Signed out, and sure of it. A connected wallet alone is not a sign-in, so the way to one is a link of its own, lit while a wallet is
  // connected and waiting to be signed with.
  const signedOut = session === "signed-out";
  const hasMenu = wallet.connected || signedIn;
  async function leave() {
    setSigningOut(true);
    const outcome = await signOut(createRequester(sameOriginFetch));
    setFailure(outcome);
    setSigningOut(false);
    if (outcome === null) onSignedOut();
  }
  const balance = useBalance({ intervalMs: balanceRefreshMs, wallet });
  const mismatch = wallet.connected && wallet.network !== network;
  return (
    <div className="wallet-widget">
      <Popover
        align="end"
        busy={waiting}
        label="Wallet"
        onTrigger={chooser.request}
        trigger={
          wallet.connected ? (
            <>
              <Avatar seed={wallet.address} size={20} />
              <span title={wallet.address}>{shortAddress(wallet.address)}</span>
              {mismatch ? <span aria-label="Wrong network">⚠</span> : null}
            </>
          ) : waiting ? (
            "Reconnecting wallet…"
          ) : signedIn ? (
            "Account"
          ) : (
            "Connect wallet"
          )
        }
        triggerClassName="popover__trigger wallet-widget__trigger"
        triggerData={{ "data-mismatch": mismatch ? "true" : undefined }}
      >
        {hasMenu
          ? ({ close }) => (
              <WalletMenu
                balance={balance}
                busy={signingOut}
                expectedNetwork={network}
                failure={failure}
                onChoose={() => {
                  close();
                  chooser.request();
                }}
                onRefreshBalance={balance.refresh}
                onSignOut={() => void leave()}
                session={session}
                wallet={wallet}
              />
            )
          : null}
      </Popover>
      {signedOut ? (
        <a
          className="wallet-widget__signin"
          data-waiting={wallet.connected ? "true" : undefined}
          href={signInPath}
        >
          Sign in
        </a>
      ) : null}
      <WalletChooserDialog candidates={candidates} wallet={wallet} />
    </div>
  );
}
