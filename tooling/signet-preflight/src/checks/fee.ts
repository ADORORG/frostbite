import type { AlkanesNode } from "@ador/chain/bitcoin-alkanes";

import { messageOf, type CheckResult } from "../result.ts";
import type { FoundTemplate } from "./templates.ts";

export const feeName = "Publishing a template fits the fee ceiling";

// An estimate, not the platform's own build: the packed code travels in a witness (a quarter of a byte's weight, BIP 141), and the
// commit and reveal transactions each add a fixed size around it. The platform's builder prices the real transaction; this is only
// to see, before funding a wallet, the order of magnitude and whether the ceiling is clearly too low.
const witnessDiscount = 4;
const framingVbytes = 400;

export const estimateVbytes = (packedBytes: number): number =>
  Math.ceil(packedBytes / witnessDiscount) + framingVbytes;

export async function checkFee(
  node: Pick<AlkanesNode, "feeRate">,
  feeTargetBlocks: number,
  ceilingSats: bigint,
  found: readonly FoundTemplate[],
): Promise<CheckResult> {
  let rate: number;
  try {
    rate = await node.feeRate(feeTargetBlocks);
  } catch (error) {
    return { detail: messageOf(error), name: feeName, verdict: "unverified" };
  }
  if (found.length === 0) {
    return {
      detail: `The node quotes ${rate} sat/vB for ${feeTargetBlocks} blocks; the cost of publishing is not estimated because no template code was found.`,
      name: feeName,
      verdict: "unverified",
    };
  }
  const costs = found.map(({ crate, packedBytes }) => ({
    crate,
    sats: BigInt(Math.ceil(rate * estimateVbytes(packedBytes))),
  }));
  const over = costs.filter(({ sats }) => sats > ceilingSats);
  const list = costs
    .map(({ crate, sats }) => `${crate} about ${sats} sats`)
    .join(", ");
  const basis = `at ${rate} sat/vB for ${feeTargetBlocks} blocks (estimate)`;
  return over.length === 0
    ? {
        detail: `${list} ${basis}, within the ceiling of ${ceilingSats} sats.`,
        name: feeName,
        verdict: "pass",
      }
    : {
        detail: `${list} ${basis}; above the ceiling of ${ceilingSats} sats, so the platform would refuse to build ${over.map(({ crate }) => crate).join(" and ")}.`,
        name: feeName,
        verdict: "fail",
      };
}
