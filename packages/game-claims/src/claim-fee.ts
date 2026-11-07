import type { Address, ChainRef } from "@frostbite/shared/chain";

import type { ClaimChainPorts, PlatformFeeSetting } from "./types.ts";

// The platform's fee for a claim that is about to be built: what to ask the chain to pay, and the amount to keep with the claim. None
// when no fee is set or it is zero. The fee is read now and kept with the claim, so what the wallet is shown is what is charged,
// whatever it is set to later. The treasury is parsed for the chain here, so an address the chain does not accept stops the claim (the
// caller reports it) instead of becoming a claim that quietly gives the fee away.
export async function claimFee(
  read: (chain: ChainRef) => Promise<PlatformFeeSetting | null>,
  chain: ChainRef,
  ports: Pick<ClaimChainPorts, "addressCodec">,
): Promise<{
  readonly output: { readonly baseUnits: bigint; readonly recipient: Address };
  readonly sats: bigint;
} | null> {
  const setting = await read(chain);
  if (setting === null || setting.feeSats <= 0n) return null;
  return {
    output: {
      baseUnits: setting.feeSats,
      recipient: ports.addressCodec.parse(chain, setting.treasury),
    },
    sats: setting.feeSats,
  };
}
