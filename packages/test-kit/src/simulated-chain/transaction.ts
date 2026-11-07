import { createHash } from "node:crypto";

import { z } from "zod";

import {
  chainFamilyIdSchema,
  type AssetRef,
  type ChainRef,
  type SignedTransaction,
  type TransactionIntent,
  type UnsignedTransaction,
  type VerificationResult,
} from "@frostbite/shared/chain";
import type { TransactionBuilder } from "@frostbite/chain/ports";

export const simulatedFamily = chainFamilyIdSchema.parse("simulated");
export const simulatedAdapterVersion = "1.0.0";
export const simulatedFormat = "sim-json/1";
export const simulatedFee = 1n;
const lifetimeMilliseconds = 10 * 60 * 1000;

// What the simulated payload carries. The wallet bridge and the adapter read it; nothing else does.
const bodySchema = z
  .object({
    amount: z.string().optional(),
    claimLimit: z.number().optional(),
    collectibleAt: z.string().optional(),
    contract: z.string().optional(),
    drawingBytes: z.number().optional(),
    drawingSha: z.string().optional(),
    expiresAt: z.string(),
    fee: z.string(),
    maxDrawingBytes: z.number().optional(),
    milestoneId: z.string().optional(),
    nonce: z.number(),
    operation: z.string(),
    paused: z.boolean().optional(),
    platformFeeAmount: z.string().optional(),
    platformFeeTo: z.string().optional(),
    recipient: z.string().optional(),
    sender: z.string(),
    templateAt: z.string().optional(),
    templateId: z.string().optional(),
    templateVersion: z.string().optional(),
  })
  .strict();
export type SimulatedBody = z.infer<typeof bodySchema>;

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
    payload: `${unsigned.payload}${signatureMarker}`,
  };
}

const signatureMarker = ".sig";

// The payload as the simulated network reads it, or undefined for text that is not one. A signed payload is the built one
// followed by the wallet's marker, which the network does not read.
export function decodeSimulated(payload: string): SimulatedBody | undefined {
  try {
    const body = payload.endsWith(signatureMarker)
      ? payload.slice(0, -signatureMarker.length)
      : payload;
    return bodySchema.safeParse(JSON.parse(body)).data;
  } catch {
    return undefined;
  }
}

// The fields of the body that describe what a transaction does, derived from the summary a person was shown.
function detailsOfSummary(summary: UnsignedTransaction["summary"]) {
  return {
    amount: summary.amount?.baseUnits.toString(),
    claimLimit: summary.claimLimit,
    collectibleAt: summary.collectibleAt?.id,
    contract: summary.milestone?.contract.id ?? summary.contract?.id,
    drawingBytes: summary.drawing?.bytes,
    drawingSha: summary.drawing?.sha256,
    maxDrawingBytes: summary.maxDrawingBytes,
    milestoneId: summary.milestone?.id,
    paused: summary.paused,
    platformFeeAmount: summary.platformFee?.amount.baseUnits.toString(),
    platformFeeTo: summary.platformFee?.recipient.value,
    recipient: summary.recipient?.value,
    templateAt: summary.template?.at?.id,
    templateId: summary.template?.id,
    templateVersion: summary.template?.version,
  };
}

function summaryMatches(unsigned: UnsignedTransaction): boolean {
  const body = decodeSimulated(unsigned.payload);
  const { summary } = unsigned;
  if (
    body === undefined ||
    body.operation !== summary.operation ||
    body.fee !== summary.fee.baseUnits.toString() ||
    body.expiresAt !== summary.expiresAt
  ) {
    return false;
  }
  const expected = detailsOfSummary(summary);
  return (Object.keys(expected) as (keyof typeof expected)[]).every(
    (key) => body[key] === expected[key],
  );
}

// The simulated family has no code, so a template's "hash" is the hash of its name and version.
function templateHash(id: string, version: string): string {
  return createHash("sha256").update(`${id}@${version}`).digest("hex");
}

type Described = Pick<SimulatedBody, "contract" | "milestoneId"> &
  Partial<SimulatedBody> & { summary: Partial<UnsignedTransaction["summary"]> };

// What each operation puts in the payload and in the summary a person reads.
function describe(intent: TransactionIntent): Described {
  switch (intent.operation) {
    case "transfer":
      return {
        amount: intent.amount.baseUnits.toString(),
        contract: undefined,
        milestoneId: undefined,
        recipient: intent.recipient.value,
        summary: { amount: intent.amount, recipient: intent.recipient },
      };
    case "mint-milestone":
      return {
        contract: intent.contract.id,
        milestoneId: intent.milestoneId,
        platformFeeAmount: intent.platformFee?.baseUnits.toString(),
        platformFeeTo: intent.platformFee?.recipient.value,
        // A claim is received by the one who makes it.
        recipient: intent.sender.value,
        summary: {
          milestone: { contract: intent.contract, id: intent.milestoneId },
          platformFee:
            intent.platformFee === undefined
              ? undefined
              : {
                  amount: {
                    asset: nativeAsset(intent.chain),
                    baseUnits: intent.platformFee.baseUnits,
                  },
                  recipient: intent.platformFee.recipient,
                },
          recipient: intent.sender,
        },
      };
    case "define-milestone": {
      const drawing =
        intent.drawing === undefined
          ? undefined
          : {
              bytes: new TextEncoder().encode(intent.drawing).length,
              sha256: createHash("sha256").update(intent.drawing).digest("hex"),
            };
      return {
        claimLimit: intent.claimLimit,
        contract: intent.contract.id,
        drawingBytes: drawing?.bytes,
        drawingSha: drawing?.sha256,
        milestoneId: intent.milestoneId,
        summary: {
          claimLimit: intent.claimLimit,
          contract: intent.contract,
          drawing,
          milestone: { contract: intent.contract, id: intent.milestoneId },
        },
      };
    }
    case "set-claims-paused":
      return {
        contract: intent.contract.id,
        milestoneId: undefined,
        paused: intent.paused,
        summary: { contract: intent.contract, paused: intent.paused },
      };
    case "publish-template":
    case "deploy": {
      const deployed =
        intent.operation === "deploy"
          ? {
              collectibleAt: intent.collectibleAt,
              maxDrawingBytes: intent.maxDrawingBytes,
            }
          : {};
      return {
        collectibleAt: deployed.collectibleAt?.id,
        contract: undefined,
        maxDrawingBytes: deployed.maxDrawingBytes,
        milestoneId: undefined,
        summary: {
          ...deployed,
          template: {
            at: intent.templateAt,
            codeHash: templateHash(intent.templateId, intent.templateVersion),
            id: intent.templateId,
            version: intent.templateVersion,
          },
        },
        templateAt: intent.templateAt?.id,
        templateId: intent.templateId,
        templateVersion: intent.templateVersion,
      };
    }
    case "mint":
      return { contract: undefined, milestoneId: undefined, summary: {} };
  }
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
      const { summary, ...details } = describe(intent);
      nonce += 1;
      const payload = JSON.stringify({
        ...details,
        expiresAt,
        fee: fee.baseUnits.toString(),
        nonce,
        operation: intent.operation,
        sender: intent.sender.value,
      });
      return Promise.resolve({
        chain: intent.chain,
        family: simulatedFamily,
        format: simulatedFormat,
        payload,
        summary: {
          ...summary,
          chain: intent.chain,
          expiresAt,
          fee,
          operation: intent.operation,
        },
      });
    },
    // The simulated network follows one id per payload (see `Ledger.transactionRef`); the signed payload is what it hashes.
    transactionIds: (signed) => [
      {
        id: createHash("sha256")
          .update(signed.payload)
          .digest("hex")
          .slice(0, 32),
        role: "transaction",
      },
    ],
    verifySigned: (unsigned, signed): VerificationResult => {
      if (
        signed.chain !== unsigned.chain ||
        signed.family !== unsigned.family ||
        signed.format !== unsigned.format
      ) {
        return { ok: false, reason: "payload-mismatch" };
      }
      if (!signed.payload.endsWith(signatureMarker))
        return { ok: false, reason: "signature-invalid" };
      if (
        signed.payload.slice(0, -signatureMarker.length) !== unsigned.payload
      ) {
        return { ok: false, reason: "payload-mismatch" };
      }
      return summaryMatches(unsigned)
        ? { ok: true }
        : { ok: false, reason: "summary-mismatch" };
    },
  };
}
