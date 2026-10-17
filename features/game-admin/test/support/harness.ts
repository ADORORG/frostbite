import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameAdminSteps,
  gameContracts,
  parseDatabaseEnvironment,
  publishedTemplates,
  runMigrations,
} from "@ador/database";
import type { GameAdminStep } from "@ador/shared/games";
import { correlationIdSchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { createSimulatedChain } from "@ador/test-kit/simulated-chain";
import { nativeAsset } from "@ador/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach } from "vitest";

import {
  createListStepsOperation,
  createListTemplatesOperation,
  createRecordContractOperation,
  createRefreshStepOperation,
  createStartStepOperation,
  createSubmitStepOperation,
} from "../../src/application/operations.ts";
import type { GameAdminConfig } from "../../src/config.ts";
import { adminGames } from "../../src/game-info.ts";
import { createGameAdminResolver } from "../../src/runtime.ts";
import { chain, config, game, gameId } from "./fixtures.ts";

// Administration as the page drives it, against real PostgreSQL and the simulated chain. Only the HTTP framing around the
// operations is left out (the route's session, origin and rate limit are covered where they live).
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
export const database = createDatabaseClient(pool);
export const wallet = "sim:one:a1b2c3fe";

export const sessionFor = (userId: string) => ({
  actorSession: null,
  actorUserId: uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});

export const time = { now: new Date("2026-10-16T12:00:00.000Z") };
let network = createSimulatedChain({ chains: [chain], now: () => time.now });
export const advance = (blocks: number) =>
  network.controls.advance(chain, blocks);

const ports = () => {
  const { addressCodec, broadcaster, builder, contracts, observer } =
    network.adapter.ports;
  if (!addressCodec || !broadcaster || !builder || !contracts || !observer)
    throw new Error("The simulated adapter lacks a port.");
  return { addressCodec, broadcaster, builder, contracts, observer };
};

const configured = (): GameAdminConfig => ({
  ...config(),
  chain: () => ({
    funding: { maxFee: { asset: nativeAsset(chain), baseUnits: 10n } },
    ports: ports(),
  }),
  clock: () => time.now,
});

// The operations over a fresh resolver, as the routes are built.
export function operations() {
  const settings = configured();
  const resolver = createGameAdminResolver(adminGames([game]), settings);
  return {
    list: createListStepsOperation(resolver),
    record: createRecordContractOperation(resolver),
    refresh: createRefreshStepOperation(resolver),
    start: createStartStepOperation(resolver),
    submit: createSubmitStepOperation(resolver),
    templates: createListTemplatesOperation(resolver),
  };
}
export type Operations = ReturnType<typeof operations>;

export async function seedStaff(name = "Staff") {
  const random = randomUUID();
  const id = `0198a000-${random.slice(9, 13)}-7${random.slice(15, 18)}-8${random.slice(20, 23)}-${random.slice(24)}`;
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name });
  return id;
}

// The wallet's part: the simulated wallet signs by appending its marker to what it was shown.
export const sign = <T extends { payload: string }>(toSign: T) => ({
  ...toSign,
  payload: `${toSign.payload}.sig`,
});

export const pause = {
  action: { operation: "set-claims-paused", paused: true },
  gameId,
  wallet,
} as const;
export const publishing = (id: string, address: string) =>
  ({
    action: {
      address,
      operation: "publish-template",
      templateId: id,
      templateVersion: "1.0.0",
    },
    gameId: null,
    wallet,
  }) as const;
export const creation = (maxDrawingBytes = 4096) =>
  ({
    action: { maxDrawingBytes, operation: "deploy" },
    gameId,
    wallet,
  }) as const;

// Takes a step from start to where it stops: built, signed, sent, three blocks deep, then followed until nothing changes.
export async function runStep(
  ops: Operations,
  staff: string,
  input: Parameters<Operations["start"]["execute"]>[0],
): Promise<GameAdminStep> {
  const started = await ops.start.execute(input, sessionFor(staff));
  if (!started.ok || started.value.status !== "started")
    throw new Error(`not started: ${JSON.stringify(started)}`);
  const { step } = started.value;
  if (step.toSign === null) throw new Error("nothing to sign");
  await ops.submit.execute(
    { signed: sign(step.toSign), stepId: step.id },
    sessionFor(staff),
  );
  advance(3);
  let last = step;
  for (let turn = 0; turn < 4; turn += 1) {
    const seen = await ops.refresh.execute(
      { stepId: step.id },
      sessionFor(staff),
    );
    if (seen.ok && seen.value.status === "ok") last = seen.value.step;
  }
  return last;
}

// Gives the game its contract the way the platform does: both templates published, then the contract created.
export async function createContract(ops: Operations, staff: string) {
  await runStep(ops, staff, publishing("game-rewards", "at-1"));
  await runStep(ops, staff, publishing("milestone-collectible", "at-2"));
  return runStep(ops, staff, creation());
}

export function registerHarness(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(async () => {
    await database.delete(gameContracts);
    await database.delete(publishedTemplates);
    await database.delete(gameAdminSteps);
    time.now = new Date("2026-10-16T12:00:00.000Z");
    network = createSimulatedChain({ chains: [chain], now: () => time.now });
  });
  afterAll(async () => pool.end());
}
