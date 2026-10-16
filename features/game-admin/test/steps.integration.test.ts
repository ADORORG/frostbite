import { randomUUID } from "node:crypto";

import {
  authUsers,
  createDatabaseClient,
  createDatabasePool,
  gameAdminSteps,
  parseDatabaseEnvironment,
  runMigrations,
} from "@ador/database";
import { correlationIdSchema } from "@ador/shared/http";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { createSimulatedChain } from "@ador/test-kit/simulated-chain";
import {
  nativeAsset,
  simulatedFamily,
} from "@ador/test-kit/simulated-chain-transaction";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createListStepsOperation,
  createRefreshStepOperation,
  createStartStepOperation,
  createSubmitStepOperation,
} from "../src/application/operations.ts";
import type { GameAdminConfig } from "../src/config.ts";
import { adminGames } from "../src/game-info.ts";
import { createGameAdminResolver } from "../src/runtime.ts";
import { chain, game, gameId } from "./support/fixtures.ts";

// Administration as the page drives it, against real PostgreSQL and the simulated chain: start, sign, send, watch until complete,
// and the log that remembers who did it. Only the HTTP framing around the four operations is left out (the route's session,
// origin and rate limit are covered where they live).
const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const wallet = "sim:one:a1b2c3fe";
const contract = { chain, family: simulatedFamily, id: "rewards-1" };
const drawing =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="1" width="8" height="8" fill="#ff0000"></rect></svg>';
const sessionFor = (userId: string) => ({
  actorSession: null,
  actorUserId: uuidV7Schema.parse(userId),
  correlationId: correlationIdSchema.parse(randomUUID()),
});

let now = new Date("2026-10-16T12:00:00.000Z");
let network = createSimulatedChain({ chains: [chain], now: () => now });
const ports = () => {
  const { addressCodec, broadcaster, builder, observer } =
    network.adapter.ports;
  if (!addressCodec || !broadcaster || !builder || !observer)
    throw new Error("The simulated adapter lacks a port.");
  return { addressCodec, broadcaster, builder, observer };
};
const configured = (deployed: boolean): GameAdminConfig => ({
  chain: () => ({
    funding: { maxFee: { asset: nativeAsset(chain), baseUnits: 10n } },
    ports: ports(),
  }),
  clock: () => now,
  contracts: deployed ? new Map([[gameId, contract]]) : new Map(),
  drawingLimits: { maxAttributeLength: 4096, maxDepth: 8, maxElements: 200 },
  maxDrawingBytes: new Map([[gameId, 4096n]]),
});
const operations = (deployed = true) => {
  const config = configured(deployed);
  const resolver = createGameAdminResolver(adminGames([game], config), config);
  return {
    list: createListStepsOperation(resolver),
    refresh: createRefreshStepOperation(resolver),
    start: createStartStepOperation(resolver),
    submit: createSubmitStepOperation(resolver),
  };
};

async function seedStaff(name = "Staff") {
  const random = randomUUID();
  const id = `0198a000-${random.slice(9, 13)}-7${random.slice(15, 18)}-8${random.slice(20, 23)}-${random.slice(24)}`;
  await database
    .insert(authUsers)
    .values({ email: `${id}@example.test`, id, name });
  return id;
}
const pause = {
  action: { operation: "set-claims-paused", paused: true },
  gameId,
  wallet,
} as const;
// The wallet's part: the simulated wallet signs by appending its marker to what it was shown.
const sign = <T extends { payload: string }>(toSign: T) => ({
  ...toSign,
  payload: `${toSign.payload}.sig`,
});

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(gameAdminSteps);
  now = new Date("2026-10-16T12:00:00.000Z");
  network = createSimulatedChain({ chains: [chain], now: () => now });
});
afterAll(async () => pool.end());

describe("administering a game through the operations", () => {
  it("goes from a pause to complete, one staff member building and another sending, both named in the log", async () => {
    const ada = await seedStaff("Ada");
    const grace = await seedStaff("Grace");
    const { list, refresh, start, submit } = operations();

    const started = await start.execute(pause, sessionFor(ada));
    if (!started.ok || started.value.status !== "started")
      throw new Error("not started");
    const { step } = started.value;
    expect(step).toMatchObject({
      createdBy: "Ada",
      state: "awaiting-signature",
      submittedBy: null,
    });
    if (step.toSign === null) throw new Error("nothing to sign");

    const sent = await submit.execute(
      { signed: sign(step.toSign), stepId: step.id },
      sessionFor(grace),
    );
    expect(sent).toMatchObject({
      ok: true,
      value: {
        status: "submitted",
        step: { state: "pending", submittedBy: "Grace", toSign: null },
      },
    });
    const sentStep =
      sent.ok && sent.value.status === "submitted" ? sent.value.step : null;
    expect(sentStep?.transactionId).toEqual(expect.any(String));
    const look = async () => {
      const seen = await refresh.execute({ stepId: step.id }, sessionFor(ada));
      return seen.ok && seen.value.status === "ok"
        ? seen.value.step.state
        : "refused";
    };
    // In no block yet, then three blocks deep, then the indexed state agrees, and then nothing more to do.
    const states = [await look()];
    network.controls.advance(chain, 3);
    states.push(await look(), await look(), await look());
    expect(states).toEqual(["pending", "confirmed", "complete", "complete"]);

    const listed = await list.execute({ gameId }, sessionFor(grace));
    expect(listed).toMatchObject({
      ok: true,
      value: {
        steps: [{ createdBy: "Ada", state: "complete", submittedBy: "Grace" }],
      },
    });
  });

  it("defines a milestone with a drawing the sanitiser accepted, showing its size and hash, and refuses one it did not", async () => {
    const staff = await seedStaff();
    const { start } = operations();
    const defined = await start.execute(
      {
        action: {
          drawing,
          milestoneId: "first-win",
          operation: "define-milestone",
        },
        gameId,
        wallet,
      },
      sessionFor(staff),
    );
    if (!defined.ok || defined.value.status !== "started")
      throw new Error("not started");
    expect(defined.value.step.summary).toMatchObject({
      claimLimit: 1,
      drawing: { bytes: expect.any(Number) },
      milestoneId: "first-win",
    });
    const refused = await start.execute(
      {
        action: {
          drawing: "<script>alert(1)</script>",
          milestoneId: "streak",
          operation: "define-milestone",
        },
        gameId,
        wallet,
      },
      sessionFor(staff),
    );
    expect(refused).toMatchObject({
      ok: true,
      value: { reason: "bad-drawing", status: "refused" },
    });
  });

  it("answers that a game with no contract, an unknown game and another network's address cannot be administered", async () => {
    const staff = await seedStaff();
    const none = operations(false);
    expect(await none.start.execute(pause, sessionFor(staff))).toMatchObject({
      value: { reason: "unavailable", status: "refused" },
    });
    const { start } = operations();
    expect(
      await start.execute({ ...pause, gameId: "nope" }, sessionFor(staff)),
    ).toMatchObject({
      value: { reason: "not-administered", status: "refused" },
    });
    expect(
      await start.execute(
        { ...pause, wallet: "sim:two:a1b2c3fe" },
        sessionFor(staff),
      ),
    ).toMatchObject({
      value: { reason: "wrong-network", status: "refused" },
    });
  });

  it("refuses what was not what staff were shown, and a step that does not exist", async () => {
    const staff = await seedStaff();
    const { start, submit } = operations();
    const started = await start.execute(pause, sessionFor(staff));
    if (
      !started.ok ||
      started.value.status !== "started" ||
      started.value.step.toSign === null
    )
      throw new Error("not started");
    expect(
      await submit.execute(
        {
          signed: {
            ...started.value.step.toSign,
            payload: "not what was shown",
          },
          stepId: started.value.step.id,
        },
        sessionFor(staff),
      ),
    ).toMatchObject({
      value: { reason: "invalid-signature", status: "refused" },
    });
    expect(
      await submit.execute(
        { signed: sign(started.value.step.toSign), stepId: randomUUID() },
        sessionFor(staff),
      ),
    ).toMatchObject({ value: { reason: "not-found", status: "refused" } });
  });
});
