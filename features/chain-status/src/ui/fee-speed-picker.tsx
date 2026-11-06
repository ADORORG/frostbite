"use client";

import { type FeeSpeed } from "@frostbite/shared/chain";
import { SegmentedChoice } from "@repo/ui/arcade";

import { staleNote } from "../domain/copy.ts";
import { feeSpeedQuestion, speedNames } from "../domain/fee-copy.ts";
import { feeChoices } from "../domain/fee-choices.ts";
import type { FeeMarket } from "./use-fee-quotes.ts";

// Where a person chooses how fast a transaction should confirm, for any step that pays a fee (a claim, a staff step): the four speeds
// as tiles, each with its rate and wait from the chain's own quotes, and says so plainly when there are none. With the size of the
// transaction it also tells what each would cost, and with a ceiling it refuses a speed that would pass it. A speed no step could
// afford is never offered. The choice is the speed, not the rate: the platform quotes the rate again when it builds the transaction.
export function FeeSpeedPicker({
  disabled = false,
  market,
  maxFeeSats,
  onChange,
  value,
  vbytes,
}: {
  readonly disabled?: boolean;
  // The fee market, from `useFeeQuotes`.
  readonly market: FeeMarket;
  // The most the platform will let this transaction pay, in satoshis; a speed above it cannot be chosen.
  readonly maxFeeSats?: number;
  readonly onChange: (speed: FeeSpeed) => void;
  readonly value: FeeSpeed;
  // About how large the transaction is, in virtual bytes, so a cost can be told.
  readonly vbytes?: number;
}) {
  if (market.status === "loading")
    return <p role="status">Loading what each speed costs…</p>;
  if (market.status === "unreachable")
    return (
      <p role="status">
        The platform could not be asked what a fee costs right now. The step is
        built at the platform&apos;s usual speed, and you see its fee before you
        sign.
      </p>
    );
  const { fees } = market;
  if (fees.state !== "ok")
    return (
      <p role="status">
        {fees.state === "none"
          ? "No chain is configured, so there are no fees to choose."
          : `${fees.chain} could not be asked what a fee costs right now. The step is built at the platform's usual speed, and you see its fee before you sign.`}
      </p>
    );
  const { notes, options } = feeChoices({
    maxFeeSats,
    platformMaxFeeSats: fees.maxFeeSats,
    quotes: fees.quotes,
    vbytes,
  });
  const chosen = options.find((option) => option.value === value);
  return (
    <div className="fee-picker">
      <SegmentedChoice
        disabled={disabled}
        legend={feeSpeedQuestion}
        onChange={onChange}
        options={options}
        value={value}
      />
      {chosen?.disabled === true ? (
        <p className="fee-picker__alert" role="alert">
          {`${speedNames[value]} cannot be sent now. Choose another speed.`}
        </p>
      ) : null}
      {notes.map((note) => (
        <small className="fee-picker__note" key={note}>
          {note}
        </small>
      ))}
      {market.stale ? (
        <small className="fee-picker__note" role="status">
          {staleNote(fees.observedAt)}
        </small>
      ) : null}
      <small className="fee-picker__note">
        Rates are the chain&apos;s quotes
        {fees.tipHeight === undefined
          ? ""
          : ` at block ${fees.tipHeight.toLocaleString("en-US")}`}{" "}
        and change with demand; waits are estimates, not promises.
      </small>
    </div>
  );
}
