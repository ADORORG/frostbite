import { plainTransactionLabel } from "@ador/feature-chain-status/transaction";
import {
  chainUnreachableWords,
  submitRefusalWords,
} from "@ador/shared/chain-step-words";
import type { ArcadeTone } from "@repo/ui/arcade";
import type {
  GameAdminAction,
  GameAdminStep,
  GameAdminStepState,
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

// A step the platform tried to send but the network has not been seen to hold. It is not "sent": nothing says the network has it.
const notConfirmedSentCopy = {
  detail:
    "The platform tried to send it and the network has not been seen to hold it, so it may not have arrived. It keeps looking and sending the same signed transaction again. If the network never has it, this ends as failed.",
  label: "Not confirmed sent",
} as const;

// What a step in a waiting state says when it has waited longer than expected: more than an hour since it was sent, or the network's
// records are far behind. It says so and says it has not failed, because it has not.
const delayedCopy: Readonly<
  Partial<Record<GameAdminStepState, { detail: string; label: string }>>
> = {
  confirmed: {
    detail:
      "In a block, but the network's records have not caught up, or it has been over an hour. It has not failed; it shows as complete once they agree.",
    label: "Confirmed, delayed",
  },
  pending: {
    detail:
      "Sent, and taking longer than expected: over an hour, or the network's records are far behind. It has not failed and nothing is lost. Keep checking.",
    label: "Sent, delayed",
  },
};

// Whether to say a step is delayed: only while it is in a waiting state, whatever else the flag says.
export const showsDelayed = (
  step: Pick<GameAdminStep, "delayed" | "state">,
): boolean => step.delayed && delayedCopy[step.state] !== undefined;

// The words for a step as it stands now: its state's, or the delayed ones while it is waiting longer than expected.
export const stepCopy = (
  step: Pick<GameAdminStep, "delayed" | "state" | "unconfirmedSend">,
): { detail: string; label: string } =>
  step.unconfirmedSend && step.state === "pending"
    ? notConfirmedSentCopy
    : ((showsDelayed(step) ? delayedCopy[step.state] : undefined) ??
      stateCopy[step.state]);

// The colour a state's badge takes: waiting on you is yellow, waiting on the network is cyan, done is mint, stopped is red or pink.
export const stateTone: Readonly<Record<GameAdminStepState, ArcadeTone>> = {
  "awaiting-signature": "yellow",
  complete: "mint",
  confirmed: "cyan",
  expired: "pink",
  failed: "red",
  pending: "cyan",
};

export const isSettledStep = (state: GameAdminStepState): boolean =>
  state === "complete" || state === "failed" || state === "expired";

// What a step is called, from what it is about: one wording for an action about to be started and a step already in the log.
function labelFor({
  milestoneId,
  operation,
  paused,
  templateRef,
}: {
  readonly milestoneId?: string | undefined;
  readonly operation: GameAdminStep["operation"];
  readonly paused?: boolean | undefined;
  readonly templateRef?: string | undefined;
}): string {
  switch (operation) {
    case "define-milestone":
      return `Define milestone ${milestoneId ?? ""}`.trim();
    case "deploy":
      return "Create the game's contract";
    case "publish-template":
      return `Publish template ${templateRef ?? ""}`.trim();
    case "set-claims-paused":
      return paused === true ? "Pause claims" : "Resume claims";
  }
}

export const operationLabel = (
  step: Pick<GameAdminStep, "operation" | "summary" | "templateRef">,
): string =>
  labelFor({
    milestoneId: step.summary.milestoneId,
    operation: step.operation,
    paused: step.summary.paused,
    templateRef: step.templateRef ?? undefined,
  });

// The same, for an action staff are about to start.
export const actionLabel = (action: GameAdminAction): string =>
  labelFor(
    action.operation === "publish-template"
      ? {
          operation: action.operation,
          templateRef: `${action.templateId}@${action.templateVersion}`,
        }
      : action.operation === "define-milestone"
        ? { milestoneId: action.milestoneId, operation: action.operation }
        : action.operation === "set-claims-paused"
          ? { operation: action.operation, paused: action.paused }
          : { operation: action.operation },
  );

export const startRefusalCopy: Readonly<
  Record<
    Extract<StartGameAdminStepResponse, { status: "refused" }>["reason"],
    string
  >
> = {
  "address-taken":
    "That address already holds a template or a game's contract. Choose another.",
  "already-created": "This game already has its contract.",
  "already-defined":
    "This milestone is already defined on the contract and cannot be defined again.",
  "already-published": "This template is already published.",
  "bad-drawing": "The drawing was refused.",
  "could-not-build": "The step could not be built.",
  "not-administered":
    "This game or milestone is not one the platform can administer.",
  "template-not-published":
    "The templates a game's contract is made from are not both published yet. Publish them first.",
  "unknown-template": "That is not a template the platform publishes.",
  unavailable:
    "Administration is not available yet: the network is not set up, or the game has no contract.",
  "wrong-network": "That address is not an address on this game's network.",
};

export const recordRefusalCopy = {
  "address-taken":
    "That address already holds a template or a game's contract.",
  "already-created": "This game already has its contract.",
  "chain-unavailable": chainUnreachableWords,
  "different-code":
    "A contract is there, but it is not made from this game's template.",
  "not-found": "This step could not be found.",
  "not-on-chain": "No contract is at that address.",
  "not-recordable": "This step's contract address cannot be entered.",
} as const;

// Why the platform turned down what the wallet signed, for a step.
export const submitRefusalCopy = submitRefusalWords("step");

export const walletUnavailableCopy =
  "No wallet that signs steps is connected. Connect one from the wallet button in the header, or sign elsewhere and paste the result.";

// What each transaction of a step is called where its id is shown.
export const transactionRoleLabel: Readonly<
  Record<GameAdminStep["transactions"][number]["role"], string>
> = {
  commit: "Commit transaction",
  reveal: "Reveal transaction",
  transaction: plainTransactionLabel,
};

// Said while a sent step has not been seen on the network: it may not have arrived, and the platform is looking again.
export const unconfirmedSendCopy =
  "Sent, but the network has not been seen to hold it yet, so it may not have arrived. The platform looks again and sends the same signed transaction again, which is safe. Check the ids below on the explorer.";

export const noSignerCopy =
  "This version has no wallet connection that signs administration steps. Sign the transaction below with a wallet you trust, and paste the signed result.";

export const shortHash = (hash: string): string => `${hash.slice(0, 12)}…`;
