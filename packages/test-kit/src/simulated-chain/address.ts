import {
  chainNamespace,
  chainReference,
  type Address,
  type ChainRef,
} from "@frostbite/shared/chain";
import { InvalidAddressError, type AddressCodec } from "@frostbite/chain/ports";

// The simulated family's address format deliberately shares nothing with Bitcoin's: `sim:<chain
// reference>:<6 lowercase hex><2 hex check>`. The chain reference is part of the text, so an address
// from one simulated chain is not valid on another.
export const simulatedNamespace = "simnet";

const addressPattern = /^sim:([-_a-zA-Z0-9]+):([0-9a-f]{6})([0-9a-f]{2})$/u;

function check(reference: string, body: string): string {
  const text = `${reference}${body}`;
  let sum = 0;
  for (let index = 0; index < text.length; index += 1)
    sum += text.charCodeAt(index);
  return (sum % 256).toString(16).padStart(2, "0");
}

export function simulatedAddress(chain: ChainRef, body: string): Address {
  const reference = chainReference(chain);
  return { chain, value: `sim:${reference}:${body}${check(reference, body)}` };
}

export const simulatedAddressCodec: AddressCodec = {
  parse: (chain, text) => {
    if (chainNamespace(chain) !== simulatedNamespace) {
      throw new InvalidAddressError(`Chain ${chain} is not a simulated chain.`);
    }
    const match = addressPattern.exec(text);
    const reference = chainReference(chain);
    if (
      !match ||
      match[1] !== reference ||
      text.slice(-2) !== check(reference, text.slice(-8, -2))
    ) {
      throw new InvalidAddressError("Not a valid simulated address.");
    }
    return { chain, value: text };
  },
};
