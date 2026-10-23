import type { FeeQuoteView, FeeSpeed } from "@ador/shared/chain";
import { feeAtRate } from "@ador/shared/chain";

// How the fee speeds are named and told, in the platform's words. Waits are estimates and are always said as "about"; a rate is the
// chain's quote at the moment shown, which moves.
export const speedNames: Readonly<Record<FeeSpeed, string>> = {
  fast: "Fast",
  lightning: "Lightning",
  medium: "Medium",
  slow: "Slow",
};

export const speedHints: Readonly<Record<FeeSpeed, string>> = {
  fast: "Likely within the next few blocks.",
  lightning: "Aims for the very next block. Costs the most.",
  medium: "Likely within about an hour.",
  slow: "Cheapest. Can take hours, and longer when the chain is busy.",
};

// "about 15 min", "about 4 h": the wait as a person reads it.
export function waitText(minutes: number): string {
  if (minutes < 60) return `about ${Math.round(minutes)} min`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `about ${hours} h`;
}

// "1.01 sat/vB", "588,235 sat/vB": two decimals below ten, whole numbers above, so a small rate is not rounded to nothing.
export function rateText(satPerVb: number): string {
  const figure =
    satPerVb < 10
      ? satPerVb.toFixed(2)
      : Math.round(satPerVb).toLocaleString("en-US");
  return `${figure} sat/vB`;
}

// "200 vB costs about 202 sats": what a transaction of a given size would pay at a rate.
export const costText = (satPerVb: number, vbytes: number): string =>
  `${feeAtRate(satPerVb, vbytes).toLocaleString("en-US")} sats`;

// "1.01 to 9 sat/vB": the spread across the speeds, for the header's summary.
export function spreadText(quotes: readonly FeeQuoteView[]): string {
  const rates = quotes.map(({ satPerVb }) => satPerVb);
  const low = Math.min(...rates);
  const high = Math.max(...rates);
  return low === high
    ? rateText(low)
    : `${rateText(low).replace(" sat/vB", "")} to ${rateText(high)}`;
}
