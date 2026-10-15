"use client";

import { Avatar } from "@repo/ui/arcade";
import {
  hasRememberedWallet,
  useWalletChooser,
  useWalletConnection,
} from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useWalletSession } from "../client/use-wallet-session.ts";
import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChooserDialog } from "./chooser-dialog.tsx";
import { abbreviated } from "./format.ts";
import { useBalance } from "./use-balance.ts";
import { WalletMenu } from "./wallet-menu.tsx";

const subscribeToNothing = () => () => {};
const nothingRemembered = () => false;

// The wallet in the header of every page. With no wallet and nobody signed in it is one button that opens the
// wallet chooser; otherwise it shows the connected wallet's picture and short address and opens a menu. The menu is
// where the balance is read (only while it is open), the account is signed in to, wallets are linked and removed.
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
  const [menuRequested, setMenuRequested] = useState(false);
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
  const hasMenu = wallet.connected || signedIn || session.methods !== null;
  const menuOpen = menuRequested && hasMenu;
  const balance = useBalance({
    intervalMs: balanceRefreshMs,
    open: menuOpen,
    wallet,
  });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    const away = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        root.current !== null &&
        !root.current.contains(event.target)
      )
        setMenuRequested(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menuOpen]);
  const mismatch = wallet.connected && wallet.network !== network;
  return (
    <div
      className="wallet-widget"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuRequested(false);
          trigger.current?.focus();
        }
      }}
      ref={root}
    >
      <button
        aria-busy={waiting ? true : undefined}
        aria-controls={hasMenu ? menuId : undefined}
        aria-expanded={hasMenu ? menuOpen : undefined}
        className="wallet-widget__trigger"
        data-mismatch={mismatch ? "true" : undefined}
        onClick={() =>
          hasMenu ? setMenuRequested(!menuOpen) : chooser.request()
        }
        ref={trigger}
        type="button"
      >
        {wallet.connected ? (
          <>
            <Avatar seed={wallet.address} size={24} />
            <span title={wallet.address}>{abbreviated(wallet.address)}</span>
            {mismatch ? <span aria-label="Wrong network">⚠</span> : null}
          </>
        ) : waiting ? (
          "Reconnecting wallet…"
        ) : signedIn ? (
          "Account"
        ) : (
          "Connect wallet"
        )}
      </button>
      {menuOpen ? (
        <WalletMenu
          balance={balance}
          expectedNetwork={network}
          id={menuId}
          onChoose={() => {
            setMenuRequested(false);
            chooser.request();
          }}
          onRefreshBalance={balance.refresh}
          onSessionChange={onSessionChange}
          session={session}
          wallet={wallet}
        />
      ) : null}
      <WalletChooserDialog candidates={candidates} wallet={wallet} />
    </div>
  );
}
