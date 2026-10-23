import { InvalidAddressError } from "@ador/chain/ports";
import type {
  Address,
  ChainRef,
  ContractRef,
  TrackedState,
  TransactionIntent,
} from "@ador/shared/chain";

import type {
  AdminChainPorts,
  GameAdminDependencies,
  StartStepInput,
  StartStepResult,
  TemplateRef,
} from "./types.ts";

export type Refusal = Extract<StartStepResult, { ok: false }>;

// What a step is, before it is built: the chain it is on, what it acts on, and the intent the adapter is asked to build.
export interface Plan {
  readonly chain: ChainRef;
  readonly contract: ContractRef | null;
  readonly gameId: string | null;
  readonly intent: TransactionIntent;
  readonly milestoneId: string | null;
  readonly ports: AdminChainPorts;
  readonly templateRef: string | null;
}

export const refOf = ({ id, version }: TemplateRef): string =>
  `${id}@${version}`;

type Parsed =
  | {
      readonly ok: true;
      readonly ports: AdminChainPorts;
      readonly sender: Address;
    }
  | { readonly ok: false; readonly refusal: Refusal };

// The chain's ports and the wallet as an address on that chain, or why the step cannot be made there.
export function onChain(
  dependencies: GameAdminDependencies,
  chain: ChainRef,
  wallet: string,
): Parsed {
  const ports = dependencies.ports(chain);
  if (ports === null)
    return { ok: false, refusal: { code: "unavailable", ok: false } };
  try {
    return { ok: true, ports, sender: ports.addressCodec.parse(chain, wallet) };
  } catch (error) {
    if (error instanceof InvalidAddressError)
      return { ok: false, refusal: { code: "wrong-chain", ok: false } };
    throw error;
  }
}

// The states in which a template step never put code at its address: refused by the network, run and reverted, or never signed in time.
const addressFreedBy: ReadonlySet<TrackedState> = new Set([
  "broadcast_rejected",
  "expired",
  "indexed_failure",
]);

// The part of a stored step that says whether it still holds the address it was built for.
export interface StepAddress {
  readonly operation: string;
  readonly state: TrackedState;
  readonly unsigned: {
    readonly summary: {
      readonly template?: { readonly at?: { readonly id: string } | undefined };
    };
  };
}

// Whether a template step that may still put code on the chain is for this address: one not refused, reverted or expired.
export function stepsHoldAddress(
  steps: readonly StepAddress[],
  address: string,
): boolean {
  return steps.some(
    (step) =>
      step.operation === "publish-template" &&
      !addressFreedBy.has(step.state) &&
      step.unsigned.summary.template?.at?.id === address,
  );
}

// Whether the platform already holds an address: recorded as a template or a game's contract, or named by a template step that has
// not failed or run out of time (it may still be sent, and would then be there).
async function addressHeld(
  dependencies: GameAdminDependencies,
  address: string,
): Promise<boolean> {
  const { contracts, repository, rewards } = dependencies;
  if (await contracts.addressTaken(rewards.chain, address)) return true;
  return stepsHoldAddress(await repository.list(null), address);
}

// The step that publishes a template: one of the templates the platform may publish, not already published, at an address the
// platform chooses that nothing else on the chain has.
export async function planPublish(
  dependencies: GameAdminDependencies,
  input: StartStepInput,
  action: Extract<StartStepInput["action"], { operation: "publish-template" }>,
): Promise<Plan | Refusal> {
  const { contracts, rewards } = dependencies;
  const templateRef = refOf({
    id: action.templateId,
    version: action.templateVersion,
  });
  if (!rewards.publishable.some((known) => refOf(known) === templateRef))
    return { code: "unknown-template", ok: false };
  const parsed = onChain(dependencies, rewards.chain, input.wallet);
  if (!parsed.ok) return parsed.refusal;
  if ((await contracts.publishedTemplate(rewards.chain, templateRef)) !== null)
    return { code: "already-published", ok: false };
  const address = await dependencies
    .ports(rewards.chain)
    ?.contracts.freeTemplateAddress(rewards.chain, (candidate) =>
      addressHeld(dependencies, candidate),
    );
  if (address === null || address === undefined)
    return {
      code: "could-not-build",
      ok: false,
      reason: "No free address was found for the template.",
    };
  return {
    chain: rewards.chain,
    contract: null,
    gameId: null,
    intent: {
      chain: rewards.chain,
      operation: "publish-template",
      sender: parsed.sender,
      templateAt: {
        chain: rewards.chain,
        family: rewards.family,
        id: address,
      },
      templateId: action.templateId,
      templateVersion: action.templateVersion,
    },
    milestoneId: null,
    ports: parsed.ports,
    templateRef,
  };
}

// The step that creates a game's contract from the published templates, once.
export async function planDeploy(
  dependencies: GameAdminDependencies,
  input: StartStepInput & { readonly gameId: string },
  action: Extract<StartStepInput["action"], { operation: "deploy" }>,
): Promise<Plan | Refusal> {
  const { contracts, rewards } = dependencies;
  const game = await dependencies.game(input.gameId);
  if (game === null) return { code: "not-administered", ok: false };
  if (game.contract !== null) return { code: "already-created", ok: false };
  if (BigInt(action.maxDrawingBytes) > rewards.maxDrawingBytes)
    return {
      code: "could-not-build",
      ok: false,
      reason: `A contract may be created to accept at most ${rewards.maxDrawingBytes} bytes of drawing.`,
    };
  const parsed = onChain(dependencies, game.chain, input.wallet);
  if (!parsed.ok) return parsed.refusal;
  const [gameTemplate, collectibleTemplate] = await Promise.all([
    contracts.publishedTemplate(game.chain, refOf(rewards.gameTemplate)),
    contracts.publishedTemplate(game.chain, refOf(rewards.collectibleTemplate)),
  ]);
  if (gameTemplate === null || collectibleTemplate === null)
    return { code: "template-not-published", ok: false };
  const at = (id: string) => ({
    chain: game.chain,
    family: rewards.family,
    id,
  });
  return {
    chain: game.chain,
    contract: null,
    gameId: input.gameId,
    intent: {
      chain: game.chain,
      collectibleAt: at(collectibleTemplate.address),
      maxDrawingBytes: action.maxDrawingBytes,
      operation: "deploy",
      sender: parsed.sender,
      templateAt: at(gameTemplate.address),
      templateId: rewards.gameTemplate.id,
      templateVersion: rewards.gameTemplate.version,
    },
    milestoneId: null,
    ports: parsed.ports,
    templateRef: null,
  };
}

// The step on a game that has a contract: define a milestone, or pause or resume claims.
export async function planGameStep(
  dependencies: GameAdminDependencies,
  input: StartStepInput & { readonly gameId: string },
  action: Extract<
    StartStepInput["action"],
    { operation: "define-milestone" | "set-claims-paused" }
  >,
): Promise<Plan | Refusal> {
  const game = await dependencies.game(input.gameId);
  if (game === null) return { code: "not-administered", ok: false };
  const contract = game.contract;
  if (contract === null) return { code: "unavailable", ok: false };
  const parsed = onChain(dependencies, game.chain, input.wallet);
  if (!parsed.ok) return parsed.refusal;
  const base = {
    chain: game.chain,
    contract,
    sender: parsed.sender,
    ...(input.authTokenOutput === undefined
      ? {}
      : { extension: { adminOutput: input.authTokenOutput } }),
  };
  const plan = (
    intent: TransactionIntent,
    milestoneId: string | null,
  ): Plan => ({
    chain: game.chain,
    contract,
    gameId: input.gameId,
    intent,
    milestoneId,
    ports: parsed.ports,
    templateRef: null,
  });
  if (action.operation === "set-claims-paused")
    return plan(
      { ...base, operation: action.operation, paused: action.paused },
      null,
    );
  const milestone = game.milestones.get(action.milestoneId);
  if (milestone === undefined) return { code: "not-administered", ok: false };
  const defined = {
    ...base,
    claimLimit: milestone.claimLimit,
    milestoneId: action.milestoneId,
    operation: action.operation,
  };
  if (action.drawing === undefined) return plan(defined, action.milestoneId);
  const drawing = dependencies.sanitise(action.drawing, game.maxDrawingBytes);
  return drawing.ok
    ? plan({ ...defined, drawing: drawing.svg }, action.milestoneId)
    : { code: "bad-drawing", ok: false, reason: drawing.detail };
}
