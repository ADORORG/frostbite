"use client";

import { useState } from "react";
import { ArcadeModal } from "@repo/ui/arcade";
import {
  useWalletConnection,
  walletNetworkUnavailableReason,
  classifyWalletConnectionError,
  type WalletConnectionFailure,
} from "@ador/wallet/client";
import type { WalletCandidate } from "../config.ts";
import { WalletQualificationPanel } from "./wallet-qualification-panel.tsx";

function abbreviated(address: string): string {
  return address.length <= 18
    ? address
    : `${address.slice(0, 8)}…${address.slice(-8)}`;
}

export function WalletConnectPanel({
  candidates,
}: {
  readonly candidates: readonly WalletCandidate[];
}) {
  const wallet = useWalletConnection();
  const [error, setError] = useState<{
    readonly candidate: WalletCandidate;
    readonly failure: WalletConnectionFailure;
  } | null>(null);
  const [pendingCandidate, setPendingCandidate] =
    useState<WalletCandidate | null>(null);

  if (wallet.connected) {
    return (
      <div className="arcade-actions">
        <p role="status">
          Connected to {wallet.provider ?? "wallet"} on {wallet.network}:{" "}
          {abbreviated(wallet.address)}
        </p>
        <p>
          Connection is ready for qualification. It does not create a platform
          session or prove wallet support.
        </p>
        <button
          className="arcade-button arcade-button--cyan"
          onClick={wallet.disconnect}
          type="button"
        >
          Disconnect
        </button>
        <WalletQualificationPanel
          key={`${wallet.provider}:${wallet.network}:${wallet.address}`}
          wallet={wallet}
        />
      </div>
    );
  }

  return (
    <div className="arcade-actions">
      <ArcadeModal title="Choose your wallet" triggerLabel="Choose wallet">
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
                  className="arcade-wallet-tile"
                  aria-label={`Connect ${candidate.label}`}
                  aria-busy={pendingCandidate?.id === candidate.id}
                  title={
                    walletNetworkUnavailableReason(
                      candidate.id,
                      wallet.network,
                    ) ?? candidate.label
                  }
                  disabled={
                    wallet.connecting ||
                    pendingCandidate !== null ||
                    walletNetworkUnavailableReason(
                      candidate.id,
                      wallet.network,
                    ) !== null
                  }
                  onClick={() => {
                    setError(null);
                    setPendingCandidate(candidate);
                    void wallet
                      .connect(candidate.id)
                      .catch((failure) => {
                        setError({
                          candidate,
                          failure: classifyWalletConnectionError(failure),
                        });
                      })
                      .finally(() => setPendingCandidate(null));
                  }}
                  type="button"
                >
                  {pendingCandidate?.id === candidate.id
                    ? "Connecting…"
                    : candidate.label}
                  {walletNetworkUnavailableReason(
                    candidate.id,
                    wallet.network,
                  ) !== null ? (
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
      </ArcadeModal>
    </div>
  );
}
