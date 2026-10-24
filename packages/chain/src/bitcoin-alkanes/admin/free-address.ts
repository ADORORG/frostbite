import { formatAlkaneId } from "../node/alkane-id.ts";
import type { AlkanesNode } from "../node/node.ts";
import { templateCodeBlock } from "./action.ts";

// Where templates are looked for. Each attempt draws a number at random from a range that starts at `first`; the first attempt's range is
// `window` wide and each later attempt's is twice as wide as the one before, so a crowded neighbourhood is left behind quickly and the
// whole search stays short. Random, because a sequence anyone can predict is one anyone can occupy ahead of a publish.
export interface TemplateSequence {
  // How many addresses to try before giving up.
  readonly attempts: number;
  // The lowest number in the code block ever tried.
  readonly first: bigint;
  // The width of the first attempt's range.
  readonly window: bigint;
}

// The numbers the highest attempt of a sequence can reach, as one past the largest: the contract's id parts are 128-bit.
export const alkaneIdLimit = 1n << 128n;

export function sequenceReach(sequence: TemplateSequence): bigint {
  return (
    sequence.first +
    sequence.window * 2n ** BigInt(Math.max(sequence.attempts - 1, 0))
  );
}

// A whole number from 0 up to but not including `bound`, every one as likely as any other (draws that would favour small numbers are
// thrown away and redrawn). Needs at least one number to choose from.
export function randomBelow(
  random: (length: number) => Uint8Array,
  bound: bigint,
): bigint {
  if (bound < 1n) throw new Error("There must be a number to choose from.");
  const length = Math.ceil(bound.toString(2).length / 8);
  const space = 256n ** BigInt(length);
  const usable = space - (space % bound);
  for (let round = 0; round < 64; round += 1) {
    let value = 0n;
    for (const byte of random(length)) value = (value << 8n) | BigInt(byte);
    if (value < usable) return value % bound;
  }
  throw new Error("The random source did not give a usable number.");
}

// An address in the code block, drawn from the widening ranges of `sequence`, that no code is deployed at and that `taken` does not name.
// The node is asked in turn for each; one that cannot be asked stops the search with its own error, since an address chosen blind
// could be a contract that exists. Publishing code at `{4, n}` creates it there, so an address with code is never reused. A number drawn
// twice is not asked about twice (it still uses an attempt).
export async function freeTemplateAddress(
  node: Pick<AlkanesNode, "bytecode">,
  sequence: TemplateSequence,
  random: (length: number) => Uint8Array,
  taken: (address: string) => Promise<boolean>,
): Promise<string | null> {
  const drawn = new Set<bigint>();
  for (let attempt = 0; attempt < sequence.attempts; attempt += 1) {
    const span = sequence.window * 2n ** BigInt(attempt);
    const tx = sequence.first + randomBelow(random, span);
    if (drawn.has(tx)) continue;
    drawn.add(tx);
    const id = { block: templateCodeBlock, tx };
    const address = formatAlkaneId(id);
    if ((await taken(address)) || (await node.bytecode(id)) !== null) continue;
    return address;
  }
  return null;
}
