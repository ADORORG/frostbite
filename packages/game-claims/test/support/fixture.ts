import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "@frostbite/database";
import { chainRefSchema, type Address } from "@frostbite/shared/chain";
import { simulatedAddress } from "@frostbite/test-kit/simulated-chain-address";
import { createSimulatedChain } from "@frostbite/test-kit/simulated-chain";
import {
  nativeAsset,
  signSimulated,
  simulatedFamily,
} from "@frostbite/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { createDrizzleGameClaimRepository } from "../../src/drizzle-repository.ts";
import {
  broadcastGate,
  builtIntents,
  chainFailure,
  collectible,
  indexer,
  indexerLag,
  reported,
} from "./controls.ts";
import { createGameClaimsService } from "../../src/service.ts";
import type {
  ClaimChainPorts,
  ClaimableGame,
  PlatformFeeSetting,
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
// The platform's fee as set for the chain: none until a test sets one.
export const platformFeeSetting: { current: PlatformFeeSetting | null } = {
  current: null,
};
export const chainAvailable = { value: true };

export * from "./controls.ts";

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
      build: (...asked) => {
        builtIntents.push(asked[0]);
        return chainFailure.build
          ? Promise.reject(
              chainFailure.build instanceof Error
                ? chainFailure.build
                : new Error("the node is down"),
            )
          : builder.build(...asked);
      },
      transactionIds: (...asked) => builder.transactionIds(...asked),
      verifySigned: (...asked) => builder.verifySigned(...asked),
    },
    contracts: {
      freeTemplateAddress: (...asked) =>
        contracts.freeTemplateAddress(...asked),
      inspect: (ref) => contracts.inspect(ref),
      simulate: (intent) =>
        chainFailure.simulate
          ? Promise.resolve({ ok: false, reason: chainFailure.simulate })
          : contracts.simulate(intent),
    },
    observer: {
      balance: (...asked) => observer.balance(...asked),
      feeRates: (...asked) => observer.feeRates(...asked),
      indexing: async (asked) => {
        if (indexer.down) throw new Error("the node is down");
        const reading = await observer.indexing(asked);
        return {
          ...reading,
          tipHeight: reading.indexedHeight + indexer.behind,
        };
      },
      observe: async (ref) => {
        if (chainFailure.observe) throw new Error("the node is down");
        const seen = await observer.observe(ref);
        return seen.status === "confirmed" && collectible.created !== null
          ? { ...seen, created: [collectible.created] }
          : seen;
      },
      tip: (...asked) => observer.tip(...asked),
    },
    rewards: {
      claimed: async (...asked) =>
        Math.max(
          0,
          (await rewards.claimed(...asked)) - (indexerLag.on ? 1 : 0),
        ),
      preview: (asked) =>
        collectible.preview === null
          ? rewards.preview(asked)
          : collectible.preview(),
    },
  };
}

export const repository = createDrizzleGameClaimRepository(database, {
  clock: () => clock.now,
});

export const delay = { maxLagBlocks: 2, maxUnsettledMs: 60 * 60_000 };

export const service = createGameClaimsService({
  clock: () => clock.now,
  delay,
  earned: (userId, id, milestoneId) =>
    Promise.resolve(earnedKeys.has(`${userId}|${id}|${milestoneId}`)),
  funding: () => funding,
  game: (id) => Promise.resolve(id === gameId ? game.current : null),
  newId: randomUUID,
  platformFee: () => Promise.resolve(platformFeeSetting.current),
  ports: (requested) =>
    chainAvailable.value && requested === chain ? ports() : null,
  report: (failure) => reported.push(failure),
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
    platformFeeSetting.current = null;
    chainAvailable.value = true;
    indexerLag.on = false;
    Object.assign(indexer, { behind: 0, down: false });
    broadcastGate.enabled = false;
    broadcastGate.held = [];
    chainFailure.broadcast = false;
    chainFailure.build = false;
    builtIntents.length = 0;
    reported.length = 0;
    chainFailure.observe = false;
    chainFailure.simulate = false;
    collectible.created = null;
    collectible.preview = null;
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
    platformFeeSats: 0n,
    unsigned,
    userId,
    wallet,
  };
}
