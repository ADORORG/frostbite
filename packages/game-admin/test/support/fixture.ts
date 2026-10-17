import { randomUUID } from "node:crypto";

import { createDrizzleContractStore } from "@ador/database/game-contracts";
import {
  gameAdminSteps,
  gameContracts,
  publishedTemplates,
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { chainRefSchema, type Address } from "@ador/shared/chain";
import { createSimulatedChain } from "@ador/test-kit/simulated-chain";
import { simulatedAddress } from "@ador/test-kit/simulated-chain-address";
import {
  nativeAsset,
  signSimulated,
  simulatedFamily,
} from "@ador/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleGameAdminRepository } from "../../src/drizzle-repository.ts";
import { createGameAdminService } from "../../src/service.ts";
import type {
  AdminChainPorts,
  AdministeredGame,
  RewardsPlan,
  StartStepInput,
} from "../../src/types.ts";

export { signSimulated };
export const environment = parseDatabaseEnvironment(process.env);
export const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);

const start = new Date("2026-10-16T12:00:00.000Z");
export const clock = { now: start };
export const chain = chainRefSchema.parse("simnet:one");
export const otherChain = chainRefSchema.parse("simnet:two");
export const gameId = "arcade";
export const contract = { chain, family: simulatedFamily, id: "rewards-1" };
export const wallet: Address = simulatedAddress(chain, "a1b2c3");
export const funding = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 10n },
};

const makeNetwork = () =>
  createSimulatedChain({ chains: [chain, otherChain], now: () => clock.now });
let current = makeNetwork();
export const network = {
  get adapter() {
    return current.adapter;
  },
  get controls() {
    return current.controls;
  },
};

export const game: { current: AdministeredGame | null } = { current: null };
// The templates the platform may publish on the simulated chain, and which of them a game and its collectibles are made from.
export const gameTemplate = { id: "game-rewards", version: "1.0.0" };
export const collectibleTemplate = {
  id: "milestone-collectible",
  version: "1.0.0",
};
export const rewards: RewardsPlan = {
  chain,
  collectibleTemplate,
  family: simulatedFamily,
  gameTemplate,
  maxDrawingBytes: 8192n,
  publishable: [gameTemplate, collectibleTemplate],
};
export const contracts = createDrizzleContractStore(database);
export const chainAvailable = { value: true };
export const chainFailure = { build: false };
// Makes the chain say nothing of what a step created.
export const hideCreated = { value: false };
// What the chain says of a contract staff enter by hand: whether code is there, its hash, or that the node cannot be asked.
export const inspected: {
  codeHash: string | null;
  down: boolean;
  exists: boolean;
} = { codeHash: null, down: false, exists: false };
// Held broadcasts, so two steps on one transaction can be made to overlap.
export const broadcastGate: { enabled: boolean; held: (() => void)[] } = {
  enabled: false,
  held: [],
};

function ports(): AdminChainPorts {
  const { addressCodec, broadcaster, builder, contracts, observer } =
    network.adapter.ports;
  if (!addressCodec || !broadcaster || !builder || !contracts || !observer)
    throw new Error("The simulated adapter lacks a port a step needs.");
  return {
    addressCodec,
    broadcaster: {
      broadcast: async (signed) => {
        if (broadcastGate.enabled)
          await new Promise<void>((release) =>
            broadcastGate.held.push(release),
          );
        return broadcaster.broadcast(signed);
      },
    },
    builder: {
      build: (...asked) =>
        chainFailure.build
          ? Promise.reject(new Error("the node is down"))
          : builder.build(...asked),
      verifySigned: (...asked) => builder.verifySigned(...asked),
    },
    contracts: {
      inspect: async (ref) => {
        if (inspected.down) throw new Error("the node is down");
        return { ...inspected, ref };
      },
      simulate: (...asked) => contracts.simulate(...asked),
    },
    observer: {
      observe: async (ref) => {
        const seen = await observer.observe(ref);
        if (!hideCreated.value) return seen;
        const { created, ...rest } = seen;
        void created;
        return rest;
      },
    },
  };
}

export const repository = createDrizzleGameAdminRepository(database, {
  clock: () => clock.now,
});

export const service = createGameAdminService({
  clock: () => clock.now,
  contracts,
  funding: () => funding,
  game: (id) => Promise.resolve(id === gameId ? game.current : null),
  newId: randomUUID,
  ports: (requested) =>
    chainAvailable.value && requested === chain ? ports() : null,
  repository,
  rewards,
  sanitise: (drawing) =>
    drawing.startsWith("<svg")
      ? { ok: true, svg: drawing }
      : { detail: "not a drawing", ok: false },
});

export async function seedStaff(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Staff" });
  return id;
}

export const administeredGame = (): AdministeredGame => ({
  chain,
  contract,
  maxDrawingBytes: 4096n,
  milestones: new Map([
    ["first-win", { claimLimit: 1 }],
    ["streak", { claimLimit: 3 }],
  ]),
});

export const defineInput = (
  staffId: string,
  over: Partial<StartStepInput> = {},
): StartStepInput => ({
  action: {
    drawing: "<svg/>",
    milestoneId: "first-win",
    operation: "define-milestone",
  },
  gameId,
  staffId,
  wallet: wallet.value,
  ...over,
});

// Publishing a template is about no game; deploying one is about the game.
export const publishInput = (
  staffId: string,
  template = gameTemplate,
  address = "at-1",
): StartStepInput => ({
  action: {
    address,
    operation: "publish-template",
    templateId: template.id,
    templateVersion: template.version,
  },
  gameId: null,
  staffId,
  wallet: wallet.value,
});

export const deployInput = (
  staffId: string,
  maxDrawingBytes = 4096,
): StartStepInput => ({
  action: { maxDrawingBytes, operation: "deploy" },
  gameId,
  staffId,
  wallet: wallet.value,
});

export const pauseInput = (staffId: string, paused = true): StartStepInput => ({
  action: { operation: "set-claims-paused", paused },
  gameId,
  staffId,
  wallet: wallet.value,
});

// Starts a step and signs what staff were shown, as their wallet would.
export async function startAndSign(input: StartStepInput) {
  const started = await service.start(input);
  if (!started.ok || started.step.toSign === null)
    throw new Error(
      `The step did not start: ${JSON.stringify(started, (_k, v: unknown) => (typeof v === "bigint" ? String(v) : v))}`,
    );
  return { signed: signSimulated(started.step.toSign), step: started.step };
}

export function registerDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  // Steps are kept by game, so each test starts from an empty log.
  beforeEach(async () => {
    await database.delete(gameContracts);
    await database.delete(publishedTemplates);
    await database.delete(gameAdminSteps);
    clock.now = start;
    current = makeNetwork();
    game.current = administeredGame();
    chainAvailable.value = true;
    chainFailure.build = false;
    hideCreated.value = false;
    Object.assign(inspected, { codeHash: null, down: false, exists: false });
    broadcastGate.enabled = false;
    broadcastGate.held = [];
    network.controls.fund(chain, wallet.value, 100n);
  });
  afterAll(async () => pool.end());
}
