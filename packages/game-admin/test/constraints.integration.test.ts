import { authUsers, gameAdminSteps } from "@ador/database";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  database,
  defineInput,
  registerDatabase,
  seedStaff,
  service,
} from "./support/fixture.ts";

registerDatabase();

// What the table refuses by itself, whatever the service does.
describe("the log of administration", () => {
  it("refuses a row that is not a known operation, or a definition without a milestone", async () => {
    const staff = await seedStaff();
    const started = await service.start(defineInput(staff));
    if (!started.ok) throw new Error("not started");
    const [row] = await database.select().from(gameAdminSteps);
    if (row === undefined) throw new Error("no row");
    const copy = { ...row, id: crypto.randomUUID(), gameId: "other" };
    await expect(
      database.insert(gameAdminSteps).values({ ...copy, operation: "reboot" }),
    ).rejects.toThrow();
    await expect(
      database.insert(gameAdminSteps).values({ ...copy, milestoneId: null }),
    ).rejects.toThrow();
    await expect(
      database
        .insert(gameAdminSteps)
        .values({ ...copy, signedPayload: "signed" }),
    ).rejects.toThrow();
  });

  it("keeps a step, and who built it nulled, when the staff account is removed", async () => {
    const staff = await seedStaff();
    const started = await service.start(defineInput(staff));
    if (!started.ok) throw new Error("not started");
    await database.delete(authUsers).where(eq(authUsers.id, staff));
    const listed = await service.list("arcade");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.createdBy).toBeNull();
  });

  it("refuses a step whose subject or contract does not fit its operation", async () => {
    const staff = await seedStaff();
    const started = await service.start(defineInput(staff));
    if (!started.ok) throw new Error("not started");
    const [row] = await database.select().from(gameAdminSteps);
    if (row === undefined) throw new Error("no row");
    const copy = () => ({ ...row, id: crypto.randomUUID(), gameId: "other" });
    const none = { contractFamily: null, contractId: null };
    const publication = {
      ...copy(),
      ...none,
      gameId: null,
      milestoneId: null,
      operation: "publish-template",
      templateRef: "game-rewards@1.0.0",
    };
    // A publication is about a template and no game.
    for (const wrong of [
      { gameId: "arcade" },
      { templateRef: null },
      { contractFamily: row.contractFamily, contractId: row.contractId },
    ]) {
      await expect(
        database.insert(gameAdminSteps).values({ ...publication, ...wrong }),
      ).rejects.toThrow();
    }
    // A step on a game names the game and no template; a definition or pause acts on the game's contract, a creation on none.
    const creation = {
      ...copy(),
      ...none,
      milestoneId: null,
      operation: "deploy",
    };
    for (const wrong of [
      { templateRef: "game-rewards@1.0.0" },
      { gameId: null },
    ]) {
      await expect(
        database.insert(gameAdminSteps).values({ ...creation, ...wrong }),
      ).rejects.toThrow();
    }
    await expect(
      database.insert(gameAdminSteps).values({ ...copy(), ...none }),
    ).rejects.toThrow();
    await expect(
      database.insert(gameAdminSteps).values({
        ...creation,
        contractFamily: row.contractFamily,
        contractId: row.contractId,
      }),
    ).rejects.toThrow();
    await expect(
      database.insert(gameAdminSteps).values({ ...copy(), contractId: null }),
    ).rejects.toThrow();
    // The well-formed ones are accepted.
    await database.insert(gameAdminSteps).values(publication);
    await database.insert(gameAdminSteps).values(creation);
  });
});
