"use client";

import { Avatar } from "@repo/ui/arcade";
import type { WalletConnectionClient } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";

import type { BalanceSnapshot } from "../client/balance-store.ts";
import type { useWalletSession } from "../client/use-wallet-session.ts";
import { BalanceLine } from "./balance-line.tsx";
import { CopyAddress } from "./copy-address.tsx";
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { networkName, shortAddress } from "./format.ts";
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
  onChoose,
  onRefreshBalance,
  onSessionChange,
  session,
  wallet,
}: {
  readonly balance: BalanceSnapshot;
  readonly expectedNetwork: WalletNetwork;
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
    <div className="wallet-menu">
      {wallet.connected ? (
        <div className="wallet-identity">
          <Avatar label="Wallet picture" seed={wallet.address} size={36} />
          <div className="wallet-identity__text">
            <code title={wallet.address}>{shortAddress(wallet.address)}</code>
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
      {failure === null ? null : <p role="alert">{outcomeMessage(failure)}</p>}
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
      <ul className="menu-list wallet-menu__rows">
        <li>
          <button className="menu-link" onClick={onChoose} type="button">
            {wallet.connected ? "Switch wallet" : "Connect wallet"}
          </button>
        </li>
        {wallet.connected ? (
          <li>
            <button
              className="menu-link"
              disabled={working}
              onClick={wallet.disconnect}
              type="button"
            >
              Disconnect wallet
            </button>
          </li>
        ) : null}
        {view.kind === "linked" ||
        view.kind === "not-linked" ||
        (view.kind === "disconnected" && view.signedIn) ? (
          <li>
            <button
              className="menu-link"
              disabled={working}
              onClick={() =>
                void actions.signOut().then((ok) => ok && onSessionChange())
              }
              type="button"
            >
              Sign out
            </button>
          </li>
        ) : null}
        <li>
          <a className="menu-link" href="/account">
            Account and passkeys
          </a>
        </li>
      </ul>
    </div>
  );
}
