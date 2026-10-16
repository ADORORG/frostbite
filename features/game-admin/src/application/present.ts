import type { StepView } from "@ador/game-admin";
import { stageOf } from "@ador/shared/chain";
import type { GameAdminStep } from "@ador/shared/games";

// A step as the page is told of it: the stage, the summary as plain text, the transaction only while it is still to be signed, and
// the people in the log by name (a person whose account is gone is `null`, and the page says so).
export function toWireStep(
  view: StepView,
  names: ReadonlyMap<string, string>,
): GameAdminStep {
  const { summary } = view;
  const contract = summary.milestone?.contract ?? summary.contract;
  if (contract === undefined)
    throw new Error("A step's summary names the contract it acts on.");
  const named = (id: string | null) =>
    id === null ? null : (names.get(id) ?? null);
  return {
    createdAt: view.createdAt,
    createdBy: named(view.createdBy),
    failureReason: view.failureReason,
    gameId: view.gameId,
    id: view.id,
    operation: view.operation,
    state: stageOf(view.state),
    submittedBy: named(view.submittedBy),
    summary: {
      chain: summary.chain,
      ...(summary.claimLimit === undefined
        ? {}
        : { claimLimit: summary.claimLimit }),
      contractId: contract.id,
      ...(summary.drawing === undefined ? {} : { drawing: summary.drawing }),
      expiresAt: summary.expiresAt,
      fee: {
        asset: summary.fee.asset.id,
        baseUnits: summary.fee.baseUnits.toString(),
      },
      ...(summary.milestone === undefined
        ? {}
        : { milestoneId: summary.milestone.id }),
      ...(summary.paused === undefined ? {} : { paused: summary.paused }),
    },
    toSign:
      view.toSign === null
        ? null
        : {
            chain: view.toSign.chain,
            family: view.toSign.family,
            format: view.toSign.format,
            payload: view.toSign.payload,
          },
    transactionId: view.transactionId,
  };
}

// The people a set of steps names, to look up once.
export const peopleOf = (views: readonly StepView[]): string[] => [
  ...new Set(
    views.flatMap(({ createdBy, submittedBy }) =>
      [createdBy, submittedBy].filter((id): id is string => id !== null),
    ),
  ),
];
