import { NetworkFee } from "@ador/feature-chain-status/fee-picker";
import type { GameAdminStep } from "@ador/shared/games";
import { ActionProgress, ArcadeTextField, KeyValueList } from "@repo/ui/arcade";

import {
  noSignerCopy,
  stepCopy,
  transactionRoleLabel,
  unconfirmedSendCopy,
} from "../domain/copy.ts";
import { explorerLink } from "../domain/explorer.ts";
import { stepFacts } from "../domain/facts.ts";
import { lifecycleSteps } from "../domain/lifecycle.ts";
import { useExplorerTxUrl } from "./explorer.tsx";
import { RecordAddress } from "./record-address.tsx";

// What a step is, for the review staff sign from: where it stands (its stages, from the platform's own record), what it does and on
// which contract or template, and what it costs, apart from the rest because it is what is being agreed to. It shows exactly what the
// platform built (the wallet signs that, and the platform refuses anything else), and it never says a step is done before the
// network's records show it. Without a wallet that signs, the transaction to sign elsewhere and a box for the signed result.
export function StepReview({
  canSign,
  message,
  onPaste,
  onRecord,
  pasted,
  step,
  working,
}: {
  readonly canSign: boolean;
  readonly message: string | null;
  readonly onPaste: (payload: string) => void;
  readonly onRecord: (address: string) => void;
  readonly pasted: string;
  readonly step: GameAdminStep;
  readonly working: boolean;
}) {
  const copy = stepCopy(step);
  const { summary } = step;
  const explorer = useExplorerTxUrl();
  return (
    <div
      className="review-stack"
      data-state={step.state}
      data-testid="step-review"
    >
      <ActionProgress
        detail={`${copy.detail}${step.failureReason === null ? "" : ` (${step.failureReason})`}`}
        steps={lifecycleSteps(step)}
        title={copy.label}
        working={step.state === "pending" || step.state === "confirmed"}
      />
      <KeyValueList items={stepFacts(step)} label="What this step does" />
      <NetworkFee
        asset={summary.fee.asset}
        baseUnits={summary.fee.baseUnits}
        detail={summary.feeDetail}
      />
      {step.unconfirmedSend ? (
        <p data-testid="unconfirmed-send" role="status">
          {unconfirmedSendCopy}
        </p>
      ) : null}
      {step.transactions.length === 0 ? null : (
        <KeyValueList
          items={step.transactions.map(({ id, role }) => {
            const href = explorer === null ? null : explorerLink(explorer, id);
            return {
              label: transactionRoleLabel[role],
              mono: true,
              value:
                href === null ? (
                  id
                ) : (
                  <a href={href} rel="noreferrer noopener" target="_blank">
                    {id}
                  </a>
                ),
            };
          })}
          label="Transactions on the network"
        />
      )}
      {step.createdContracts.length === 0 ? null : (
        <p data-testid="created-contracts">{`The network reports it created: ${step.createdContracts.join(", ")}.`}</p>
      )}
      {step.recordedBy === null ? null : (
        <p data-testid="recorded-by">{`The contract's address was entered by ${step.recordedBy}.`}</p>
      )}
      {step.recordable ? (
        <RecordAddress onRecord={onRecord} working={working} />
      ) : null}
      {message === null ? null : <p role="alert">{message}</p>}
      {step.toSign === null || canSign ? null : (
        <div className="step-review__elsewhere">
          <p>{noSignerCopy}</p>
          <label className="arcade-field">
            <span>Transaction to sign</span>
            <textarea readOnly rows={4} value={step.toSign.payload} />
          </label>
          <ArcadeTextField
            label="Signed transaction"
            multiline
            onChange={onPaste}
            value={pasted}
          />
        </div>
      )}
    </div>
  );
}
