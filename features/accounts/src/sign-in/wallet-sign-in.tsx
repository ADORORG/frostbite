"use client";

import { useWalletChooser, useWalletConnection } from "@ador/wallet/client";
import { useEffect, useRef } from "react";

import { useWalletSession } from "../client/use-wallet-session.ts";
import { outcomeMessage } from "@ador/shared/account-outcomes";
import { networkName, shortAddress } from "../widget/format.ts";
import type { SignInViewProps } from "./views.ts";

// Signing in with a Bitcoin wallet: connect one, then sign a challenge. "Signed in" is shown only after the server has said so, and
// the page moves on once, whether the person signed in just now or already was.
export function WalletSignIn({ expectedNetwork, onSignedIn }: SignInViewProps) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const { actions, busy, failure, view } = useWalletSession(wallet);
  const signedIn =
    view.kind === "linked" ||
    view.kind === "not-linked" ||
    (view.kind === "disconnected" && view.signedIn);
  const moved = useRef(false);
  useEffect(() => {
    if (!signedIn || moved.current) return;
    moved.current = true;
    onSignedIn();
  }, [onSignedIn, signedIn]);
  const working = busy !== null;
  return (
    <div className="sign-in-method">
      {view.kind === "checking" ? (
        <p role="status">Checking your session…</p>
      ) : signedIn ? (
        <p role="status">Signed in. Taking you back…</p>
      ) : wallet.connected ? (
        <>
          <p role="status">
            {`${wallet.provider ?? "Wallet"} connected: `}
            <code title={wallet.address}>{shortAddress(wallet.address)}</code>
          </p>
          {wallet.network === expectedNetwork ? null : (
            <p role="status">
              {`⚠ Your wallet is on ${networkName(wallet.network)}; this platform uses ${networkName(expectedNetwork)}.`}
            </p>
          )}
          <button
            disabled={working}
            onClick={() => void actions.signIn()}
            type="button"
          >
            {busy === "sign-in"
              ? "Waiting for your wallet…"
              : "Sign in with wallet"}
          </button>
        </>
      ) : (
        <>
          <p>
            Connect your Bitcoin wallet, then sign a message to prove it is
            yours. Nothing is sent on chain.
          </p>
          <button onClick={chooser.request} type="button">
            Connect wallet
          </button>
        </>
      )}
      {failure === null ? null : <p role="alert">{outcomeMessage(failure)}</p>}
    </div>
  );
}
