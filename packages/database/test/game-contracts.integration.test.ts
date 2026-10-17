import { randomUUID } from "node:crypto";

import { chainRefSchema } from "@ador/shared/chain";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseClient,
  createDatabasePool,
  parseDatabaseEnvironment,
  runMigrations,
} from "../src/index.ts";
import {
  createDrizzleContractStore,
  writeRecording,
} from "../src/game-contracts/store.ts";
import { gameAdminSteps } from "../src/schema/game-admin.ts";
import {
  gameContracts,
  publishedTemplates,
} from "../src/schema/game-contracts.ts";

const environment = parseDatabaseEnvironment(process.env);
const pool = createDatabasePool(environment);
const database = createDatabaseClient(pool);
const store = createDrizzleContractStore(database);
const chain = chainRefSchema.parse("simnet:one");
const elsewhere = chainRefSchema.parse("simnet:two");

beforeAll(async () => runMigrations(environment));
beforeEach(async () => {
  await database.delete(gameContracts);
  await database.delete(publishedTemplates);
  await database.delete(gameAdminSteps);
});
afterAll(async () => pool.end());

// The step a record points at as its evidence.
async function aStep(operation = "publish-template") {
  const id = randomUUID();
  await database.insert(gameAdminSteps).values({
    chain,
    expiresAt: new Date("2026-10-17T00:00:00.000Z"),
    gameId: operation === "publish-template" ? null : "arcade",
    id,
    operation,
    state: "awaiting_signature",
    summary: {},
    templateRef: operation === "publish-template" ? "game-rewards@1.0.0" : null,
    unsignedFamily: "simulated",
    unsignedFormat: "f",
    unsignedPayload: "p",
  });
  return { chain, id };
}

const template = (address: string, templateRef = "game-rewards@1.0.0") =>
  ({
    address,
    codeHash: "a".repeat(64),
    kind: "template",
    templateRef,
  }) as const;
const game = (address: string, gameId = "arcade") =>
  ({
    address,
    family: "simulated",
    gameId,
    kind: "game",
    maxDrawingBytes: 4096,
  }) as const;

describe("the record of what is on the chain", () => {
  it("has nothing until a step recorded it", async () => {
    expect(
      await store.publishedTemplate(chain, "game-rewards@1.0.0"),
    ).toBeNull();
    expect(await store.publishedTemplates(chain)).toEqual([]);
    expect(await store.gameContract("arcade", chain)).toBeNull();
    expect(await store.addressTaken(chain, "at-1")).toBe(false);
  });

  it("holds a template where it was published, per chain, oldest first", async () => {
    const step = await aStep();
    await writeRecording(database, step, template("at-1"));
    await writeRecording(
      database,
      step,
      template("at-2", "milestone-collectible@1.0.0"),
    );
    expect(
      await store.publishedTemplate(chain, "game-rewards@1.0.0"),
    ).toMatchObject({
      address: "at-1",
      codeHash: "a".repeat(64),
      templateRef: "game-rewards@1.0.0",
    });
    expect(
      (await store.publishedTemplates(chain)).map(({ address }) => address),
    ).toEqual(["at-1", "at-2"]);
    expect(
      await store.publishedTemplate(elsewhere, "game-rewards@1.0.0"),
    ).toBeNull();
    expect(await store.publishedTemplates(elsewhere)).toEqual([]);
  });

  it("holds a game's contract per game and chain", async () => {
    const step = await aStep("deploy");
    await writeRecording(database, step, game("g-1"));
    await writeRecording(database, step, game("g-2", "other"));
    expect(await store.gameContract("arcade", chain)).toEqual({
      address: "g-1",
      family: "simulated",
      maxDrawingBytes: 4096,
    });
    expect((await store.gameContract("other", chain))?.address).toBe("g-2");
    expect(await store.gameContract("arcade", elsewhere)).toBeNull();
    expect(await store.gameContract("unknown", chain)).toBeNull();
  });

  it("calls an address taken when a template or a game's contract has it, on that chain only", async () => {
    const step = await aStep();
    await writeRecording(database, step, template("at-1"));
    await writeRecording(database, step, game("g-1"));
    expect(await store.addressTaken(chain, "at-1")).toBe(true);
    expect(await store.addressTaken(chain, "g-1")).toBe(true);
    expect(await store.addressTaken(chain, "free")).toBe(false);
    expect(await store.addressTaken(elsewhere, "at-1")).toBe(false);
    expect(await store.addressTaken(elsewhere, "g-1")).toBe(false);
  });

  it("refuses a second record for the same template or game, or another at the same address", async () => {
    const step = await aStep();
    await writeRecording(database, step, template("at-1"));
    await writeRecording(database, step, game("g-1"));
    for (const again of [
      template("at-9"),
      template("at-1", "milestone-collectible@1.0.0"),
      game("g-9"),
      game("g-1", "other"),
    ]) {
      await expect(writeRecording(database, step, again)).rejects.toThrow();
    }
  });

  it("refuses a record whose code hash or size is malformed", async () => {
    const step = await aStep();
    await expect(
      writeRecording(database, step, { ...template("at-1"), codeHash: "xyz" }),
    ).rejects.toThrow();
    await expect(
      writeRecording(database, step, { ...game("g-1"), maxDrawingBytes: 0 }),
    ).rejects.toThrow();
  });

  it("keeps the step that is the evidence of a record", async () => {
    const step = await aStep();
    await writeRecording(database, step, template("at-1"));
    await expect(database.delete(gameAdminSteps)).rejects.toThrow();
  });
});
