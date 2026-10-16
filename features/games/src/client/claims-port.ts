import { ApiError } from "@ador/client-http";
import type { ClaimsService } from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import type { GameClaim } from "@ador/shared/games";

import { createClaimsApi, type ClaimsApi } from "./claims-api.ts";

// Claims as the host page reaches them: one same-origin request, with the player's session and the address of the wallet the
// player has connected. The page gets the claim to show (`onStarted`: the review the player signs in); a page with nowhere
// to show it cannot offer a claim, and says so rather than telling the game one was requested. Nobody signed in is an answer
// the game can act on (`signed-out`); any other failure is thrown, which the host reports to the game as the platform being
// unavailable, without the reason.
export function createClaimsService(options: {
  readonly api?: ClaimsApi;
  readonly gameId: string;
  // Shows the player the claim that was started, to review and sign.
  readonly onStarted?: (claim: GameClaim) => void;
  readonly wallet: () => WalletInfo | null;
}): ClaimsService {
  const api = options.api ?? createClaimsApi();
  return {
    claim: async (milestoneId) => {
      const { gameId, onStarted, wallet } = options;
      if (onStarted === undefined)
        return { reason: "not-supported", status: "unavailable" };
      const connected = wallet();
      if (connected === null)
        return { reason: "no-wallet", status: "unavailable" };
      try {
        const answer = await api.start({
          gameId,
          milestoneId,
          wallet: connected.address,
        });
        if (answer.status === "unavailable")
          return { reason: answer.reason, status: "unavailable" };
        onStarted(answer.claim);
        return { status: "requested" };
      } catch (error) {
        if (error instanceof ApiError && error.code === "unauthorized")
          return { reason: "signed-out", status: "unavailable" };
        throw error;
      }
    },
  };
}
