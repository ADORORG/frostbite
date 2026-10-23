import type { BalanceSnapshot } from "../client/balance-store.ts";
import { formatBtc, unitOf, updatedAt } from "./format.ts";

const reasons = {
  "not-configured": "Balance unavailable: no data source is configured.",
  "source-failed": "Balance unavailable: the data source did not answer.",
} as const;

// The balance exactly as far as it is known: the figure large, then what it is in satoshis and when it was read, an older figure
// marked as older, or the reason there is none. Never a zero standing in for "unknown". What is still waiting for its first
// confirmation is told apart from what can be spent.
export function BalanceLine({
  balance,
  network,
  onRefresh,
}: {
  readonly balance: BalanceSnapshot;
  // The network the wallet is on, which decides the coin's name.
  readonly network: string;
  readonly onRefresh: () => void;
}) {
  const { reading, reason, state } = balance;
  const busy = state === "loading" || state === "refreshing";
  const unit = unitOf(network);
  return (
    <section aria-label="Balance" className="wallet-balance">
      <div className="wallet-balance__head">
        <span className="wallet-menu__label">Spendable balance</span>
        <button
          aria-label="Refresh balance"
          className="wallet-balance__refresh"
          disabled={busy}
          onClick={onRefresh}
          title={busy ? "Refreshing…" : "Refresh balance"}
          type="button"
        >
          <span aria-hidden="true" data-busy={busy ? "true" : undefined}>
            ↻
          </span>
        </button>
      </div>
      {reading !== null ? (
        <div role="status">
          <p className="wallet-balance__amount">
            <strong>{formatBtc(reading.satoshis)}</strong>
            <span>{unit}</span>
          </p>
          <small className="wallet-balance__detail">
            {`${reading.satoshis.toLocaleString("en-US")} sats · ${
              state === "stale"
                ? `last read ${updatedAt(reading.asOf)}; could not update`
                : `updated ${updatedAt(reading.asOf)}`
            }`}
          </small>
          {reading.pendingSats > 0 ? (
            <small
              className="wallet-balance__pending"
              data-testid="pending-balance"
            >
              {`+ ${formatBtc(reading.pendingSats)} ${unit} (${reading.pendingSats.toLocaleString("en-US")} sats) still waiting for its first confirmation; a step cannot spend it yet.`}
            </small>
          ) : null}
        </div>
      ) : (
        <p role="status">
          {state === "loading"
            ? "Loading balance…"
            : state === "unavailable" && reason !== null
              ? reasons[reason]
              : state === "failed"
                ? "Balance could not be loaded."
                : "Balance appears once the wallet has been read."}
        </p>
      )}
    </section>
  );
}
