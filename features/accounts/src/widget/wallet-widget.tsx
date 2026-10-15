"use client";

import { Avatar } from "@repo/ui/arcade";
import { useWalletChooser, useWalletConnection } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import { useEffect, useId, useRef, useState } from "react";

import { useWalletSession } from "../client/use-wallet-session.ts";
import type { WalletCandidate } from "../wallet-config.ts";
import { WalletChooserDialog } from "./chooser-dialog.tsx";
import { abbreviated } from "./format.ts";
import { useBalance } from "./use-balance.ts";
import { WalletMenu } from "./wallet-menu.tsx";

// The wallet in the header of every page. With no wallet and nobody signed in it is one button that opens the
// wallet chooser; otherwise it shows the connected wallet's picture and short address and opens a menu. The menu is
// where the balance is read (only while it is open), the account is signed in to, wallets are linked and removed.
export function WalletWidget({
  balanceRefreshMs,
  candidates,
  network,
}: {
  readonly balanceRefreshMs: number;
  readonly candidates: readonly WalletCandidate[];
  readonly network: WalletNetwork;
}) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const session = useWalletSession(wallet);
  const [menuRequested, setMenuRequested] = useState(false);
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
          session={session}
          wallet={wallet}
        />
      ) : null}
      <WalletChooserDialog candidates={candidates} wallet={wallet} />
    </div>
  );
}
