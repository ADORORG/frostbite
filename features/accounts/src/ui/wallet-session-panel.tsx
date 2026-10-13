"use client";

import { ArcadeActionButton, ArcadePanel, StatusLamp } from "@repo/ui/arcade";
import { useWalletConnection, WalletProvider } from "@ador/wallet/client";
import type { WalletNetwork } from "@ador/wallet/contracts";

import { useWalletSession } from "../client/use-wallet-session.ts";
import type { Failure } from "../client/wallet-session.ts";
import type { WalletCandidate } from "../wallet-config.ts";
import { WalletPicker } from "./wallet-picker.tsx";

// What a player is told when a step did not work. None of it says whose a wallet is.
export const failureCopy: Record<Failure, string> = {
  network: "The request did not reach the platform. Try again.",
  "not-connected": "Connect a wallet first.",
  "not-verified":
    "The wallet could not be verified. Try again with a fresh signature.",
  "recent-authentication-required":
    "To change this, sign in again with your wallet first.",
  "refused-by-wallet": "The wallet did not sign. Nothing was changed.",
  "unavailable-wallet": "This wallet cannot be used for that.",
  "wallet-changed":
    "The wallet changed while you were signing. Nothing was changed.",
};

const abbreviated = (address: string) =>
  address.length <= 18
    ? address
    : `${address.slice(0, 8)}…${address.slice(-8)}`;

function Inner({
  candidates,
}: {
  readonly candidates: readonly WalletCandidate[];
}) {
  const wallet = useWalletConnection();
  const session = useWalletSession(wallet);
  const { actions, busy, failure, methods, view } = session;
  const working = busy !== null;
  const lamp =
    view.kind === "linked"
      ? { label: "Signed in", tone: "ready" as const }
      : view.kind === "checking"
        ? { label: "Checking your session", tone: "attention" as const }
        : { label: "Not signed in", tone: "attention" as const };
  return (
    <ArcadePanel eyebrow="Wallet" title="Connect and sign in">
      <StatusLamp
        label={
          view.kind === "disconnected" && view.signedIn
            ? "Signed in"
            : lamp.label
        }
        tone={
          view.kind === "disconnected" && view.signedIn ? "ready" : lamp.tone
        }
      />
      {view.kind === "checking" ? (
        <p>Checking whether you are signed in…</p>
      ) : null}
      {view.kind === "disconnected" ? (
        <p>
          {view.signedIn
            ? "You are signed in. No wallet is connected in this browser."
            : "Connect a wallet to sign in. Connecting lets the platform see your address; you sign a message to prove it is yours."}
        </p>
      ) : null}
      {wallet.connected ? (
        <p role="status">
          Connected to {wallet.provider ?? "wallet"} on {wallet.network}:{" "}
          <span title={wallet.address}>{abbreviated(wallet.address)}</span>
        </p>
      ) : null}
      {view.kind === "connected-signed-out" ? (
        <p>This wallet is connected, but you are not signed in.</p>
      ) : null}
      {view.kind === "not-linked" ? (
        <p>You are signed in, but this wallet is not linked to your account.</p>
      ) : null}
      {view.kind === "linked" ? (
        <p>You are signed in with this wallet.</p>
      ) : null}
      {failure === null ? null : <p role="alert">{failureCopy[failure]}</p>}
      <div className="arcade-actions">
        {wallet.connected ? null : (
          <WalletPicker candidates={candidates} wallet={wallet} />
        )}
        {view.kind === "connected-signed-out" ? (
          <ArcadeActionButton
            disabled={working}
            onClick={() => void actions.signIn()}
            tone="cyan"
          >
            {busy === "sign-in"
              ? "Waiting for your wallet…"
              : "Sign in with wallet"}
          </ArcadeActionButton>
        ) : null}
        {view.kind === "not-linked" ? (
          <ArcadeActionButton
            disabled={working}
            onClick={() => void actions.link()}
            tone="cyan"
          >
            {busy === "link" ? "Waiting for your wallet…" : "Link this wallet"}
          </ArcadeActionButton>
        ) : null}
        {failure === "recent-authentication-required" && wallet.connected ? (
          <ArcadeActionButton
            disabled={working}
            onClick={() => void actions.stepUp()}
            tone="mint"
          >
            {busy === "step-up"
              ? "Waiting for your wallet…"
              : "Sign again to confirm"}
          </ArcadeActionButton>
        ) : null}
        {wallet.connected ? (
          <ArcadeActionButton
            disabled={working}
            onClick={wallet.disconnect}
            tone="pink"
          >
            Disconnect wallet
          </ArcadeActionButton>
        ) : null}
        {view.kind === "linked" ||
        view.kind === "not-linked" ||
        (view.kind === "disconnected" && view.signedIn) ? (
          <ArcadeActionButton
            disabled={working}
            onClick={() => void actions.signOut()}
            tone="pink"
          >
            Sign out
          </ArcadeActionButton>
        ) : null}
      </div>
      {methods === null ? null : (
        <section aria-label="How you sign in">
          <h2>How you sign in</h2>
          <ul aria-label="Linked wallets">
            {methods.wallets.map((linked) => (
              <li data-wallet={linked.address} key={linked.id}>
                <span title={linked.address}>
                  {abbreviated(linked.address)}
                </span>{" "}
                on {linked.network}
                {methods.wallets.length > 1 ? (
                  <>
                    {" "}
                    <ArcadeActionButton
                      disabled={working}
                      onClick={() => void actions.unlink(linked.id)}
                      tone="pink"
                    >
                      {`Remove ${abbreviated(linked.address)}`}
                    </ArcadeActionButton>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {methods.wallets.length > 1 ? null : (
            <p>
              This is your only way to sign in, so it cannot be removed. Link
              another wallet first.
            </p>
          )}
          {methods.passkeys.length === 0 ? null : (
            <p>{`${String(methods.passkeys.length)} passkey linked (an added way to confirm changes, not a way to sign in).`}</p>
          )}
        </section>
      )}
    </ArcadePanel>
  );
}

// The wallet screen: connect a wallet, sign in with it, link more wallets, sign out. The wallet connection library is
// mounted here, on the one screen that needs it.
export function WalletSessionPanel({
  candidates,
  network,
}: {
  readonly candidates: readonly WalletCandidate[];
  readonly network: WalletNetwork;
}) {
  return (
    <WalletProvider network={network}>
      <Inner candidates={candidates} />
    </WalletProvider>
  );
}
