import { formatAlkaneId } from "../node/alkane-id.ts";
import type { AlkanesNode } from "../node/node.ts";
import { templateCodeBlock } from "./action.ts";

// Where templates are looked for: the first number in the code block to try and how many in a row to try before giving up.
export interface TemplateSequence {
  readonly attempts: number;
  readonly first: bigint;
}

// The first address at or after `first` in the code block that no code is deployed at and that `taken` does not name. The node is
// asked in turn for each; one that cannot be asked stops the search with its own error, since an address chosen blind could be a
// contract that exists. Publishing code at `{4, n}` creates it there, so an address with code is never reused.
export async function freeTemplateAddress(
  node: Pick<AlkanesNode, "bytecode">,
  sequence: TemplateSequence,
  taken: (address: string) => Promise<boolean>,
): Promise<string | null> {
  for (let offset = 0n; offset < BigInt(sequence.attempts); offset += 1n) {
    const id = { block: templateCodeBlock, tx: sequence.first + offset };
    const address = formatAlkaneId(id);
    if ((await taken(address)) || (await node.bytecode(id)) !== null) continue;
    return address;
  }
  return null;
}
