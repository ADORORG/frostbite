import type { ChainFees, FeeQuoteView } from "@ador/shared/chain";

import type { FeeMarket } from "../../src/ui/use-fee-quotes.ts";

export const rates: Omit<FeeQuoteView, "withinLimit">[] = [
  { approxMinutes: 250, satPerVb: 1.009, speed: "slow", targetBlocks: 25 },
  { approxMinutes: 60, satPerVb: 3, speed: "medium", targetBlocks: 6 },
  { approxMinutes: 30, satPerVb: 5, speed: "fast", targetBlocks: 3 },
  { approxMinutes: 15, satPerVb: 9, speed: "lightning", targetBlocks: 1 },
];
export const ok: Extract<ChainFees, { state: "ok" }> = {
  chain: "Bitcoin testnet4",
  maxFeeSats: 500_000,
  observedAt: "2026-10-23T12:00:00.000Z",
  quotes: rates.map((quote) => ({ ...quote, withinLimit: true })),
  state: "ok",
  tipHeight: 157_401,
};
export const answered = (fees: ChainFees, stale = false): FeeMarket => ({
  fees,
  stale,
  status: "answered",
});
// The market testnet4 had on 2026-10-23: every target under 13 blocks quoted at 588,235 sat/vB, which no step can pay.
export const distorted: Extract<ChainFees, { state: "ok" }> = {
  ...ok,
  quotes: ok.quotes.map((quote) =>
    quote.speed === "slow"
      ? quote
      : { ...quote, satPerVb: 588_235.294, withinLimit: false },
  ),
};
