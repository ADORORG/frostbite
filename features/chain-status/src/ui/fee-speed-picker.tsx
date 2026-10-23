"use client";

import {
  feeSpeeds,
  type FeeQuoteView,
  type FeeSpeed,
} from "@ador/shared/chain";
import { useId } from "react";

import {
  costText,
  overLimitText,
  rateText,
  speedHints,
  speedNames,
  waitText,
} from "../domain/fee-copy.ts";
import type { FeeMarket } from "./use-fee-quotes.ts";

// Where a person chooses how fast a transaction should confirm, for any step that pays a fee (a claim, a staff step). It shows what
// each speed costs and how long it is about to take, from the chain's own quotes, and says so plainly when there are none. With the
// size of the transaction it also says what the speed would cost in satoshis, and with a ceiling it refuses a speed that would pass
// it. The choice is the speed, not the rate: the platform quotes the rate again when it builds the transaction.
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
  const group = useId();
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
  const byspeed = new Map<FeeSpeed, FeeQuoteView>(
    fees.quotes.map((quote) => [quote.speed, quote]),
  );
  return (
    <fieldset className="fee-picker" disabled={disabled}>
      <legend>How fast should it confirm?</legend>
      {feeSpeeds.map((speed) => {
        const quote = byspeed.get(speed);
        if (quote === undefined) return null;
        const cost =
          vbytes === undefined
            ? null
            : { sats: Math.ceil(quote.satPerVb * vbytes) };
        const unaffordable = !quote.withinLimit;
        const over =
          unaffordable ||
          (cost !== null && maxFeeSats !== undefined && cost.sats > maxFeeSats);
        return (
          <label
            className="fee-picker__option"
            data-over={over ? "true" : undefined}
            key={speed}
          >
            <input
              checked={value === speed}
              disabled={over}
              name={group}
              onChange={() => {
                // A speed that cannot be chosen is switched off, and refused here too.
                if (!over) onChange(speed);
              }}
              type="radio"
              value={speed}
            />
            <span className="fee-picker__name">{speedNames[speed]}</span>
            <span className="fee-picker__wait">
              {waitText(quote.approxMinutes)}
            </span>
            <span className="fee-picker__rate">{rateText(quote.satPerVb)}</span>
            {vbytes === undefined ? null : (
              <span className="fee-picker__cost">
                {`≈ ${costText(quote.satPerVb, vbytes)}`}
              </span>
            )}
            <small className="fee-picker__hint">
              {unaffordable
                ? overLimitText(fees.maxFeeSats)
                : over
                  ? `More than the ${maxFeeSats?.toLocaleString("en-US")} sats this step may pay, so it cannot be chosen.`
                  : speedHints[speed]}
            </small>
          </label>
        );
      })}
      {byspeed.get(value)?.withinLimit === false ? (
        <p className="fee-picker__alert" role="alert">
          {`${speedNames[value]} cannot be sent now. Choose another speed.`}
        </p>
      ) : null}
      <small className="fee-picker__note">
        Rates are the chain&apos;s quotes at block{" "}
        {fees.tipHeight.toLocaleString("en-US")} and change with demand; waits
        are estimates, not promises.
      </small>
    </fieldset>
  );
}
