import type { GameAdminStep } from "@ador/shared/games";
import { ArcadeActionButton, ArcadeTextField } from "@repo/ui/arcade";
import { useState } from "react";

import {
  feeText,
  noSignerCopy,
  operationLabel,
  shortHash,
  stateCopy,
} from "../domain/copy.ts";

// The review staff sign from: what the step does, on which contract, for what fee, until when, and where it stands. It shows exactly
// what the platform built (the wallet signs that, and the platform refuses anything else), and it never says a step is done before
// the network's records show it. With a wallet that signs, one button; without, the transaction to sign elsewhere and a box for the
// signed result.
export function StepReview({
  canSign,
  message,
  onClose,
  onSign,
  onSendPasted,
  step,
  working,
}: {
  readonly canSign: boolean;
  readonly message: string | null;
  readonly onClose: () => void;
  readonly onSendPasted: (payload: string) => void;
  readonly onSign: () => void;
  readonly step: GameAdminStep;
  readonly working: boolean;
}) {
  const [pasted, setPasted] = useState("");
  const copy = stateCopy[step.state];
  const { summary } = step;
  return (
    <section
      aria-label={`Step ${operationLabel(step)}`}
      className="arcade-claim"
      data-state={step.state}
      data-testid="step-review"
      role="dialog"
    >
      <h3>{operationLabel(step)}</h3>
      <dl>
        <dt>Network</dt>
        <dd>{summary.chain}</dd>
        <dt>Rewards contract</dt>
        <dd>{summary.contractId}</dd>
        {summary.claimLimit === undefined ? null : (
          <>
            <dt>Claims allowed per wallet</dt>
            <dd>{summary.claimLimit}</dd>
          </>
        )}
        {summary.drawing === undefined ? null : (
          <>
            <dt>Drawing</dt>
            <dd>{`${summary.drawing.bytes} bytes, ${shortHash(summary.drawing.sha256)}`}</dd>
          </>
        )}
        {summary.paused === undefined ? null : (
          <>
            <dt>Claims will be</dt>
            <dd>{summary.paused ? "paused" : "open"}</dd>
          </>
        )}
        <dt>Network fee</dt>
        <dd>{feeText(summary)}</dd>
        <dt>Valid until</dt>
        <dd>{summary.expiresAt}</dd>
      </dl>
      <p aria-live="polite" role="status">
        <strong>{copy.label}.</strong> {copy.detail}
        {step.failureReason === null ? null : ` (${step.failureReason})`}
      </p>
      {message === null ? null : <p role="alert">{message}</p>}
      {step.toSign === null ? null : canSign ? (
        <ArcadeActionButton disabled={working} onClick={onSign} tone="mint">
          {working ? "Waiting for your wallet…" : "Sign with your wallet"}
        </ArcadeActionButton>
      ) : (
        <>
          <p>{noSignerCopy}</p>
          <label className="arcade-field">
            <span>Transaction to sign</span>
            <textarea readOnly rows={5} value={step.toSign.payload} />
          </label>
          <ArcadeTextField
            label="Signed transaction"
            multiline
            onChange={setPasted}
            value={pasted}
          />
          <ArcadeActionButton
            disabled={working}
            onClick={() => onSendPasted(pasted)}
            tone="mint"
          >
            {working ? "Sending…" : "Send signed transaction"}
          </ArcadeActionButton>
        </>
      )}
      <ArcadeActionButton onClick={onClose} tone="pink">
        Close
      </ArcadeActionButton>
    </section>
  );
}
