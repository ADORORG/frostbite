"use client";

import {
  classifyWalletConnectionError,
  walletNetworkUnavailableReason,
  type WalletConnectionClient,
  type WalletConnectionFailure,
} from "@frostbite/wallet/client";
import { useState } from "react";

import type { WalletCandidate } from "../wallet-config.ts";

// The wallets the platform offers, those found in the browser first. A wallet that cannot work on the configured
// network is shown as unavailable, and a wallet that is not installed offers where to get it once connecting fails.
// Connecting is not signing in; it only lets the platform see an address.
export function WalletChoices({
  candidates,
  wallet,
}: {
  readonly candidates: readonly WalletCandidate[];
  readonly wallet: WalletConnectionClient;
}) {
  const [error, setError] = useState<{
    readonly candidate: WalletCandidate;
    readonly failure: WalletConnectionFailure;
  } | null>(null);
  const [pending, setPending] = useState<WalletCandidate | null>(null);
  const unavailable = (candidate: WalletCandidate) =>
    walletNetworkUnavailableReason(candidate.id, wallet.network);
  return (
    <>
      <p className="arcade-wallet-help">Select a wallet · {wallet.network}</p>
      <ul className="arcade-wallet-list">
        {[...candidates]
          .sort(
            (left, right) =>
              Number(wallet.isInstalled(right.id)) -
              Number(wallet.isInstalled(left.id)),
          )
          .map((candidate) => (
            <li key={candidate.id}>
              <button
                aria-busy={pending?.id === candidate.id}
                aria-label={`Connect ${candidate.label}`}
                className="arcade-wallet-tile"
                disabled={
                  wallet.connecting ||
                  pending !== null ||
                  unavailable(candidate) !== null
                }
                onClick={() => {
                  setError(null);
                  setPending(candidate);
                  void wallet
                    .connect(candidate.id)
                    .catch((failure) =>
                      setError({
                        candidate,
                        failure: classifyWalletConnectionError(failure),
                      }),
                    )
                    .finally(() => setPending(null));
                }}
                title={unavailable(candidate) ?? candidate.label}
                type="button"
              >
                {pending?.id === candidate.id ? "Connecting…" : candidate.label}
                {unavailable(candidate) !== null ? (
                  <small>Unavailable on {wallet.network}</small>
                ) : wallet.isInstalled(candidate.id) ? (
                  <small>Detected</small>
                ) : null}
              </button>
            </li>
          ))}
      </ul>
      {error === null ? null : (
        <p role="alert">
          {error.candidate.label}: {error.failure.message}
        </p>
      )}
      {error?.failure.kind === "provider-unavailable" ? (
        <a
          className="arcade-wallet-install"
          href={wallet.installationUrl(error.candidate.id)}
          rel="noreferrer"
          target="_blank"
        >
          Install {error.candidate.label}
        </a>
      ) : null}
    </>
  );
}
