"use client";

import {
  FeeSpeedChip,
  useFeeQuotes,
} from "@ador/feature-chain-status/fee-picker";
import type {
  ChainStatusApi,
  StatusPolling,
} from "@ador/feature-chain-status/api";
import type { FeeSpeed } from "@ador/shared/chain";
import { Avatar, ArcadeTextField, shortenMiddle } from "@repo/ui/arcade";
import { useState } from "react";

import { walletUnavailableCopy } from "../domain/copy.ts";
import { useFeeSettings } from "./fee-settings.tsx";
import type { Signer } from "./use-signer.ts";

// Who signs and how fast, in one line above the work: the wallet the steps will be signed with, which opens to change it, and the fee
// speed chosen, which opens to choose another. The address and the token's output are asked for only when there is none yet or when
// staff want to change them; the speed's tiles only when it is opened.
export function SignerBar({
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
  // Whether the fields are open: while there is no address, they are; once there is, they are closed until staff open them. A choice
  // made (typing, or pressing Change or Done) is kept, so the field does not close under someone who has just typed one character.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const asking = chosen ?? !signer.ready;
  return (
    <div className="signer-bar">
      <div className="signer-bar__row">
        <div className="signer-bar__who">
          <span className="signer-bar__label">Signing as</span>
          {signer.ready ? (
            <>
              <Avatar seed={signer.wallet.trim()} size={20} />
              <code title={signer.wallet.trim()}>
                {shortenMiddle(signer.wallet.trim())}
              </code>
              <button
                aria-expanded={asking}
                className="signer-bar__edit"
                onClick={() => setChosen(!asking)}
                type="button"
              >
                {asking ? "Done" : "Change"}
              </button>
            </>
          ) : (
            <span>no wallet address yet</span>
          )}
        </div>
        <SignerFee signer={signer} />
      </div>
      {asking ? (
        <div className="signer-bar__fields">
          <ArcadeTextField
            hint="The address of the wallet you will sign with."
            label="Wallet address"
            onChange={(value) => {
              setChosen(true);
              signer.setWallet(value);
            }}
            required
            value={signer.wallet}
          />
          {withAuthToken ? (
            <ArcadeTextField
              hint="Optional. Leave it blank and the platform finds the output that holds the game's auth token. Fill it in (txid:vout) only to name one yourself."
              label="Auth token output"
              onChange={signer.setAuthToken}
              value={signer.authToken}
            />
          ) : null}
        </div>
      ) : null}
      {canSign ? (
        <p className="signer-bar__hint" data-testid="wallet-signs">
          Your connected wallet will ask you to approve each step.
        </p>
      ) : (
        <p className="signer-bar__hint" data-testid="wallet-does-not-sign">
          {walletUnavailableCopy}
        </p>
      )}
      {signer.ready ? null : (
        <p className="signer-bar__hint">
          Enter your wallet address to start a step.
        </p>
      )}
    </div>
  );
}

// The speed beside who signs: each speed with what it costs on the chain now, in its own tiles. The step's review shows the exact
// fee before anything is signed. Not offered where the page was given no fee settings (and then no quote is asked for).
function SignerFee({ signer }: { readonly signer: Signer }) {
  const fees = useFeeSettings();
  if (fees === null || signer.feeSpeed === null) return null;
  return (
    <SignerFeeChip
      api={fees.api}
      polling={fees.polling}
      signer={signer}
      speed={signer.feeSpeed}
    />
  );
}

function SignerFeeChip({
  api,
  polling,
  signer,
  speed,
}: {
  readonly api: ChainStatusApi | undefined;
  readonly polling: StatusPolling;
  readonly signer: Signer;
  readonly speed: FeeSpeed;
}) {
  const market = useFeeQuotes({
    ...(api === undefined ? {} : { api }),
    polling,
  });
  return (
    <FeeSpeedChip market={market} onChange={signer.setFeeSpeed} value={speed} />
  );
}
