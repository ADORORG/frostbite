"use client";

import {
  FeeSpeedPicker,
  useFeeQuotes,
} from "@ador/feature-chain-status/fee-picker";
import type { ChainStatusApi } from "@ador/feature-chain-status/api";
import type { FeeSpeed } from "@ador/shared/chain";

import type { ClaimFeeSettings } from "../wallet-config.ts";

// How fast the player wants their claims confirmed, beside the milestones they claim: each speed with what it costs on the chain now
// and, for a claim of about the usual size, in satoshis. The review the player signs from shows the exact fee. The choice covers every
// claim started after it, whether from the button or by the game asking.
export function ClaimFees({
  api,
  onChange,
  settings,
  value,
}: {
  readonly api?: ChainStatusApi;
  readonly onChange: (speed: FeeSpeed) => void;
  readonly settings: ClaimFeeSettings;
  readonly value: FeeSpeed;
}) {
  const market = useFeeQuotes({
    ...(api === undefined ? {} : { api }),
    refreshMs: settings.refreshMs,
  });
  return (
    <FeeSpeedPicker
      market={market}
      onChange={onChange}
      value={value}
      vbytes={settings.exampleVbytes}
    />
  );
}

// The picker where claims are offered and the settings say so; nothing otherwise.
export function ClaimFeesBeside({
  fees,
  ui,
}: {
  readonly fees: ClaimFeeSettings | undefined;
  readonly ui: {
    readonly feeSpeed: FeeSpeed | null;
    readonly setFeeSpeed: (speed: FeeSpeed) => void;
  };
}) {
  if (fees === undefined || ui.feeSpeed === null) return null;
  return (
    <ClaimFees
      {...(fees.api === undefined ? {} : { api: fees.api })}
      onChange={ui.setFeeSpeed}
      settings={fees}
      value={ui.feeSpeed}
    />
  );
}
