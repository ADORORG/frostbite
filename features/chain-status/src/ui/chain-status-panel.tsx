"use client";

import { feeSpeeds } from "@ador/shared/chain";

import {
  costText,
  rateText,
  speedNames,
  usableSpreadText,
  waitText,
} from "../domain/fee-copy.ts";
import type { FeeMarket } from "./use-fee-quotes.ts";

const clock = (iso: string) => `${iso.slice(11, 19)} UTC`;

// The chain's block and what it costs to be confirmed, one click from the lamp in the header: the latest block, each speed with its
// rate and wait, and what a transaction of an example size would pay. Where the chain cannot be asked it says that, and draws no
// rate. Nothing is drawn where the platform follows no chain.
export function ChainStatusPanel({
  exampleVbytes,
  market,
}: {
  // The size of an everyday transaction (a claim), for the example cost.
  readonly exampleVbytes: number;
  readonly market: FeeMarket;
}) {
  if (market.status === "loading") return null;
  if (market.status === "unreachable")
    return (
      <details className="chain-status">
        <summary>Fees unknown</summary>
        <div
          className="chain-status__panel"
          role="group"
          aria-label="Chain and fees"
        >
          <p>
            The platform could not be asked about the chain&apos;s fees. Nothing
            you have sent is affected.
          </p>
        </div>
      </details>
    );
  const { fees } = market;
  if (fees.state === "none") return null;
  if (fees.state === "unavailable")
    return (
      <details className="chain-status">
        <summary>Fees unknown</summary>
        <div
          className="chain-status__panel"
          role="group"
          aria-label="Chain and fees"
        >
          <p>{`${fees.chain} could not be asked about its fees just now. Nothing you have sent is affected.`}</p>
        </div>
      </details>
    );
  return (
    <details className="chain-status">
      <summary>
        {`Block ${fees.tipHeight.toLocaleString("en-US")} · ${usableSpreadText(fees.quotes)}`}
      </summary>
      <div
        className="chain-status__panel"
        role="group"
        aria-label="Chain and fees"
      >
        <p className="chain-status__title">
          {`${fees.chain} · block ${fees.tipHeight.toLocaleString("en-US")}`}
          <small>{` read ${clock(fees.observedAt)}`}</small>
        </p>
        <table>
          <caption className="chain-status__caption">
            What it costs to be confirmed, by speed
          </caption>
          <thead>
            <tr>
              <th scope="col">Speed</th>
              <th scope="col">Wait</th>
              <th scope="col">Rate</th>
              <th scope="col">{`A ${exampleVbytes} vB transaction`}</th>
            </tr>
          </thead>
          <tbody>
            {feeSpeeds.map((speed) => {
              const quote = fees.quotes.find((q) => q.speed === speed);
              return quote === undefined ? null : (
                <tr
                  data-over={quote.withinLimit ? undefined : "true"}
                  key={speed}
                >
                  <th scope="row">{speedNames[speed]}</th>
                  <td>{waitText(quote.approxMinutes)}</td>
                  <td>{rateText(quote.satPerVb)}</td>
                  <td>
                    {costText(quote.satPerVb, exampleVbytes)}
                    {quote.withinLimit ? null : (
                      <small>{` · over the ${fees.maxFeeSats.toLocaleString("en-US")} sat limit`}</small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <small>
          Rates are the chain&apos;s own quotes and move with demand. Waits are
          estimates. You see the exact fee before you sign.
        </small>
      </div>
    </details>
  );
}
