import type { BalanceSnapshot } from "../client/balance-store.ts";
import { formatBalance, updatedAt } from "./format.ts";

const reasons = {
  "not-configured": "Balance unavailable: no data source is configured.",
  "source-failed": "Balance unavailable: the data source did not answer.",
} as const;

// The balance exactly as far as it is known: a figure with the time it was read, an older figure marked as older, or
// the reason there is none. Never a zero standing in for "unknown".
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
  return (
    <div className="wallet-menu__balance">
      <span className="wallet-menu__label">Spendable balance</span>
      <p role="status">
        {reading !== null ? (
          <>
            {formatBalance(reading.satoshis, network)}
            {reading.pendingSats > 0 ? (
              <small data-testid="pending-balance">
                {` Plus ${formatBalance(reading.pendingSats, network)} still waiting for its first confirmation; a step cannot spend it yet.`}
              </small>
            ) : null}
            <small>
              {state === "stale"
                ? ` Last read ${updatedAt(reading.asOf)}; could not update.`
                : ` Updated ${updatedAt(reading.asOf)}.`}
            </small>
          </>
        ) : state === "loading" ? (
          "Loading balance…"
        ) : state === "unavailable" && reason !== null ? (
          reasons[reason]
        ) : state === "failed" ? (
          "Balance could not be loaded."
        ) : (
          "Balance appears while this menu is open."
        )}
      </p>
      <button
        className="wallet-menu__action"
        disabled={busy}
        onClick={onRefresh}
        type="button"
      >
        {busy ? "Refreshing…" : "Refresh balance"}
      </button>
    </div>
  );
}
