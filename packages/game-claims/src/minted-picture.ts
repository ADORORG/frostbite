import { mintedPictureContentTypes } from "@frostbite/shared/games";

import type { GameClaimRepository } from "./repository.ts";
import type { GameClaimsDependencies, MintedPictureResult } from "./types.ts";

// The picture the chain serves for the item a complete claim of the player's minted. It is shown only if the item says it was issued
// by the contract the claim was made against (anyone can create look-alike items) and is a kind of picture that is shown.
export function createPictureReader(dependencies: {
  readonly ports: GameClaimsDependencies["ports"];
  readonly repository: Pick<GameClaimRepository, "get">;
}) {
  const { ports, repository } = dependencies;
  return async function picture(
    userId: string,
    claimId: string,
  ): Promise<MintedPictureResult> {
    const claim = await repository.get(userId, claimId);
    if (claim === null) return { code: "not-found", ok: false };
    if (claim.state !== "complete" || claim.collectibleId === null)
      return { code: "no-picture", ok: false };
    const chain = ports(claim.chain);
    if (chain === null) return { code: "chain-unavailable", ok: false };
    try {
      const preview = await chain.rewards.preview({
        chain: claim.chain,
        family: claim.contract.family,
        id: claim.collectibleId,
      });
      const contentType = mintedPictureContentTypes.find(
        (kind) => kind === preview?.contentType,
      );
      if (
        preview === null ||
        contentType === undefined ||
        preview.issuer.chain !== claim.contract.chain ||
        preview.issuer.family !== claim.contract.family ||
        preview.issuer.id !== claim.contract.id
      )
        return { code: "no-picture", ok: false };
      return {
        bytes: preview.bytes,
        contentType,
        edition: preview.edition,
        ok: true,
      };
    } catch {
      return { code: "chain-unavailable", ok: false };
    }
  };
}
