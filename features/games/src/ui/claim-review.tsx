import { CostOverview } from "@ador/feature-chain-status/fee-picker";
import type { GameClaim } from "@ador/shared/games";
import { ArcadeActionButton } from "@repo/ui/arcade";

import { claimCopy } from "../domain/claim-copy.ts";
import { noSignerCopy } from "./use-claims.ts";
import { shortAddress } from "./wallet-card.tsx";

// The review the player signs from: what the claim will do, who pays, until when, and where it stands. It shows exactly what the
// platform built (the wallet signs that, and the platform refuses anything else), and it never says the claim is done before the
// network's records show it.
export function ClaimReview({
  canSign,
  claim,
  message,
  onClose,
  onSign,
  title,
  working,
}: {
  readonly canSign: boolean;
  readonly claim: GameClaim;
  readonly message: string | null;
  readonly onClose: () => void;
  readonly onSign: () => void;
  readonly title: string;
  readonly working: boolean;
}) {
  const copy = claimCopy(claim);
  const { summary } = claim;
  return (
    <section
      aria-label={`Claim ${title}`}
      className="arcade-claim"
      data-state={claim.state}
      data-testid="claim-review"
      role="dialog"
    >
      <h3>{`Claim: ${title}`}</h3>
      <dl>
        <dt>Network</dt>
        <dd>{summary.chain}</dd>
        <dt>Rewards contract</dt>
        <dd>{summary.contractId}</dd>
        <dt>Goes to</dt>
        <dd title={summary.recipient}>{shortAddress(summary.recipient)}</dd>
        <dt>Network fee</dt>
        <dd>
          <CostOverview
            asset={summary.fee.asset}
            baseUnits={summary.fee.baseUnits}
            detail={summary.feeDetail}
          />
        </dd>
        <dt>Valid until</dt>
        <dd>{summary.expiresAt}</dd>
      </dl>
      <p aria-live="polite" role="status">
        <strong>{copy.label}.</strong> {copy.detail}
        {claim.failureReason === null ? null : ` (${claim.failureReason})`}
      </p>
      {message === null ? null : <p role="alert">{message}</p>}
      {claim.state === "awaiting-signature" ? (
        <>
          {canSign ? null : <p>{noSignerCopy}</p>}
          <ArcadeActionButton
            disabled={!canSign || working}
            onClick={onSign}
            tone="mint"
          >
            {working ? "Waiting for your wallet…" : "Sign with your wallet"}
          </ArcadeActionButton>
        </>
      ) : null}
      <ArcadeActionButton onClick={onClose} tone="pink">
        Close
      </ArcadeActionButton>
    </section>
  );
}
