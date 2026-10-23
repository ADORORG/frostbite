"use client";

import { Avatar } from "@repo/ui/arcade";
import type { WalletConnectionClient } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";

import type { BalanceSnapshot } from "../client/balance-store.ts";
import type { useWalletSession } from "../client/use-wallet-session.ts";
import { BalanceLine } from "./balance-line.tsx";
import { CopyAddress } from "./copy-address.tsx";
import { failureCopy } from "./failure-copy.ts";
import { networkName } from "./format.ts";
import { MenuWallets } from "./menu-wallets.tsx";

type Session = ReturnType<typeof useWalletSession>;

const statusText = {
  checking: "Checking your session…",
  disconnected: "No wallet is connected in this browser.",
  "connected-signed-out": "Connected, not signed in.",
  "not-linked": "Signed in. This wallet is not linked to your account.",
  linked: "Signed in with this wallet.",
} as const;

// What the wallet menu offers, by what is true now: the wallet that is connected, whether it is the account's, and
// the balance. Every change goes through the session store, which says "signed in" only after the server did.
export function WalletMenu({
  balance,
  expectedNetwork,
  id,
  onChoose,
  onRefreshBalance,
  onSessionChange,
  session,
  wallet,
}: {
  readonly balance: BalanceSnapshot;
  readonly expectedNetwork: WalletNetwork;
  readonly id: string;
  readonly onChoose: () => void;
  readonly onRefreshBalance: () => void;
  // Called after signing in or out succeeded, so the page can show what the new session may see.
  readonly onSessionChange: () => void;
  readonly session: Session;
  readonly wallet: WalletConnectionClient;
}) {
  const { actions, busy, failure, methods, view } = session;
  const working = busy !== null;
  const waiting = "Waiting for your wallet…";
  return (
    <div aria-label="Wallet" className="wallet-menu" id={id} role="group">
      {wallet.connected ? (
        <div className="wallet-menu__identity">
          <Avatar label="Wallet picture" seed={wallet.address} size={40} />
          <div>
            <code title={wallet.address}>{wallet.address}</code>
            <small>
              {wallet.provider ?? "Wallet"} · {networkName(wallet.network)}
            </small>
          </div>
          <CopyAddress address={wallet.address} />
        </div>
      ) : null}
      {wallet.connected && wallet.network !== expectedNetwork ? (
        <p className="wallet-menu__warning" role="status">
          {`⚠ ${networkName(wallet.network)} — this platform uses ${networkName(expectedNetwork)}`}
        </p>
      ) : null}
      <p className="wallet-menu__status" role="status">
        {
          statusText[
            view.kind === "disconnected" && view.signedIn ? "linked" : view.kind
          ]
        }
      </p>
      {failure === null ? null : <p role="alert">{failureCopy[failure]}</p>}
      <div className="wallet-menu__actions">
        {view.kind === "connected-signed-out" ? (
          <button
            className="wallet-menu__primary"
            disabled={working}
            onClick={() =>
              void actions.signIn().then((ok) => ok && onSessionChange())
            }
            type="button"
          >
            {busy === "sign-in" ? waiting : "Sign in with wallet"}
          </button>
        ) : null}
        {view.kind === "not-linked" ? (
          <button
            className="wallet-menu__primary"
            disabled={working}
            onClick={() => void actions.link()}
            type="button"
          >
            {busy === "link" ? waiting : "Link this wallet"}
          </button>
        ) : null}
        {failure === "recent-authentication-required" && wallet.connected ? (
          <button
            className="wallet-menu__primary"
            disabled={working}
            onClick={() => void actions.stepUp()}
            type="button"
          >
            {busy === "step-up" ? waiting : "Sign again to confirm"}
          </button>
        ) : null}
      </div>
      {wallet.connected ? (
        <BalanceLine
          balance={balance}
          network={wallet.network}
          onRefresh={onRefreshBalance}
        />
      ) : null}
      {methods === null ? null : (
        <MenuWallets
          busy={working}
          methods={methods}
          onRemove={(walletId) => void actions.unlink(walletId)}
        />
      )}
      <div className="wallet-menu__actions">
        <button
          className="wallet-menu__action"
          onClick={onChoose}
          type="button"
        >
          {wallet.connected ? "Switch wallet" : "Connect wallet"}
        </button>
        {wallet.connected ? (
          <button
            className="wallet-menu__action"
            disabled={working}
            onClick={wallet.disconnect}
            type="button"
          >
            Disconnect wallet
          </button>
        ) : null}
        {view.kind === "linked" ||
        view.kind === "not-linked" ||
        (view.kind === "disconnected" && view.signedIn) ? (
          <button
            className="wallet-menu__action"
            disabled={working}
            onClick={() =>
              void actions.signOut().then((ok) => ok && onSessionChange())
            }
            type="button"
          >
            Sign out
          </button>
        ) : null}
        <a className="wallet-menu__action" href="/account">
          Account and passkeys
        </a>
      </div>
    </div>
  );
}
