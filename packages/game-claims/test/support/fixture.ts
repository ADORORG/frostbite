import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { chainRefSchema, type Address } from "@ador/shared/chain";
import { simulatedAddress } from "@ador/test-kit/simulated-chain-address";
import { createSimulatedChain } from "@ador/test-kit/simulated-chain";
import {
  nativeAsset,
  signSimulated,
  simulatedFamily,
} from "@ador/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleGameClaimRepository } from "../../src/drizzle-repository.ts";
import { createGameClaimsService } from "../../src/service.ts";
import type { ClaimChainPorts, ClaimableGame } from "../../src/types.ts";

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
export const otherWallet: Address = simulatedAddress(chain, "d4e5f6");
export const funding = {
  maxFee: { asset: nativeAsset(chain), baseUnits: 10n },
};

// The chain every test claims on: the simulated family, with time that only the test moves. A fresh one for each test, so
// what one test claims on it is never counted in another.
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

// What the account says is earned: a test adds to it, as the account's sync would.
export const earnedKeys = new Set<string>();
export const earn = (userId: string, milestoneId: string, game = gameId) =>
  earnedKeys.add(`${userId}|${game}|${milestoneId}`);

export const game: { current: ClaimableGame | null } = { current: null };
export const chainAvailable = { value: true };

// While `on`, the indexer is behind: it shows one claim fewer than the network has confirmed.
export const indexerLag = { on: false };
// What the chain does wrong on purpose.
// Held broadcasts, released by a test one at a time, so two steps on one claim can be made to overlap.
export const broadcastGate: { enabled: boolean; held: (() => void)[] } = {
  enabled: false,
  held: [],
};
export const chainFailure = {
  broadcast: false,
  build: false,
  observe: false,
  simulate: false,
};

function ports(): ClaimChainPorts {
  const { addressCodec, broadcaster, builder, contracts, observer, rewards } =
    network.adapter.ports;
  if (
    !addressCodec ||
    !broadcaster ||
    !builder ||
    !contracts ||
    !observer ||
    !rewards
  )
    throw new Error("The simulated adapter lacks a port a claim needs.");
  return {
    addressCodec,
    broadcaster: {
      broadcast: async (signed) => {
        if (chainFailure.broadcast) throw new Error("the node is down");
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
      inspect: (ref) => contracts.inspect(ref),
      simulate: (intent) =>
        chainFailure.simulate
          ? Promise.resolve({
              ok: false,
              reason: "the contract would refuse it",
            })
          : contracts.simulate(intent),
    },
    observer: {
      observe: (ref) =>
        chainFailure.observe
          ? Promise.reject(new Error("the node is down"))
          : observer.observe(ref),
    },
    rewards: {
      claimed: async (...asked) =>
        Math.max(
          0,
          (await rewards.claimed(...asked)) - (indexerLag.on ? 1 : 0),
        ),
      preview: rewards.preview,
    },
  };
}

export const repository = createDrizzleGameClaimRepository(database, {
  clock: () => clock.now,
});

export const service = createGameClaimsService({
  clock: () => clock.now,
  earned: (userId, id, milestoneId) =>
    Promise.resolve(earnedKeys.has(`${userId}|${id}|${milestoneId}`)),
  funding: () => funding,
  game: (id) => (id === gameId ? game.current : null),
  newId: randomUUID,
  ports: (requested) =>
    chainAvailable.value && requested === chain ? ports() : null,
  repository,
});

export async function seedUser(): Promise<string> {
  const id = randomUUID();
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name: "Player" });
  return id;
}

// A game with a rewards contract on the chain: one milestone claimed once, one up to three times.
export const claimableGame = (): ClaimableGame => ({
  chain,
  contract,
  limits: new Map([
    ["first-win", 1],
    ["streak", 3],
  ]),
});

// A player who has earned both milestones, ready to claim.
export async function player(): Promise<string> {
  const userId = await seedUser();
  earn(userId, "first-win");
  earn(userId, "streak");
  network.controls.fund(chain, wallet.value, 100n);
  return userId;
}

// Starts a claim and signs what the player was shown, as the wallet would.
export async function startAndSign(userId: string, milestoneId = "first-win") {
  const started = await service.start({
    gameId,
    milestoneId,
    userId,
    wallet: wallet.value,
  });
  if (!started.ok || started.claim.toSign === null)
    throw new Error(`The claim did not start: ${JSON.stringify(started)}`);
  return { claim: started.claim, signed: signSimulated(started.claim.toSign) };
}

// Migrates once, then resets the clock, the chain's forced outcomes and what is earned before each test.
export function registerDatabase(): void {
  beforeAll(async () => runMigrations(environment));
  beforeEach(() => {
    clock.now = start;
    current = makeNetwork();
    earnedKeys.clear();
    game.current = claimableGame();
    chainAvailable.value = true;
    indexerLag.on = false;
    broadcastGate.enabled = false;
    broadcastGate.held = [];
    chainFailure.broadcast = false;
    chainFailure.build = false;
    chainFailure.observe = false;
    chainFailure.simulate = false;
  });
  afterAll(async () => pool.end());
}

// A claim as the service would hand it to the repository: a real transaction built on the simulated chain.
export async function newClaim(userId: string, milestoneId = "first-win") {
  const builder = network.adapter.ports.builder;
  if (!builder) throw new Error("The simulated adapter has no builder.");
  const unsigned = await builder.build(
    {
      chain,
      contract,
      milestoneId,
      operation: "mint-milestone",
      sender: wallet,
    },
    funding,
  );
  return {
    chain,
    contract,
    createdAt: clock.now,
    expiresAt: new Date(unsigned.summary.expiresAt),
    gameId,
    id: randomUUID(),
    milestoneId,
    unsigned,
    userId,
    wallet,
  };
}
