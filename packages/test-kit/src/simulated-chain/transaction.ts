import { z } from "zod";

import {
  chainFamilyIdSchema,
  type AssetRef,
  type ChainRef,
  type SignedTransaction,
  type TransactionIntent,
  type UnsignedTransaction,
  type VerificationResult,
} from "@ador/shared/chain";
import type { TransactionBuilder } from "@ador/chain/ports";

export const simulatedFamily = chainFamilyIdSchema.parse("simulated");
export const simulatedAdapterVersion = "1.0.0";
export const simulatedFormat = "sim-json/1";
export const simulatedFee = 1n;
const lifetimeMilliseconds = 10 * 60 * 1000;

// What the simulated payload carries. The wallet bridge and the adapter read it; nothing else does.
const bodySchema = z
  .object({
    amount: z.string().optional(),
    expiresAt: z.string(),
    fee: z.string(),
    nonce: z.number(),
    operation: z.string(),
    recipient: z.string().optional(),
  })
  .strict();

export function nativeAsset(chain: ChainRef): AssetRef {
  return { chain, id: "sim", kind: "native" };
}

// The simulated wallet: appends a marker the verifier checks. It stands in for a real signature.
export function signSimulated(
  unsigned: UnsignedTransaction,
): SignedTransaction {
  return {
    chain: unsigned.chain,
    family: unsigned.family,
    format: unsigned.format,
    payload: `${unsigned.payload}.sig`,
  };
}

function decode(payload: string): z.infer<typeof bodySchema> | undefined {
  try {
    return bodySchema.safeParse(JSON.parse(payload)).data;
  } catch {
    return undefined;
  }
}

function summaryMatches(unsigned: UnsignedTransaction): boolean {
  const body = decode(unsigned.payload);
  const { summary } = unsigned;
  return (
    body !== undefined &&
    body.operation === summary.operation &&
    body.recipient === summary.recipient?.value &&
    body.amount === summary.amount?.baseUnits.toString() &&
    body.fee === summary.fee.baseUnits.toString() &&
    body.expiresAt === summary.expiresAt
  );
}

export function createSimulatedBuilder(now: () => Date): TransactionBuilder {
  let nonce = 0;
  return {
    build: (intent: TransactionIntent, funding) => {
      if (funding.maxFee.baseUnits < simulatedFee) {
        return Promise.reject(
          new Error("The maximum fee is below the network fee."),
        );
      }
      const expiresAt = new Date(
        now().getTime() + lifetimeMilliseconds,
      ).toISOString();
      const fee = { asset: nativeAsset(intent.chain), baseUnits: simulatedFee };
      const transfer = intent.operation === "transfer" ? intent : undefined;
      nonce += 1;
      const payload = JSON.stringify({
        amount: transfer?.amount.baseUnits.toString(),
        expiresAt,
        fee: fee.baseUnits.toString(),
        nonce,
        operation: intent.operation,
        recipient: transfer?.recipient.value,
      });
      return Promise.resolve({
        chain: intent.chain,
        family: simulatedFamily,
        format: simulatedFormat,
        payload,
        summary: {
          amount: transfer?.amount,
          chain: intent.chain,
          expiresAt,
          fee,
          operation: intent.operation,
          recipient: transfer?.recipient,
        },
      });
    },
    verifySigned: (unsigned, signed): VerificationResult => {
      if (
        signed.chain !== unsigned.chain ||
        signed.family !== unsigned.family ||
        signed.format !== unsigned.format
      ) {
        return { ok: false, reason: "payload-mismatch" };
      }
      if (!signed.payload.endsWith(".sig"))
        return { ok: false, reason: "signature-invalid" };
      if (signed.payload.slice(0, -".sig".length) !== unsigned.payload) {
        return { ok: false, reason: "payload-mismatch" };
      }
      return summaryMatches(unsigned)
        ? { ok: true }
        : { ok: false, reason: "summary-mismatch" };
    },
  };
}
