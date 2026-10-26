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

import { useWalletSession } from "../client/use-wallet-session.ts";
import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChooserDialog } from "./chooser-dialog.tsx";
import { shortAddress } from "./format.ts";
import { useBalance } from "./use-balance.ts";
import { WalletMenu } from "./wallet-menu.tsx";

const subscribeToNothing = () => () => {};
const nothingRemembered = () => false;

// The wallet in the header of every page. With no wallet and nobody signed in it is one button that opens the
// wallet chooser; otherwise it shows the connected wallet's picture, short address and balance, and opens a menu. The
// balance is read while a wallet is connected and the tab is showing; the menu is where the account is signed in to,
// wallets are linked and removed.
export function WalletWidget({
  balanceRefreshMs,
  candidates,
  network,
  onSessionChange,
  reconnectWaitMs,
}: {
  readonly balanceRefreshMs: number;
  readonly candidates: readonly WalletCandidate[];
  readonly network: WalletNetwork;
  // Called after signing in or out succeeded; the app refreshes the page so it shows what the new session may see.
  readonly onSessionChange: () => void;
  readonly reconnectWaitMs: number;
}) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const session = useWalletSession(wallet);
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
  const signedIn =
    session.view.kind === "disconnected" && session.view.signedIn;
  // Signed out, and sure of it: the session has been read and says no one is signed in. A connected wallet alone is not a sign-in, so
  // the way to one is a link of its own, lit while a wallet is connected and waiting to be signed with.
  const signedOut =
    session.view.kind === "connected-signed-out" ||
    (session.view.kind === "disconnected" && !session.view.signedIn);
  const hasMenu = wallet.connected || signedIn || session.methods !== null;
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
                expectedNetwork={network}
                onChoose={() => {
                  close();
                  chooser.request();
                }}
                onRefreshBalance={balance.refresh}
                onSessionChange={onSessionChange}
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
