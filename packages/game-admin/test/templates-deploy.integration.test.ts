import {
  gameAdminSteps,
  gameContracts,
  publishedTemplates,
} from "@ador/database";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  administeredGame,
  chain,
  collectibleTemplate,
  contracts,
  database,
  deployInput,
  game,
  gameId,
  gameTemplate,
  hideCreated,
  network,
  publishInput,
  registerDatabase,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";
import { runToEnd, withoutContract } from "./support/run.ts";

registerDatabase();

describe("creating a game's contract", () => {
  const publishBoth = async (staff: string) => {
    await runToEnd(publishInput(staff, gameTemplate));
    await runToEnd(publishInput(staff, collectibleTemplate));
  };

  it("needs both templates published first", async () => {
    withoutContract();
    const staff = await seedStaff();
    expect(await service.start(deployInput(staff))).toEqual({
      code: "template-not-published",
      ok: false,
    });
    await runToEnd(publishInput(staff, gameTemplate));
    expect(await service.start(deployInput(staff))).toEqual({
      code: "template-not-published",
      ok: false,
    });
  });

  it("shows what it is made from, and records the contract the chain says it made", async () => {
    withoutContract();
    const staff = await seedStaff();
    await publishBoth(staff);
    const started = await service.start(deployInput(staff, 2048));
    if (!started.ok) throw new Error("not started");
    expect(started.step).toMatchObject({
      gameId,
      operation: "deploy",
      templateRef: null,
    });
    expect(started.step.summary).toMatchObject({
      collectibleAt: { id: "template-2" },
      maxDrawingBytes: 2048,
      template: { at: { id: "template-1" }, id: "game-rewards" },
    });

    const done = await runToEnd(deployInput(staff, 2048));
    expect(done.state).toBe("complete");
    expect(done.createdContracts).toHaveLength(1);
    expect(await contracts.gameContract(gameId, chain)).toEqual({
      address: done.createdContracts[0],
      family: "simulated",
      maxDrawingBytes: 2048,
    });
  });

  it("never chooses an address a game's contract is at", async () => {
    withoutContract();
    const staff = await seedStaff();
    await publishBoth(staff);
    await runToEnd(deployInput(staff));
    expect(await service.start(publishInput(staff, gameTemplate))).toEqual({
      code: "already-published",
      ok: false,
    });
    // The game's contract sits where the first template would go, and the game template's own record is gone.
    await database.update(gameContracts).set({ address: "template-1" });
    await database
      .delete(publishedTemplates)
      .where(eq(publishedTemplates.templateRef, "game-rewards@1.0.0"));
    // Nor does its step remember the address, so only the record of the game's contract holds it.
    await database
      .delete(gameAdminSteps)
      .where(eq(gameAdminSteps.templateRef, "game-rewards@1.0.0"));
    const started = await service.start(publishInput(staff, gameTemplate));
    if (!started.ok) throw new Error("not started");
    // `template-2` holds the collectible.
    expect(started.step.summary.template?.at?.id).toBe("template-3");
  });

  it("tells the step what the chain says it created as soon as it is confirmed", async () => {
    withoutContract();
    const staff = await seedStaff();
    await publishBoth(staff);
    const { signed, step } = await startAndSign(deployInput(staff));
    await service.submitSigned({ signed, staffId: staff, stepId: step.id });
    network.controls.advance(chain, 3);
    const confirmed = await service.refresh(step.id);
    if (!confirmed.ok) throw new Error("not refreshed");
    expect(confirmed.step.state).toBe("confirmed");
    expect(confirmed.step.createdContracts).toHaveLength(1);
  });

  it("is refused once the game has a contract, or for a size the platform does not allow", async () => {
    withoutContract();
    const staff = await seedStaff();
    await publishBoth(staff);
    expect(await service.start(deployInput(staff, 8193))).toMatchObject({
      code: "could-not-build",
      ok: false,
    });
    expect(await service.start(deployInput(staff, 8192))).toMatchObject({
      ok: true,
    });
    game.current = administeredGame();
    expect(await service.start(deployInput(staff))).toEqual({
      code: "already-created",
      ok: false,
    });
    game.current = null;
    expect(await service.start(deployInput(staff))).toEqual({
      code: "not-administered",
      ok: false,
    });
  });

  it("does not complete a creation the chain says nothing about, and records nothing", async () => {
    withoutContract();
    const staff = await seedStaff();
    await publishBoth(staff);
    hideCreated.value = true;
    const done = await runToEnd(deployInput(staff));
    expect(done.state).toBe("indexed_failure");
    expect(done.failureReason).toMatch(/did not report what it made/u);
    expect(await contracts.gameContract(gameId, chain)).toBeNull();
  });
});

describe("what a completed step adds to the record", () => {
  it("is written with the step, so a record that cannot be written leaves the step confirmed", async () => {
    const staff = await seedStaff();
    const collectible = await runToEnd(
      publishInput(staff, collectibleTemplate),
    );
    const { signed, step } = await startAndSign(publishInput(staff));
    await service.submitSigned({ signed, staffId: staff, stepId: step.id });
    network.controls.advance(chain, 3);
    const confirmed = await service.refresh(step.id);
    expect(confirmed.ok && confirmed.step.state).toBe("confirmed");
    // Another record already holds the address (the collectible was published first, so this step's is the second), so the record of
    // this step cannot be written.
    await database
      .update(publishedTemplates)
      .set({ address: "template-2" })
      .where(
        and(
          eq(publishedTemplates.chain, chain),
          eq(publishedTemplates.stepId, collectible.id),
        ),
      );
    expect(await service.refresh(step.id)).toEqual({
      code: "chain-unavailable",
      ok: false,
    });
    const held = (await service.list(null)).find(({ id }) => id === step.id);
    expect(held?.state).toBe("confirmed");
    expect(
      await contracts.publishedTemplate(chain, "game-rewards@1.0.0"),
    ).toBeNull();
  });

  it("refuses to record a second contract for a game on the chain, or two at one address", async () => {
    withoutContract();
    const staff = await seedStaff();
    await runToEnd(publishInput(staff, gameTemplate));
    await runToEnd(publishInput(staff, collectibleTemplate));
    const done = await runToEnd(deployInput(staff));
    const [row] = await database.select().from(gameContracts);
    if (row === undefined) throw new Error("no contract");
    await expect(
      database.insert(gameContracts).values({ ...row, address: "other" }),
    ).rejects.toThrow();
    await expect(
      database.insert(gameContracts).values({ ...row, gameId: "elsewhere" }),
    ).rejects.toThrow();
    expect(done.state).toBe("complete");
  });
});

describe("where a game stands before any step", () => {
  it("has no contract, and templates not ready, until both templates are published", async () => {
    withoutContract();
    const staff = await seedStaff();
    expect(await service.status(gameId)).toEqual({
      contract: null,
      drawingCeiling: 8192,
      templatesReady: false,
    });
    await runToEnd(publishInput(staff, gameTemplate));
    expect((await service.status(gameId))?.templatesReady).toBe(false);
    await runToEnd(publishInput(staff, collectibleTemplate));
    expect((await service.status(gameId))?.templatesReady).toBe(true);
  });

  it("shows the contract and the drawing size it accepts once the game has one, and nothing for a game not administered", async () => {
    expect((await service.status(gameId))?.contract).toEqual({
      address: "rewards-1",
      maxDrawingBytes: 4096,
    });
    game.current = null;
    expect(await service.status(gameId)).toBeNull();
  });
});
