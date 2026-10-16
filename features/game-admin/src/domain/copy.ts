import type {
  GameAdminStep,
  GameAdminStepState,
  GameAdminSummary,
  StartGameAdminStepResponse,
} from "@ador/shared/games";

// What each state means to staff, in plain words. Nothing here says a step is done before the network's records show it.
export const stateCopy: Readonly<
  Record<GameAdminStepState, { detail: string; label: string }>
> = {
  "awaiting-signature": {
    detail: "Built and waiting for you to sign. Nothing has been sent.",
    label: "Waiting for your signature",
  },
  complete: {
    detail: "The network's records show it.",
    label: "Complete",
  },
  confirmed: {
    detail: "In a block, but the network's records do not show it yet.",
    label: "Confirmed, not yet indexed",
  },
  expired: {
    detail: "It was not signed in time. Start it again.",
    label: "Expired",
  },
  failed: {
    detail: "The network refused it or it did not take effect.",
    label: "Failed",
  },
  pending: {
    detail: "Sent. Waiting for the network.",
    label: "Sent, waiting",
  },
};

export const isSettledStep = (state: GameAdminStepState): boolean =>
  state === "complete" || state === "failed" || state === "expired";

export const operationLabel = (
  step: Pick<GameAdminStep, "operation" | "summary">,
): string =>
  step.operation === "define-milestone"
    ? `Define milestone ${step.summary.milestoneId ?? ""}`.trim()
    : step.summary.paused === true
      ? "Pause claims"
      : "Resume claims";

export const startRefusalCopy: Readonly<
  Record<
    Extract<StartGameAdminStepResponse, { status: "refused" }>["reason"],
    string
  >
> = {
  "already-defined":
    "This milestone is already defined on the contract and cannot be defined again.",
  "bad-drawing": "The drawing was refused.",
  "could-not-build": "The step could not be built.",
  "not-administered":
    "This game or milestone is not one the platform can administer.",
  unavailable:
    "Administration is not available for this game yet: it has no contract, or the network is not set up.",
  "wrong-network": "That address is not an address on this game's network.",
};

export const submitRefusalCopy = {
  "chain-unavailable": "The network could not be reached. Try sending again.",
  expired: "It was not signed in time. Start the step again.",
  "invalid-signature":
    "What was signed is not what was shown. Nothing was sent.",
  "not-awaiting-signature": "This step can no longer be signed.",
  "not-found": "This step could not be found.",
} as const;

export const unreachableCopy =
  "The platform could not be reached. Nothing was changed.";
export const noSignerCopy =
  "This version has no wallet connection that signs administration steps. Sign the transaction below with a wallet you trust, and paste the signed result.";

export const feeText = (summary: Pick<GameAdminSummary, "fee">): string =>
  `${summary.fee.baseUnits} ${summary.fee.asset}`;

export const shortHash = (hash: string): string => `${hash.slice(0, 12)}…`;
