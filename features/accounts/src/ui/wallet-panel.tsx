"use client";

import { useWalletChooser, useWalletConnection } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";
import {
  ArcadeActionButton,
  Avatar,
  ConsoleCard,
  ConsoleRow,
  StatusLamp,
} from "@repo/ui/arcade";

import { useWalletSession } from "../client/use-wallet-session.ts";
import { failureCopy } from "../widget/failure-copy.ts";
import { networkName, shortAddress } from "../widget/format.ts";

// The wallets that sign in to this account, with what to do about each: link the one connected in this browser, connect another to
// link it, or remove one while another way in remains. The header's wallet menu does the same in a corner; this is where it is looked
// for. Everything goes through the wallet session, which says a step worked only after the server did. `otherWays` is how many other
// ways in the account has (passkeys, email addresses): a wallet is removable while it is not the last way in, which the server also
// decides, so the button is only withheld where the answer would be no.
export function WalletPanel({
  expectedNetwork,
  otherWays,
}: {
  readonly expectedNetwork: WalletNetwork;
  readonly otherWays: number;
}) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const { actions, busy, failure, methods, view } = useWalletSession(wallet);
  const working = busy !== null;
  const wallets = methods?.wallets ?? [];
  const removable = wallets.length + otherWays > 1;
  const waiting = "Waiting for your wallet…";
  return (
    <ConsoleCard
      count={methods === null ? undefined : wallets.length}
      glyph="◈"
      lead="Bitcoin wallets that can sign in to this account. Connecting one in the header never signs you in by itself; linking proves it is yours."
      title="Wallets"
    >
      {failure === null ? null : (
        <StatusLamp label={failureCopy[failure]} tone="unavailable" />
      )}
      {methods === null ? (
        <p role="status">
          {failure === null
            ? "Reading your wallets…"
            : "Your wallets could not be read."}
        </p>
      ) : wallets.length === 0 ? (
        <p>No wallet is linked to this account yet.</p>
      ) : (
        <ul aria-label="Linked wallets" className="console-list">
          {wallets.map((linked) => (
            <ConsoleRow
              action={
                removable ? (
                  <ArcadeActionButton
                    ariaLabel={`Remove ${shortAddress(linked.address)}`}
                    disabled={working}
                    onClick={() => void actions.unlink(linked.id)}
                    size="small"
                    tone="yellow"
                  >
                    Remove
                  </ArcadeActionButton>
                ) : undefined
              }
              detail={`${networkName(linked.network)}${
                wallet.connected && wallet.address === linked.address
                  ? " · connected in this browser"
                  : ""
              }`}
              key={linked.id}
              leading={<Avatar seed={linked.address} size={32} />}
              name={
                <span title={linked.address}>
                  {shortAddress(linked.address)}
                </span>
              }
            />
          ))}
        </ul>
      )}
      {methods !== null && !removable ? (
        <p className="arcade-muted">
          This is your only way to sign in, so it cannot be removed. Add another
          way first.
        </p>
      ) : null}
      {wallet.connected && wallet.network !== expectedNetwork ? (
        <StatusLamp
          label={`Your wallet is on ${networkName(wallet.network)}; this platform uses ${networkName(expectedNetwork)}.`}
          tone="attention"
        />
      ) : null}
      <div className="arcade-actions">
        {view.kind === "not-linked" ? (
          <ArcadeActionButton
            busy={busy === "link"}
            disabled={working}
            onClick={() => void actions.link()}
          >
            {busy === "link" ? waiting : `Link ${shortAddress(wallet.address)}`}
          </ArcadeActionButton>
        ) : null}
        {failure === "recent-authentication-required" && wallet.connected ? (
          <ArcadeActionButton
            busy={busy === "step-up"}
            disabled={working}
            onClick={() => void actions.stepUp()}
            tone="mint"
          >
            {busy === "step-up" ? waiting : "Sign again to confirm"}
          </ArcadeActionButton>
        ) : null}
        <ArcadeActionButton
          disabled={working}
          onClick={chooser.request}
          tone={view.kind === "not-linked" ? "pink" : "cyan"}
        >
          {wallet.connected ? "Connect another wallet" : "Connect a wallet"}
        </ArcadeActionButton>
      </div>
    </ConsoleCard>
  );
}
