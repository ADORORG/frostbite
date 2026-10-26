import { ApiError } from "@ador/client-http";
import type { ClaimsService } from "@ador/game-sdk/host";
import type { WalletInfo } from "@ador/game-sdk/protocol";
import type { FeeSpeed } from "@ador/shared/chain";
import type { GameClaim, GameClaimUnavailableReason } from "@ador/shared/games";
import { claimUnavailableReasons } from "@ador/game-sdk/protocol";

import { createClaimsApi, type ClaimsApi } from "./claims-api.ts";

// Claims as the host page reaches them: one same-origin request, with the player's session and the address of the wallet the
// player has connected. The page gets the claim to show (`onStarted`: the review the player signs in); a page with nowhere
// to show it cannot offer a claim, and says so rather than telling the game one was requested. Nobody signed in is an answer
// the game can act on (`signed-out`); any other failure is thrown, which the host reports to the game as the platform being
// unavailable, without the reason.
// The reason as the game's protocol has it. The page knows more (no coins, a paused game) than a game's published protocol does, and the
// game is told "unavailable" for those it has no word for; the player is told the rest by the page.
const sdkReasons: readonly string[] = claimUnavailableReasons;
const isSdkReason = (
  reason: string,
): reason is (typeof claimUnavailableReasons)[number] =>
  sdkReasons.includes(reason);
function sdkReason(
  reason: GameClaimUnavailableReason,
): (typeof claimUnavailableReasons)[number] {
  return isSdkReason(reason) ? reason : "unavailable";
}

export function createClaimsService(options: {
  readonly api?: ClaimsApi;
  // The speed the player chose for their claims, read when a claim is asked for; none, the platform's usual speed.
  readonly feeSpeed?: () => FeeSpeed | undefined;
  readonly gameId: string;
  // Tells the player why a claim could not start, in full: the game is given only the reasons the SDK's protocol has.
  readonly onRefused?: (reason: GameClaimUnavailableReason) => void;
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
        const feeSpeed = options.feeSpeed?.();
        const answer = await api.start({
          ...(feeSpeed === undefined ? {} : { feeSpeed }),
          gameId,
          milestoneId,
          wallet: connected.address,
        });
        if (answer.status === "unavailable") {
          options.onRefused?.(answer.reason);
          return {
            reason: sdkReason(answer.reason),
            status: "unavailable",
          };
        }
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
