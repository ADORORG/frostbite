"use client";

import { outcomeMessage } from "@ador/shared/account-outcomes";
import { useWalletChooser, useWalletConnection } from "@ador/wallet/client";
import { ArcadeActionButton } from "@repo/ui/arcade";

import { useWalletSession } from "../client/use-wallet-session.ts";

// What to do when a change needs a recent sign-in: sign again with the wallet, here, without leaving the screen or losing what was being
// done. An administrator always holds a wallet (the role needs one), so this is the way to confirm; the sign-in page cannot do it, since it
// takes someone who is already signed in straight on. Once the server has taken the signature, `onConfirmed` runs the change again.
export function ConfirmItIsYou({
  onConfirmed,
}: {
  readonly onConfirmed: () => void;
}) {
  const wallet = useWalletConnection();
  const chooser = useWalletChooser();
  const { actions, busy, failure } = useWalletSession(wallet);
  async function confirm() {
    if (await actions.stepUp()) onConfirmed();
  }
  return (
    <div className="arcade-actions">
      {wallet.connected ? (
        <ArcadeActionButton
          busy={busy === "step-up"}
          disabled={busy !== null}
          onClick={() => void confirm()}
          tone="mint"
        >
          {busy === "step-up"
            ? "Waiting for your wallet…"
            : "Sign again to confirm"}
        </ArcadeActionButton>
      ) : (
        <ArcadeActionButton onClick={chooser.request} tone="cyan">
          Connect your wallet to confirm
        </ArcadeActionButton>
      )}
      {failure === null ? null : <p role="alert">{outcomeMessage(failure)}</p>}
    </div>
  );
}
