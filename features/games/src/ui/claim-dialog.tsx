import { NetworkFee } from "@frostbite/feature-chain-status/fee-picker";
import {
  TransactionList,
  plainTransactionLabel,
} from "@frostbite/feature-chain-status/transaction";
import type { GameClaim } from "@frostbite/shared/games";
import {
  ActionProgress,
  ArcadeDialog,
  ArcadeSignButton,
  KeyValueList,
  shortenMiddle,
} from "@repo/ui/arcade";

import { claimCopy } from "../domain/claim-copy.ts";

// The claim a player signs from, in a dialog over the whole page so nothing (the dock, the game) can hide it: where the claim stands,
// what it costs, and one button to sign. The rest of what the platform built is behind "Details". It shows exactly what the platform
// built (the wallet signs that, and the platform refuses anything else), and it never says the claim is done before the network's
// records show it. `claim` is null while the dialog is closed.
export function ClaimDialog({
  claim,
  message,
  onClose,
  onSign,
  signerNote,
  title,
  working,
}: {
  readonly claim: GameClaim | null;
  readonly message: string | null;
  readonly onClose: () => void;
  readonly onSign: () => void;
  // Why nothing can be signed, or null while something can.
  readonly signerNote: string | null;
  readonly title: string;
  readonly working: boolean;
}) {
  const copy = claim === null ? null : claimCopy(claim);
  return (
    <ArcadeDialog
      footer={
        claim?.state === "awaiting-signature" ? (
          <ArcadeSignButton
            disabled={signerNote !== null}
            onClick={onSign}
            working={working}
          />
        ) : undefined
      }
      onClose={onClose}
      open={claim !== null}
      title={`Claim: ${title}`}
    >
      {claim === null || copy === null ? null : (
        <div
          className="review-stack"
          data-state={claim.state}
          data-testid="claim-review"
        >
          <ActionProgress
            detail={`${copy.detail}${claim.failureReason === null ? "" : ` (${claim.failureReason})`}`}
            title={copy.label}
            working={claim.state === "pending" || claim.state === "claimed"}
          />
          <NetworkFee
            asset={claim.summary.fee.asset}
            baseUnits={claim.summary.fee.baseUnits}
            detail={claim.summary.feeDetail}
          />
          {claim.transactionId === null ? null : (
            <TransactionList
              transactions={[
                { id: claim.transactionId, label: plainTransactionLabel },
              ]}
            />
          )}
          {message === null ? null : <p role="alert">{message}</p>}
          {claim.state === "awaiting-signature" && signerNote !== null ? (
            <p role="status">{signerNote}</p>
          ) : null}
          <details className="review-stack__details">
            <summary>Details</summary>
            <KeyValueList
              items={[
                { label: "Network", value: claim.summary.chain },
                {
                  label: "Rewards contract",
                  mono: true,
                  value: claim.summary.contractId,
                },
                {
                  label: "Goes to",
                  mono: true,
                  value: (
                    <span title={claim.summary.recipient}>
                      {shortenMiddle(claim.summary.recipient)}
                    </span>
                  ),
                },
                { label: "Valid until", value: claim.summary.expiresAt },
              ]}
              label="What this claim does"
            />
          </details>
        </div>
      )}
    </ArcadeDialog>
  );
}
