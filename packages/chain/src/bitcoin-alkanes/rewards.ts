import type {
  Address,
  ChainRef,
  CollectiblePreview,
  ContractRef,
} from "@frostbite/shared/chain";

import type { RewardsReader } from "../ports.ts";
import { sha256Hex } from "./admin/data.ts";
import { servedChain, type ServedChain } from "./chains.ts";
import { collectibleOpcodes, gameRewardsOpcodes } from "./abi.ts";
import { holderHalves } from "./holder.ts";
import { milestoneKey } from "./milestone-key.ts";
import { parseAlkaneId } from "./node/alkane-id.ts";
import { littleEndian } from "./node/numbers.ts";

// The node answered, but not with what the contract's interface says it would. Distinct from the node being unreachable.
export class ContractAnswerError extends Error {
  readonly code = "contract-answer";
  constructor(message: string) {
    super(message);
    this.name = "ContractAnswerError";
  }
}

export interface RewardsReaderOptions {
  readonly chains: ReadonlyMap<ChainRef, ServedChain>;
  // The largest picture a page will be handed; anything bigger is an error, not a truncated picture.
  readonly maxPreviewBytes: number;
}

const attributesPattern =
  /^\{"game":"(\d+:\d+)","milestone":"\d+","serial":(\d+)\}$/u;

function contractId(ref: ContractRef) {
  const id = parseAlkaneId(ref.id);
  if (id === null) {
    throw new ContractAnswerError(`${ref.id} is not an Alkane id.`);
  }
  return id;
}

function count(bytes: Uint8Array): number {
  if (bytes.length !== 16) {
    throw new ContractAnswerError("A count must be sixteen bytes.");
  }
  const value = littleEndian(bytes);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ContractAnswerError("The count is larger than a safe integer.");
  }
  return Number(value);
}

export function createRewardsReader(
  options: RewardsReaderOptions,
): RewardsReader {
  if (
    !Number.isInteger(options.maxPreviewBytes) ||
    options.maxPreviewBytes < 1
  ) {
    throw new Error(
      "The preview limit must be a positive whole number of bytes.",
    );
  }
  const decoder = new TextDecoder();
  return {
    drawing: async (contract: ContractRef, milestoneId) => {
      const { node } = servedChain(options.chains, contract.chain);
      const answer = await node.view(
        contractId(contract),
        gameRewardsOpcodes.getMilestoneArt,
        [milestoneKey(milestoneId)],
      );
      if (!answer.ok) throw new ContractAnswerError(answer.error);
      return answer.data.length === 0
        ? null
        : { bytes: answer.data.length, sha256: sha256Hex(answer.data) };
    },
    claimed: async (contract: ContractRef, holder: Address, milestoneId) => {
      const { network, node } = servedChain(options.chains, contract.chain);
      if (holder.chain !== contract.chain) {
        throw new ContractAnswerError("The holder is on another chain.");
      }
      const halves = holderHalves(holder.value, network);
      if (halves === null) {
        throw new ContractAnswerError("The holder is not a supported address.");
      }
      const answer = await node.view(
        contractId(contract),
        gameRewardsOpcodes.getClaimed,
        [halves[0], halves[1], milestoneKey(milestoneId)],
      );
      if (!answer.ok) throw new ContractAnswerError(answer.error);
      return count(answer.data);
    },
    preview: async (item): Promise<CollectiblePreview | null> => {
      const { node } = servedChain(options.chains, item.chain);
      const id = contractId(item);
      const kind = await node.view(id, collectibleOpcodes.getContentType, []);
      // No such item, or a contract that is not a collectible: either way there is nothing to show.
      if (!kind.ok) return null;
      const data = await node.view(id, collectibleOpcodes.getData, []);
      const attributes = await node.view(
        id,
        collectibleOpcodes.getAttributes,
        [],
      );
      if (!data.ok || !attributes.ok) {
        throw new ContractAnswerError(
          "The collectible did not answer its picture.",
        );
      }
      if (data.data.length > options.maxPreviewBytes) {
        throw new ContractAnswerError(
          "The picture is larger than the preview limit.",
        );
      }
      const match = attributesPattern.exec(decoder.decode(attributes.data));
      const game = match?.[1];
      const serial = Number(match?.[2]);
      if (game === undefined || !Number.isSafeInteger(serial) || serial < 1) {
        throw new ContractAnswerError(
          "The collectible's attributes are malformed.",
        );
      }
      return {
        bytes: new Uint8Array(data.data),
        contentType: decoder.decode(kind.data),
        edition: serial,
        issuer: { chain: item.chain, family: item.family, id: game },
      };
    },
  };
}
