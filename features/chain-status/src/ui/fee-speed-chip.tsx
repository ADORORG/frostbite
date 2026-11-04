"use client";

import { type FeeSpeed } from "@ador/shared/chain";
import { Popover } from "@repo/ui/arcade";

import {
  feeSpeedQuestion,
  rateText,
  speedNames,
  waitText,
} from "../domain/fee-copy.ts";
import { FeeSpeedPicker } from "./fee-speed-picker.tsx";
import type { FeeMarket } from "./use-fee-quotes.ts";

// How fast a transaction should confirm, as one small control: the speed chosen with its rate and wait, which opens the speed
// tiles under it. For a step's page, where the choice is made once and then left, so it takes a line and not a block of the page.
export function FeeSpeedChip({
  market,
  maxFeeSats,
  onChange,
  value,
  vbytes,
}: {
  readonly market: FeeMarket;
  readonly maxFeeSats?: number;
  readonly onChange: (speed: FeeSpeed) => void;
  readonly value: FeeSpeed;
  readonly vbytes?: number;
}) {
  const quote =
    market.status === "answered" && market.fees.state === "ok"
      ? market.fees.quotes.find((candidate) => candidate.speed === value)
      : undefined;
  return (
    <Popover
      align="start"
      label={feeSpeedQuestion}
      panelClassName="popover__panel--wide"
      trigger={
        <>
          <span className="fee-chip__label">Fee</span>
          <strong>{speedNames[value]}</strong>
          {quote === undefined ? null : (
            <>
              <span className="fee-chip__rate">{rateText(quote.satPerVb)}</span>
              <span className="fee-chip__wait">
                {waitText(quote.approxMinutes)}
              </span>
            </>
          )}
        </>
      }
      triggerClassName="popover__trigger fee-chip"
      triggerData={{
        "data-off": quote?.withinLimit === false ? "true" : undefined,
      }}
      triggerLabel={`Fee speed: ${speedNames[value]}${quote === undefined ? "" : `, ${rateText(quote.satPerVb)}, ${waitText(quote.approxMinutes)}`}${quote?.withinLimit === false ? ", cannot be sent now" : ""}`}
    >
      {({ close }) => (
        <FeeSpeedPicker
          market={market}
          {...(maxFeeSats === undefined ? {} : { maxFeeSats })}
          onChange={(speed) => {
            onChange(speed);
            close();
          }}
          value={value}
          {...(vbytes === undefined ? {} : { vbytes })}
        />
      )}
    </Popover>
  );
}
