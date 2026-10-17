import { ArcadeInfoCard, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

import type { StartContext } from "./use-admin-steps.ts";

// Who will sign: the wallet address staff sign with and, where the network's steps must present the game's token, where that token
// is held. The context is what every step started from the page is built for.
export function useSigner() {
  const [wallet, setWallet] = useState("");
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
  signer,
  withAuthToken,
}: {
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
      {signer.ready ? null : <p>Enter your wallet address to start a step.</p>}
    </ArcadeInfoCard>
  );
}
