import type { ChoiceOption } from "@repo/ui/arcade";
import type { FeeQuoteView, FeeSpeed } from "@ador/shared/chain";

import {
  costText,
  overLimitText,
  rateText,
  speedNames,
  waitText,
} from "./fee-copy.ts";

export interface FeeChoices {
  // What to say once, under the tiles, about the tiles that are off.
  readonly notes: readonly string[];
  readonly options: readonly ChoiceOption<FeeSpeed>[];
}

// The fee speeds as tiles, for the one place a speed is chosen and the one place the market is read: each with its rate, its wait and,
// when a size is known, what that size would pay. A speed is off where no step could afford it (the server says so), or where this
// step's size would pass the ceiling it was given; why is said once under the tiles, not in each.
export function feeChoices({
  maxFeeSats,
  platformMaxFeeSats,
  quotes,
  vbytes,
}: {
  // The most this step may pay, where the page knows its size.
  readonly maxFeeSats?: number | undefined;
  // The most any step may pay, as the platform says it.
  readonly platformMaxFeeSats: number;
  readonly quotes: readonly FeeQuoteView[];
  readonly vbytes?: number | undefined;
}): FeeChoices {
  let unaffordable = false;
  let tooLarge = false;
  const options = quotes.map((quote): ChoiceOption<FeeSpeed> => {
    const cost = vbytes === undefined ? null : costText(quote.satPerVb, vbytes);
    const pricedOut = !quote.withinLimit;
    const over =
      !pricedOut &&
      cost !== null &&
      maxFeeSats !== undefined &&
      Math.ceil(quote.satPerVb * (vbytes ?? 0)) > maxFeeSats;
    unaffordable ||= pricedOut;
    tooLarge ||= over;
    return {
      detail:
        cost === null
          ? waitText(quote.approxMinutes)
          : `${waitText(quote.approxMinutes)}\n≈ ${cost}`,
      disabled: pricedOut || over,
      ...(pricedOut || over ? { hint: "Over the limit" } : {}),
      label: speedNames[quote.speed],
      meta: rateText(quote.satPerVb),
      value: quote.speed,
    };
  });
  return {
    notes: [
      ...(unaffordable ? [overLimitText(platformMaxFeeSats)] : []),
      ...(tooLarge
        ? [
            `More than the ${maxFeeSats?.toLocaleString("en-US")} sats this step may pay, so it cannot be chosen.`,
          ]
        : []),
    ],
    options,
  };
}
