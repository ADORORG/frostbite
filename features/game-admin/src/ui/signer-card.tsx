import { ArcadeInfoCard, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

import {
  FeeSpeedPicker,
  useFeeQuotes,
} from "@ador/feature-chain-status/fee-picker";
import type { ChainStatusApi } from "@ador/feature-chain-status/api";
import type { FeeSpeed } from "@ador/shared/chain";

import { walletUnavailableCopy } from "../domain/copy.ts";
import { useFeeSettings } from "./fee-settings.tsx";
import type { StartContext } from "./use-admin-steps.ts";

// Who will sign: the wallet address staff sign with and, where the network's steps must present the game's token, where that token
// is held. The context is what every step started from the page is built for.
// The address starts as the connected wallet's, if one is connected, and staff may change it.
export function useSigner(connectedAddress = "") {
  const [typed, setWallet] = useState<string | null>(null);
  const fees = useFeeSettings();
  const [feeSpeed, setFeeSpeed] = useState<FeeSpeed | null>(
    fees?.defaultSpeed ?? null,
  );
  const wallet = typed ?? connectedAddress;
  const [authToken, setAuthToken] = useState("");
  const context: StartContext = {
    authTokenOutput: authToken.trim(),
    ...(feeSpeed === null ? {} : { feeSpeed }),
    wallet: wallet.trim(),
  };
  return {
    authToken,
    context,
    feeSpeed,
    ready: context.wallet !== "",
    setAuthToken,
    setFeeSpeed,
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
      <SignerFees signer={signer} />
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

// How fast staff want the step confirmed, beside who signs: each speed with what it costs on the chain now. The step's review shows the
// exact fee before anything is signed. Not offered where the page was given no fee settings.
function SignerFees({ signer }: { readonly signer: Signer }) {
  const fees = useFeeSettings();
  if (fees === null || signer.feeSpeed === null) return null;
  return (
    <FeesPicker
      {...(fees.api === undefined ? {} : { api: fees.api })}
      onChange={signer.setFeeSpeed}
      refreshMs={fees.refreshMs}
      value={signer.feeSpeed}
    />
  );
}

function FeesPicker({
  api,
  onChange,
  refreshMs,
  value,
}: {
  readonly api?: ChainStatusApi;
  readonly onChange: (speed: FeeSpeed) => void;
  readonly refreshMs: number;
  readonly value: FeeSpeed;
}) {
  const market = useFeeQuotes({
    ...(api === undefined ? {} : { api }),
    refreshMs,
  });
  return <FeeSpeedPicker market={market} onChange={onChange} value={value} />;
}
