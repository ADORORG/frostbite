import { describe, expect, it } from "vitest";

import {
  collectibleTemplate,
  contracts,
  chain,
  gameId,
  placement,
  publishInput,
  registerDatabase,
  seedStaff,
  service,
  startAndSign,
} from "./support/fixture.ts";
import { runToEnd } from "./support/run.ts";

registerDatabase();

describe("publishing a template", () => {
  it("is about no game, shows where the code goes, and is recorded when it completes", async () => {
    const staff = await seedStaff();
    const started = await service.start(publishInput(staff));
    if (!started.ok) throw new Error("not started");
    expect(started.step).toMatchObject({
      gameId: null,
      operation: "publish-template",
      state: "awaiting_signature",
      templateRef: "game-rewards@1.0.0",
    });
    expect(started.step.summary.template?.at?.id).toBe("template-1");

    const done = await runToEnd(publishInput(staff));
    expect(done).toMatchObject({ id: started.step.id, state: "complete" });
    const recorded = await contracts.publishedTemplate(
      chain,
      "game-rewards@1.0.0",
    );
    expect(recorded).toMatchObject({
      address: "template-1",
      codeHash: started.step.summary.template?.codeHash,
    });
    expect(
      (await service.templates()).map(({ templateRef }) => templateRef),
    ).toEqual(["game-rewards@1.0.0"]);
    expect((await service.list(null)).map(({ id }) => id)).toEqual([
      started.step.id,
    ]);
    expect(await service.list(gameId)).toEqual([]);
  });

  it("is not recorded before it completes", async () => {
    const staff = await seedStaff();
    await startAndSign(publishInput(staff));
    expect(
      await contracts.publishedTemplate(chain, "game-rewards@1.0.0"),
    ).toBeNull();
    expect(await service.templates()).toEqual([]);
  });

  it("returns the step in progress when asked again", async () => {
    const staff = await seedStaff();
    const first = await service.start(publishInput(staff));
    const again = await service.start(publishInput(staff));
    if (!first.ok || !again.ok) throw new Error("not started");
    expect(again.resumed).toBe(true);
    expect(again.step.id).toBe(first.step.id);
  });

  it("keeps the publications of two templates apart while both are in progress", async () => {
    const staff = await seedStaff();
    const first = await service.start(publishInput(staff));
    const second = await service.start(
      publishInput(staff, collectibleTemplate),
    );
    if (!first.ok || !second.ok) throw new Error("not started");
    expect(second.resumed).toBe(false);
    expect(second.step.id).not.toBe(first.step.id);
    expect(second.step.templateRef).toBe("milestone-collectible@1.0.0");
    // The first is not on the chain yet, but its address is spoken for: the second is not given the same one.
    expect(first.step.summary.template?.at?.id).toBe("template-1");
    expect(second.step.summary.template?.at?.id).toBe("template-2");
  });

  it("says so, and builds nothing, when the chain finds no free address", async () => {
    const staff = await seedStaff();
    placement.exhausted = true;
    const result = await service.start(publishInput(staff));
    expect(result).toEqual({
      code: "could-not-build",
      ok: false,
      reason: "No free address was found for the template.",
    });
    expect(await service.list(null)).toEqual([]);
  });

  it("refuses what the platform did not decide to publish, and what is published", async () => {
    const staff = await seedStaff();
    const start = (input: ReturnType<typeof publishInput>) =>
      service
        .start(input)
        .then((result) => (result.ok ? "started" : result.code));
    expect(
      await start(
        publishInput(staff, { id: "something-else", version: "1.0.0" }),
      ),
    ).toBe("unknown-template");
    expect(
      await start(
        publishInput(staff, { id: "game-rewards", version: "9.9.9" }),
      ),
    ).toBe("unknown-template");
    expect(await start({ ...publishInput(staff), gameId })).toBe(
      "not-administered",
    );
    await runToEnd(publishInput(staff));
    expect(await start(publishInput(staff))).toBe("already-published");
    expect(await start(publishInput(staff, collectibleTemplate))).toBe(
      "started",
    );
  });

  it("is refused for a wallet that is not an address on the chain", async () => {
    const staff = await seedStaff();
    const result = await service.start({
      ...publishInput(staff),
      wallet: "not-an-address",
    });
    expect(result).toEqual({ code: "wrong-chain", ok: false });
  });
});
