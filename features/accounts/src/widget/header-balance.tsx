import type { BalanceSnapshot } from "../client/balance-store.ts";
import { formatBtc, unitOf, updatedAt } from "./format.ts";

// The balance in the header, beside the wallet's address, so it is always in view: the confirmed figure (what a step can spend), the
// sats still waiting for a first confirmation next to it, and an older figure marked as older. Nothing is drawn before a wallet has
// been asked about, and never a zero standing in for "unknown".
export function HeaderBalance({
  balance,
  network,
}: {
  readonly balance: BalanceSnapshot;
  readonly network: string;
}) {
  const { reading, state } = balance;
  const unit = unitOf(network);
  if (reading !== null) {
    const old = state === "stale";
    return (
      <>
        <span
          className="wallet-widget__balance"
          data-stale={old ? "true" : undefined}
          title={
            old
              ? `Last read ${updatedAt(reading.asOf)}; could not update.`
              : `Spendable now. Read ${updatedAt(reading.asOf)}.`
          }
        >
          {`${formatBtc(reading.satoshis)} ${unit}`}
          {old ? <small> (old)</small> : null}
        </span>
        {reading.pendingSats > 0 ? (
          <span
            className="wallet-widget__pending"
            title={`${reading.pendingSats.toLocaleString("en-US")} sats are still waiting for their first confirmation and cannot be spent yet.`}
          >
            {`+${formatBtc(reading.pendingSats)} pending`}
          </span>
        ) : null}
      </>
    );
  }
  if (state === "loading")
    return (
      <span aria-label="Loading balance" className="wallet-widget__balance">
        …
      </span>
    );
  if (state === "unavailable" || state === "failed")
    return (
      <span
        className="wallet-widget__balance"
        data-stale="true"
        title="The platform could not read this wallet's balance."
      >
        balance unavailable
      </span>
    );
  return null;
}
