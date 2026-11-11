"use client";

import { Avatar } from "@repo/ui/arcade";
import type { WalletConnectionClient } from "@frostbite/wallet/client";
import type { WalletNetwork } from "@frostbite/wallet/contracts";

import type { BalanceSnapshot } from "../client/balance-store.ts";
import { BalanceLine } from "./balance-line.tsx";
import { CopyAddress } from "./copy-address.tsx";
import { outcomeMessage } from "@frostbite/shared/account-outcomes";
import type { AccountOutcome } from "@frostbite/shared/account-outcomes";
import {
  myMilestonesNavigationLabel,
  myMilestonesPath,
} from "@frostbite/shared/games";
import {
  profileNavigationLabel,
  profileSetupPath,
} from "@frostbite/shared/profiles";
import { networkName, shortAddress } from "./format.ts";
import type { SessionState } from "./session-state.ts";

const statusText = {
  "signed-in": "Signed in.",
  "signed-out": "Not signed in.",
  unknown: "Your session could not be checked.",
} as const;

// What the wallet menu offers: the wallet that is connected and its balance, and where to go about the session. It does not sign in or
// manage how you sign in: signing in is the sign-in page, and linking or removing wallets the account page. Signing out is the one
// change made here, and the menu says it worked only after the server did.
export function WalletMenu({
  balance,
  busy,
  expectedNetwork,
  failure,
  onChoose,
  onRefreshBalance,
  onSignOut,
  session,
  wallet,
}: {
  readonly balance: BalanceSnapshot;
  readonly busy: boolean;
  readonly expectedNetwork: WalletNetwork;
  readonly failure: AccountOutcome | null;
  readonly onChoose: () => void;
  readonly onRefreshBalance: () => void;
  readonly onSignOut: () => void;
  readonly session: SessionState;
  readonly wallet: WalletConnectionClient;
}) {
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
        {statusText[session]}
      </p>
      {failure === null ? null : <p role="alert">{outcomeMessage(failure)}</p>}
      {wallet.connected ? (
        <BalanceLine
          balance={balance}
          network={wallet.network}
          onRefresh={onRefreshBalance}
        />
      ) : null}
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
              onClick={wallet.disconnect}
              type="button"
            >
              Disconnect wallet
            </button>
          </li>
        ) : null}
        {session === "signed-in" ? (
          <>
            <li>
              <a className="menu-link" href={myMilestonesPath}>
                {myMilestonesNavigationLabel}
              </a>
            </li>
            <li>
              <a className="menu-link" href={profileSetupPath}>
                {profileNavigationLabel}
              </a>
            </li>
            <li>
              <a className="menu-link" href="/account">
                Account and sign-in methods
              </a>
            </li>
            <li>
              <button
                className="menu-link"
                disabled={busy}
                onClick={onSignOut}
                type="button"
              >
                Sign out
              </button>
            </li>
          </>
        ) : null}
      </ul>
    </div>
  );
}
