import type { FeeDetail } from "@ador/shared/chain";

import { costBreakdown } from "../domain/fee-copy.ts";

// What a transaction costs, told wherever a person is about to act on the chain: the total in satoshis, then the rate it was priced at,
// the speed chosen and about how long it takes, and about how large the transaction is. The rate and size are shown only when the
// builder said them; any other asset is told as its amount, because a rate in sat/vB means nothing for it.
export function CostOverview({
  asset,
  baseUnits,
  detail,
}: {
  readonly asset: string;
  readonly baseUnits: string;
  readonly detail?: FeeDetail | undefined;
}) {
  const lines = costBreakdown({ asset, baseUnits, detail });
  return (
    <div className="cost-overview">
      <strong className="cost-overview__total">{lines.total}</strong>
      {lines.details.length === 0 ? null : (
        <ul className="cost-overview__details">
          {lines.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
