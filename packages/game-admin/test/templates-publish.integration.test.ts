import { describe, expect, it } from "vitest";

import {
  collectibleTemplate,
  contracts,
  chain,
  gameId,
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
    expect(started.step.summary.template?.at?.id).toBe("at-1");

    const done = await runToEnd(publishInput(staff));
    expect(done).toMatchObject({ id: started.step.id, state: "complete" });
    const recorded = await contracts.publishedTemplate(
      chain,
      "game-rewards@1.0.0",
    );
    expect(recorded).toMatchObject({
      address: "at-1",
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
      publishInput(staff, collectibleTemplate, "at-2"),
    );
    if (!first.ok || !second.ok) throw new Error("not started");
    expect(second.resumed).toBe(false);
    expect(second.step.id).not.toBe(first.step.id);
    expect(second.step.templateRef).toBe("milestone-collectible@1.0.0");
  });

  it("refuses what the platform did not decide to publish, what is published, and an address that is taken", async () => {
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
    expect(await start(publishInput(staff, collectibleTemplate, "at-1"))).toBe(
      "address-taken",
    );
    expect(await start(publishInput(staff, collectibleTemplate, "at-2"))).toBe(
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
