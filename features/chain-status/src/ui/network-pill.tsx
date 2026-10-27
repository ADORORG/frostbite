"use client";

import {
  ArcadeProgress,
  ChoiceTiles,
  Popover,
  StatusDot,
} from "@repo/ui/arcade";
import type { ChainIndexing } from "@ador/shared/chain";

import { lampFor, shortChain, unreachableLamp } from "../domain/copy.ts";
import { feeChoices } from "../domain/fee-choices.ts";
import { syncProgress } from "../domain/sync.ts";
import type { FeeMarket } from "./use-fee-quotes.ts";

const clock = (iso: string) => `${iso.slice(11, 19)} UTC`;

// The chain in the header, as one small control: a light for how the chain is doing, its name and its latest block. Opened, it says
// how far the platform's reading of the chain has come and what a transaction costs at each speed. Nothing is drawn where the
// platform follows no chain, and no figure is drawn that was not read: an unknown is said as unknown.
export function NetworkPill({
  indexing,
  market,
  syncWindowBlocks,
}: {
  // `null` is the platform not being reachable.
  readonly indexing: ChainIndexing | null;
  readonly market: FeeMarket;
  // How many blocks the sync bar spans (see `syncProgress`).
  readonly syncWindowBlocks: number;
}) {
  if (indexing?.state === "none") return null;
  const lamp = indexing === null ? unreachableLamp : lampFor(indexing);
  const fees =
    market.status === "answered" && market.fees.state === "ok"
      ? market.fees
      : null;
  const reading = indexing?.state === "ok" ? indexing : null;
  const chain =
    reading?.chain ??
    (indexing?.state === "unavailable" ? indexing.chain : undefined) ??
    fees?.chain ??
    null;
  const tip =
    reading?.tipHeight ??
    (indexing?.state === "unavailable" ? indexing.tipHeight : undefined) ??
    fees?.tipHeight ??
    null;
  const name = chain === null ? "Chain" : shortChain(chain);
  const choices =
    fees === null
      ? null
      : feeChoices({
          platformMaxFeeSats: fees.maxFeeSats,
          quotes: fees.quotes,
        });
  return (
    <Popover
      label="Chain and fees"
      panelClassName="popover__panel--wide"
      trigger={
        <>
          <StatusDot tone={lamp.tone} />
          <span className="network-pill__chain">{name}</span>
          {tip === null ? null : (
            <span className="network-pill__block">{`#${tip.toLocaleString("en-US")}`}</span>
          )}
        </>
      }
      triggerClassName="popover__trigger network-pill"
      triggerLabel={`${name}${tip === null ? "" : `, block ${tip.toLocaleString("en-US")}`}: ${lamp.label}`}
    >
      <div className="network-panel__head">
        <strong>{chain ?? "The chain"}</strong>
        <span className="network-panel__state">
          <StatusDot tone={lamp.tone} />
          {lamp.label}
        </span>
      </div>
      <p className="network-panel__detail">{lamp.detail}</p>
      {reading === null ? null : (
        <div className="network-panel__sync">
          <ArcadeProgress
            label="How far the platform has read the chain"
            value={syncProgress(reading, syncWindowBlocks)}
          />
        </div>
      )}
      <section aria-label="Fees" className="network-panel__fees">
        <h3 className="network-panel__heading">What each speed costs</h3>
        {market.status === "loading" ? (
          <p role="status">Loading what each speed costs…</p>
        ) : fees === null || choices === null ? (
          <p>Fees unknown right now. Nothing you have sent is affected.</p>
        ) : (
          <>
            <ChoiceTiles label="Fee speeds" options={choices.options} />
            {choices.notes.map((note) => (
              <small key={note}>{note}</small>
            ))}
            <small>
              {`Read ${clock(fees.observedAt)}. Rates are the chain's own quotes and move with demand; waits are estimates. You see the exact fee before you sign.`}
            </small>
          </>
        )}
      </section>
    </Popover>
  );
}
