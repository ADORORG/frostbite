import {
  chainUnreachableWords,
  submitRefusalWords,
} from "@frostbite/shared/chain-step-words";
import type {
  GameClaim,
  GameClaimState,
  GameClaimUnavailableReason,
} from "@frostbite/shared/games";

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

// What a claim in a waiting state says when it has waited longer than expected (over an hour since it was sent, or the network's
// records are far behind). It says so and says nothing has failed, because it has not.
const delayedCopy: Readonly<
  Partial<
    Record<GameClaimState, { readonly detail: string; readonly label: string }>
  >
> = {
  claimed: {
    detail:
      "Confirmed on the network, but its records have not caught up, or it has been over an hour. It has not failed; it shows as claimed once they agree.",
    label: "Confirmed, delayed",
  },
  pending: {
    detail:
      "Sent, and taking longer than expected: over an hour, or the network's records are far behind. It has not failed and you have lost nothing. Keep this page open or check back later.",
    label: "Sent, delayed",
  },
};

// Whether to say a claim is delayed: only while it is in a waiting state, whatever else the flag says.
export const showsDelayed = (
  claim: Pick<GameClaim, "delayed" | "state">,
): boolean => claim.delayed && delayedCopy[claim.state] !== undefined;

// The words for a claim as it stands now: its state's, or the delayed ones while it waits longer than expected.
export const claimCopy = (
  claim: Pick<GameClaim, "delayed" | "state">,
): { readonly detail: string; readonly label: string } =>
  (showsDelayed(claim) ? delayedCopy[claim.state] : undefined) ??
  claimStateCopy[claim.state];

// Why a claim could not start, as the page says it.
export const claimUnavailableCopy: Readonly<
  Record<GameClaimUnavailableReason | "signed-out", string>
> = {
  "claims-paused": "Claims are paused for this game right now.",
  "contract-refused": "The game's contract would refuse this claim right now.",
  "fee-too-high":
    "Network fees are higher than this platform allows right now. Try a slower speed, or try again later.",
  "index-behind":
    "The network's index is behind the chain right now, so this claim cannot be checked. It clears when the index catches up; try again later.",
  "limit-reached": "You have already claimed this as often as it allows.",
  "milestone-not-defined":
    "This milestone has not been set up on the network yet. The game's staff need to define it before it can be claimed.",
  "no-funds":
    "Your wallet has no confirmed coins to pay the network fee. Add some test bitcoin, wait for it to confirm, and try again.",
  "no-wallet": "Connect a wallet to claim.",
  "not-claimable": "This milestone cannot be claimed.",
  "not-earned": "Earn this milestone first.",
  "not-supported": "Claiming is not available for this game yet.",
  "signed-out": "Sign in to claim.",
  unavailable: chainUnreachableWords,
  "wrong-network": "Your wallet is on another network than this game's.",
};

// Why a claim cannot be signed here, said by what is missing: no wallet is connected, or the one that is cannot sign claims.
export const claimSignerCopy = {
  "not-connected": claimUnavailableCopy["no-wallet"],
  "wallet-cannot-sign":
    "The wallet you connected cannot sign claims here. Connect another from the wallet button in the header.",
} as const;

// Why the platform turned down what the wallet signed, for a claim.
export const claimSubmitRefusalCopy = submitRefusalWords("claim");

export const unreachableCopy =
  "The platform could not be reached. Nothing was changed.";

// A claim is over when it took effect or never will; the page stops asking after it.
export const isSettledClaim = (state: GameClaimState): boolean =>
  state === "complete" || state === "failed" || state === "expired";

// A claim can be started again (or for the first time) when there is none, or the last one ended without taking effect.
export const canStartClaim = (
  latest: Pick<GameClaim, "state"> | null,
): boolean =>
  latest === null || latest.state === "failed" || latest.state === "expired";

// How a claim's state looks on a card: finished, under way, or needing another try.
export const claimTone = (
  state: GameClaimState,
): "done" | "problem" | "waiting" =>
  state === "complete"
    ? "done"
    : state === "failed" || state === "expired"
      ? "problem"
      : "waiting";
