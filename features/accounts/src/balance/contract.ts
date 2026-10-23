import { walletNetworkSchema } from "@ador/shared/chain";
import { z } from "zod";

// The one route that tells the widget a wallet's balance. It is a POST because the platform's operations take their
// input in a JSON body; it only reads. Anyone may ask (an address is public and a visitor with a connected wallet
// has no session), so it is rate limited by caller like the other public routes.
export const walletBalanceRoute = {
  method: "POST",
  operationId: "getWalletBalance",
  path: "/api/v1/wallet/balance",
} as const;

// Bitcoin has 21 million coins of 100 million satoshis each (consensus rule); no real balance is larger, so a
// source that says so is wrong and its answer is refused rather than shown.
export const maxSatoshis = 21_000_000 * 100_000_000;

export const walletBalanceRequestSchema = z.strictObject({
  address: z.string().regex(/^[A-Za-z0-9]{14,90}$/u),
  network: walletNetworkSchema,
});

// Told honestly in two states: a number the platform got from its data source, or why there is none. Never a zero
// standing in for "unknown".
export const walletBalanceResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    asOf: z.iso.datetime(),
    // Waiting for its first confirmation: counted apart, because a step does not spend it and it could still be replaced.
    pendingSats: z.int().min(0).max(maxSatoshis),
    // Confirmed, so spendable.
    satoshis: z.int().min(0).max(maxSatoshis),
    status: z.literal("ready"),
  }),
  z.strictObject({
    reason: z.enum(["not-configured", "source-failed"]),
    status: z.literal("unavailable"),
  }),
]);

export type WalletBalanceRequest = z.infer<typeof walletBalanceRequestSchema>;
export type WalletBalanceResponse = z.infer<typeof walletBalanceResponseSchema>;
