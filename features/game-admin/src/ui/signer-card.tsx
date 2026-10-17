import { ArcadeInfoCard, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

import { walletUnavailableCopy } from "../domain/copy.ts";
import type { StartContext } from "./use-admin-steps.ts";

// Who will sign: the wallet address staff sign with and, where the network's steps must present the game's token, where that token
// is held. The context is what every step started from the page is built for.
// The address starts as the connected wallet's, if one is connected, and staff may change it.
export function useSigner(connectedAddress = "") {
  const [typed, setWallet] = useState<string | null>(null);
  const wallet = typed ?? connectedAddress;
  const [authToken, setAuthToken] = useState("");
  const context: StartContext = {
    authTokenOutput: authToken.trim(),
    wallet: wallet.trim(),
  };
  return {
    authToken,
    context,
    ready: context.wallet !== "",
    setAuthToken,
    setWallet,
    wallet,
  };
}

export type Signer = ReturnType<typeof useSigner>;

export function SignerCard({
  canSign = false,
  signer,
  withAuthToken,
}: {
  // Whether a connected wallet will sign the steps built here; where not, staff sign elsewhere and paste the result.
  readonly canSign?: boolean;
  readonly signer: Signer;
  // Whether the steps on this page spend the game's auth token (they do not when publishing a template or creating a contract).
  readonly withAuthToken: boolean;
}) {
  return (
    <ArcadeInfoCard title="Who signs">
      <ArcadeTextField
        hint="The address of the wallet you will sign with."
        label="Wallet address"
        onChange={signer.setWallet}
        required
        value={signer.wallet}
      />
      {withAuthToken ? (
        <ArcadeTextField
          hint="Where the game's auth token is held, as txid:vout. Needed to define milestones and pause on Bitcoin."
          label="Auth token output"
          onChange={signer.setAuthToken}
          value={signer.authToken}
        />
      ) : null}
      {canSign ? (
        <p data-testid="wallet-signs">
          Your connected wallet will ask you to approve each step.
        </p>
      ) : (
        <p data-testid="wallet-does-not-sign">{walletUnavailableCopy}</p>
      )}
      {signer.ready ? null : <p>Enter your wallet address to start a step.</p>}
    </ArcadeInfoCard>
  );
}
