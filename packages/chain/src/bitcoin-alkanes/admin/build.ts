import type {
  ChainRef,
  TransactionSummary,
  UnsignedTransaction,
} from "@frostbite/shared/chain";

import { validateBitcoinAddress } from "../../bitcoin/address.ts";
import { BuildRefusedError } from "../build-refused.ts";
import { nativeAsset, servedChain, type ServedChain } from "../chains.ts";
import { psbtFormat } from "../format.ts";
import { psbtToBase64 } from "../psbt-text.ts";
import { parseAlkaneId } from "../node/alkane-id.ts";
import { feeDetailFor, type TransactionOptions } from "../options.ts";
import { adminCall, type AdminIntent } from "./action.ts";
import { bundleFormat, encodeBundle } from "./bundle.ts";
import { configuredTemplate, sha256Hex, stepData } from "./data.ts";
import { planEnvelopeStep } from "./envelope-step.ts";
import { stepFunding } from "./funding.ts";
import { newOneTimeKey } from "./one-time-key.ts";
import { planPlainStep } from "./plain-step.ts";
import { StepRefusedError } from "./types.ts";
import type { AdminOptions } from "./templates.ts";

export interface AdminContext {
  readonly admin: AdminOptions;
  readonly chains: ReadonlyMap<ChainRef, ServedChain>;
  readonly family: UnsignedTransaction["family"];
  readonly options: TransactionOptions;
}

// What a person is shown for a step, besides its fee and expiry: each operation fills the fields it has.
function summaryOf(
  intent: AdminIntent,
  data: Uint8Array | null,
  context: AdminContext,
): Partial<TransactionSummary> {
  switch (intent.operation) {
    case "define-milestone":
      return {
        claimLimit: intent.claimLimit,
        contract: intent.contract,
        milestone: { contract: intent.contract, id: intent.milestoneId },
        ...(data === null
          ? {}
          : { drawing: { bytes: data.length, sha256: sha256Hex(data) } }),
      };
    case "set-claims-paused":
      return { contract: intent.contract, paused: intent.paused };
    case "publish-template":
    case "deploy": {
      const entry = configuredTemplate(intent, context.admin);
      return entry === undefined
        ? {}
        : {
            ...(intent.operation === "deploy"
              ? {
                  collectibleAt: intent.collectibleAt,
                  maxDrawingBytes: intent.maxDrawingBytes,
                }
              : {}),
            template: {
              at: intent.templateAt,
              codeHash: entry.codeHash,
              id: intent.templateId,
              version: intent.templateVersion,
            },
          };
    }
  }
}

// Builds the transaction (or the pair of them) for one administration step. Nothing is signed except the reveal's own input, with a
// key made for this step and destroyed before this returns; the staff's wallet signs the rest after reading the summary.
export async function buildAdmin(
  intent: AdminIntent,
  context: AdminContext,
  funding: { readonly maxFee: { readonly baseUnits: bigint } },
): Promise<UnsignedTransaction> {
  const { network } = servedChain(context.chains, intent.chain);
  const sender = validateBitcoinAddress(intent.sender.value, network);
  const call = adminCall(intent, context.admin);
  if (!sender.ok || call === null) {
    throw new BuildRefusedError(
      "invalid-request",
      "The request does not name a valid sender, contract or template for this chain.",
    );
  }
  const drawing =
    intent.operation === "define-milestone" ? intent.drawing : undefined;
  let data: Uint8Array | null;
  try {
    data = await stepData(intent, drawing, context.admin);
  } catch (error) {
    if (error instanceof StepRefusedError) {
      throw new BuildRefusedError(error.reason, error.message);
    }
    throw error;
  }
  if (
    data !== null &&
    intent.operation === "define-milestone" &&
    BigInt(data.length) > context.admin.maxDrawingBytes
  ) {
    throw new BuildRefusedError(
      "invalid-request",
      "The drawing is larger than the game's contract accepts.",
    );
  }
  try {
    const stepFunds = await stepFundingFor(intent, context, sender.value);
    let fee: bigint;
    let payload: string;
    let format: string;
    if (data === null) {
      const step = planPlainStep(call, stepFunds);
      fee = step.fee;
      payload = psbtToBase64(step.transaction);
      format = psbtFormat;
    } else {
      const step = planEnvelopeStep(
        call,
        data,
        stepFunds,
        newOneTimeKey(context.admin.random),
      );
      fee = step.commitFee + step.revealFee;
      payload = encodeBundle(step);
      format = bundleFormat;
    }
    if (fee > funding.maxFee.baseUnits) {
      throw new BuildRefusedError(
        "fee-above-limit",
        `The fee would be ${fee} sats, above the ${funding.maxFee.baseUnits} the platform allows for one step. Choose a slower speed.`,
      );
    }
    return {
      chain: intent.chain,
      family: context.family,
      format,
      payload,
      summary: {
        ...summaryOf(intent, data, context),
        chain: intent.chain,
        expiresAt: new Date(
          context.options.now().getTime() + context.options.lifetimeMs,
        ).toISOString(),
        fee: { asset: nativeAsset(intent.chain), baseUnits: fee },
        feeDetail: feeDetailFor(
          context.options,
          intent.feeSpeed,
          stepFunds.feeRate,
        ),
        operation: intent.operation,
      },
    };
  } catch (error) {
    if (error instanceof StepRefusedError) {
      throw new BuildRefusedError(error.reason, error.message);
    }
    throw error;
  }
}

function stepFundingFor(
  intent: AdminIntent,
  context: AdminContext,
  sender: Parameters<typeof stepFunding>[4],
) {
  const { node } = servedChain(context.chains, intent.chain);
  const game = "contract" in intent ? parseAlkaneId(intent.contract.id) : null;
  return stepFunding(
    node,
    intent,
    intent.operation,
    game,
    sender,
    context.options,
  );
}
