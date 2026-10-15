import type { HttpOperation } from "@ador/http";

import {
  maxSatoshis,
  walletBalanceRequestSchema,
  walletBalanceResponseSchema,
  walletBalanceRoute,
  type WalletBalanceRequest,
  type WalletBalanceResponse,
} from "../balance/contract.ts";
import type { BalanceSource } from "../balance/source.ts";

// A wallet's balance for the widget. Only an address the source accepts for the network it names is looked up. With no
// source configured, or a source that fails or answers something no balance can be, the answer says there is none: it
// never invents a number.
export function createBalanceOperation(dependencies: {
  readonly clock: () => Date;
  readonly source: BalanceSource | null;
}) {
  const { clock, source } = dependencies;
  const operation: HttpOperation<WalletBalanceRequest, WalletBalanceResponse> =
    {
      access: { kind: "public" },
      applicationErrors: ["invalid_request"],
      execute: async (input) => {
        if (source === null)
          return {
            ok: true,
            value: { reason: "not-configured", status: "unavailable" },
          };
        if (!source.accepts(input.address, input.network))
          return {
            error: "invalid_request",
            message: "That is not a supported address for that network.",
            ok: false,
          };
        try {
          const satoshis = await source.satoshis(input.address, input.network);
          if (
            !Number.isSafeInteger(satoshis) ||
            satoshis < 0 ||
            satoshis > maxSatoshis
          )
            throw new RangeError("The source answered an impossible balance.");
          return {
            ok: true,
            value: {
              asOf: clock().toISOString(),
              satoshis,
              status: "ready",
            },
          };
        } catch {
          return {
            ok: true,
            value: { reason: "source-failed", status: "unavailable" },
          };
        }
      },
      idempotency: "none",
      input: "json",
      inputSchema: walletBalanceRequestSchema,
      outputSchema: walletBalanceResponseSchema,
      ...walletBalanceRoute,
    };
  return operation;
}
