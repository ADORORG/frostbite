import type {
  GameClaim,
  GameClaimState,
  GameClaimUnavailableReason,
} from "@ador/shared/games";

// What a person is told about a claim, in one place. It never says "minted" or "claimed" before the chain's indexed state agrees:
// `claimed` is only "confirmed" and says it is not complete yet.
export const claimStateCopy: Readonly<
  Record<GameClaimState, { readonly detail: string; readonly label: string }>
> = {
  "awaiting-signature": {
    detail:
      "Review what it will do, then sign with your wallet. You pay the network fee.",
    label: "Waiting for your wallet",
  },
  claimed: {
    detail:
      "Confirmed on the network. It is not complete until the network's records show it.",
    label: "Confirmed",
  },
  complete: {
    detail: "The network's records show it. This milestone is claimed.",
    label: "Claimed",
  },
  expired: {
    detail: "It was not signed in time. Start it again to claim.",
    label: "Expired",
  },
  failed: {
    detail: "It did not go through. Nothing was claimed.",
    label: "Failed",
  },
  pending: {
    detail: "Sent to the network. Waiting for it to confirm.",
    label: "Sent",
  },
};

// Why a claim could not start, as the page says it.
export const claimUnavailableCopy: Readonly<
  Record<GameClaimUnavailableReason | "signed-out", string>
> = {
  "limit-reached": "You have already claimed this as often as it allows.",
  "no-wallet": "Connect a wallet to claim.",
  "not-claimable": "This milestone cannot be claimed.",
  "not-earned": "Earn this milestone first.",
  "not-supported": "Claiming is not available for this game yet.",
  "signed-out": "Sign in to claim.",
  unavailable: "The network could not be reached. Try again.",
  "wrong-network": "Your wallet is on another network than this game's.",
};

export const unreachableCopy =
  "The platform could not be reached. Nothing was changed.";

// A claim is over when it took effect or never will; the page stops asking after it.
export const isSettledClaim = (state: GameClaimState): boolean =>
  state === "complete" || state === "failed" || state === "expired";

// The fee the player pays, as the review shows it: the amount in the network's smallest unit and the asset it is paid in.
export const feeText = (summary: GameClaim["summary"]): string =>
  `${summary.fee.baseUnits} ${summary.fee.asset}`;
