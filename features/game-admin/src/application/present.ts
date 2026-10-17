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
  // A step on a contract names it; publishing a template and creating a contract act on none yet.
  const actsOnContract =
    view.operation === "define-milestone" ||
    view.operation === "set-claims-paused";
  if (actsOnContract && contract === undefined)
    throw new Error("A step's summary names the contract it acts on.");
  const named = (id: string | null) =>
    id === null ? null : (names.get(id) ?? null);
  return {
    createdAt: view.createdAt,
    createdBy: named(view.createdBy),
    createdContracts: [...view.createdContracts],
    delayed: view.delayed,
    failureReason: view.failureReason,
    gameId: view.gameId,
    id: view.id,
    operation: view.operation,
    recordable: view.recordable,
    recordedBy: named(view.recordedBy),
    sentAt: view.sentAt,
    state: stageOf(view.state),
    submittedBy: named(view.submittedBy),
    summary: {
      chain: summary.chain,
      ...(summary.claimLimit === undefined
        ? {}
        : { claimLimit: summary.claimLimit }),
      ...(summary.collectibleAt === undefined
        ? {}
        : { collectibleAddress: summary.collectibleAt.id }),
      ...(contract === undefined ? {} : { contractId: contract.id }),
      ...(summary.drawing === undefined ? {} : { drawing: summary.drawing }),
      expiresAt: summary.expiresAt,
      fee: {
        asset: summary.fee.asset.id,
        baseUnits: summary.fee.baseUnits.toString(),
      },
      ...(summary.milestone === undefined
        ? {}
        : { milestoneId: summary.milestone.id }),
      ...(summary.maxDrawingBytes === undefined
        ? {}
        : { maxDrawingBytes: summary.maxDrawingBytes }),
      ...(summary.paused === undefined ? {} : { paused: summary.paused }),
      ...(summary.template === undefined
        ? {}
        : {
            template: {
              ...(summary.template.at === undefined
                ? {}
                : { address: summary.template.at.id }),
              id: summary.template.id,
              version: summary.template.version,
            },
          }),
    },
    templateRef: view.templateRef,
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
    views.flatMap(({ createdBy, recordedBy, submittedBy }) =>
      [createdBy, recordedBy, submittedBy].filter(
        (id): id is string => id !== null,
      ),
    ),
  ),
];
