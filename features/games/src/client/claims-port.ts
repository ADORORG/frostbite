import {
  ApiError,
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import type { ClaimsService } from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import {
  startGameClaimResponseSchema,
  startGameClaimRoute,
  type GameClaim,
} from "@ador/shared/games";

// How long a request to start a claim may take: it builds a transaction and asks the chain what it would cost, and is well
// inside the ten seconds a game waits on the platform.
export const startClaimTimeoutMs = 8_000;

// Claims as the host page reaches them: one same-origin request, with the player's session and the address of the wallet the
// player has connected. The page gets the claim to show (`onStarted`: the review the player signs in); a page with nowhere
// to show it cannot offer a claim, and says so rather than telling the game one was requested. Nobody signed in is an answer
// the game can act on (`signed-out`); any other failure is thrown, which the host reports to the game as the platform being
// unavailable, without the reason.
export function createClaimsService(options: {
  readonly fetch?: FetchLike;
  readonly gameId: string;
  // Shows the player the claim that was started, to review and sign.
  readonly onStarted?: (claim: GameClaim) => void;
  readonly wallet: () => WalletInfo | null;
}): ClaimsService {
  const request = createRequester(options.fetch ?? sameOriginFetch);
  return {
    claim: async (milestoneId) => {
      const { gameId, onStarted, wallet } = options;
      if (onStarted === undefined)
        return { reason: "not-supported", status: "unavailable" };
      const connected = wallet();
      if (connected === null)
        return { reason: "no-wallet", status: "unavailable" };
      try {
        const answer = await request(
          startGameClaimRoute,
          startGameClaimResponseSchema,
          {
            body: { gameId, milestoneId, wallet: connected.address },
            signal: AbortSignal.timeout(startClaimTimeoutMs),
          },
        );
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
