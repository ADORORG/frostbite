import { gameAdminSteps } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  administeredGame,
  chain,
  chainAvailable,
  collectibleTemplate,
  contracts,
  database,
  deployInput,
  game,
  gameId,
  gameTemplate,
  hideCreated,
  inspected,
  publishInput,
  registerDatabase,
  seedStaff,
  service,
} from "./support/fixture.ts";
import { runToEnd, withoutContract } from "./support/run.ts";

registerDatabase();

// A game's contract that was made on the chain, whose address the platform could not read from the confirmed transaction.
async function unreadable() {
  withoutContract();
  const staff = await seedStaff();
  await runToEnd(publishInput(staff, gameTemplate, "at-1"));
  await runToEnd(publishInput(staff, collectibleTemplate, "at-2"));
  hideCreated.value = true;
  const step = await runToEnd(deployInput(staff, 2048));
  hideCreated.value = false;
  if (step.state !== "indexed_failure") throw new Error("not unreadable");
  const codeHash = step.summary.template?.codeHash;
  if (codeHash === undefined) throw new Error("no template hash");
  return { codeHash, staff, step };
}

const found = (codeHash: string | null) =>
  Object.assign(inspected, { codeHash, exists: true });

const stored = async (stepId: string) => {
  const [row] = await database
    .select()
    .from(gameAdminSteps)
    .where(eq(gameAdminSteps.id, stepId));
  return row;
};

describe("recording a contract's address by hand", () => {
  it("records the address, completes the step and says who entered it", async () => {
    const { codeHash, staff, step } = await unreadable();
    found(codeHash);
    const recorded = await service.recordCreated({
      address: "  2:77 ",
      staffId: staff,
      stepId: step.id,
    });
    expect(recorded).toMatchObject({
      ok: true,
      step: {
        createdContracts: ["2:77"],
        recordedBy: staff,
        state: "complete",
      },
    });
    expect(await contracts.gameContract(gameId, chain)).toMatchObject({
      address: "2:77",
      maxDrawingBytes: 2048,
    });
    expect((await stored(step.id))?.recordedBy).toBe(staff);
    // Done once: the step is no longer one that can be recorded.
    expect(
      await service.recordCreated({
        address: "2:78",
        staffId: staff,
        stepId: step.id,
      }),
    ).toEqual({ code: "not-recordable", ok: false });
    expect((await contracts.gameContract(gameId, chain))?.address).toBe("2:77");
  });

  it("lets only one of two people who record at once win", async () => {
    const { codeHash, staff, step } = await unreadable();
    const other = await seedStaff();
    found(codeHash);
    const asked = (staffId: string, address: string) =>
      service.recordCreated({ address, staffId, stepId: step.id });
    const answers = await Promise.all([
      asked(staff, "2:77"),
      asked(other, "2:78"),
    ]);
    expect(answers.filter(({ ok }) => ok)).toHaveLength(1);
    expect(answers.filter(({ ok }) => !ok)).toEqual([
      { code: "not-recordable", ok: false },
    ]);
    const winner = answers.find(({ ok }) => ok);
    const kept = await contracts.gameContract(gameId, chain);
    expect(winner?.ok && winner.step.createdContracts).toEqual([kept?.address]);
  });

  it("refuses what is not a creation whose address was unreadable", async () => {
    const { staff, step } = await unreadable();
    found("a".repeat(64));
    const [publication] = await service.list(null);
    if (publication?.state !== "complete") throw new Error("no publication");
    const ask = (stepId: string) =>
      service.recordCreated({ address: "2:77", staffId: staff, stepId });
    expect(await ask(crypto.randomUUID())).toEqual({
      code: "not-found",
      ok: false,
    });
    // A step that is not a creation, even one that is over.
    expect(await ask(publication.id)).toEqual({
      code: "not-recordable",
      ok: false,
    });
    // A creation that failed for another reason made nothing to record.
    await database
      .update(gameAdminSteps)
      .set({ failureReason: "reverted by the network" })
      .where(eq(gameAdminSteps.id, step.id));
    expect(await ask(step.id)).toEqual({ code: "not-recordable", ok: false });
    expect(await contracts.gameContract(gameId, chain)).toBeNull();
  });

  it("refuses an address that is not the contract the step made, and records nothing", async () => {
    const { codeHash, staff, step } = await unreadable();
    const ask = (address = "2:77") =>
      service.recordCreated({ address, staffId: staff, stepId: step.id });
    expect(await ask()).toEqual({ code: "not-on-chain", ok: false });
    found("b".repeat(64));
    expect(await ask()).toEqual({ code: "different-code", ok: false });
    found(null);
    expect(await ask()).toEqual({ code: "different-code", ok: false });
    // An address the record already holds for a template.
    found(codeHash);
    expect(await ask("at-1")).toEqual({ code: "address-taken", ok: false });
    inspected.down = true;
    expect(await ask()).toEqual({ code: "chain-unavailable", ok: false });
    inspected.down = false;
    chainAvailable.value = false;
    expect(await ask()).toEqual({ code: "chain-unavailable", ok: false });
    chainAvailable.value = true;
    expect(await contracts.gameContract(gameId, chain)).toBeNull();
    expect((await stored(step.id))?.state).toBe("indexed_failure");
    expect((await stored(step.id))?.recordedBy).toBeNull();
  });

  it("refuses a step whose summary no longer says what the contract was made from or to accept", async () => {
    const { codeHash, staff, step } = await unreadable();
    found(codeHash);
    const original = (await stored(step.id))?.summary;
    if (typeof original !== "object" || original === null)
      throw new Error("no summary");
    // One thing missing at a time, so each is shown to matter on its own.
    for (const key of ["maxDrawingBytes", "template"]) {
      const without = Object.fromEntries(
        Object.entries(original).filter(([name]) => name !== key),
      );
      await database
        .update(gameAdminSteps)
        .set({ summary: without })
        .where(eq(gameAdminSteps.id, step.id));
      expect(
        await service.recordCreated({
          address: "2:77",
          staffId: staff,
          stepId: step.id,
        }),
      ).toEqual({ code: "different-code", ok: false });
    }
    expect(await contracts.gameContract(gameId, chain)).toBeNull();
  });

  it("refuses when the game has a contract by now, or is not one the platform administers", async () => {
    const { codeHash, staff, step } = await unreadable();
    found(codeHash);
    const ask = () =>
      service.recordCreated({
        address: "2:77",
        staffId: staff,
        stepId: step.id,
      });
    game.current = administeredGame();
    expect(await ask()).toEqual({ code: "already-created", ok: false });
    game.current = null;
    expect(await ask()).toEqual({ code: "not-recordable", ok: false });
    expect(await contracts.gameContract(gameId, chain)).toBeNull();
  });
});
