import { describe, expect, it } from "vitest";

import { recordDigest, recordFor, setup } from "./support/service-fixture.ts";

describe("starting a run", () => {
  it("issues a run with the platform's seed, a lifetime from the policy, and the digest of the verifier it will be checked by", async () => {
    const { service, store } = setup({
      game: { verifiable: ["first-win"], verifierSha256: "d".repeat(64) },
    });
    expect(await service.start("player", "any-game")).toEqual({
      ok: true,
      run: {
        expiresAt: "2026-10-16T12:00:00.000Z",
        runId: "run-1",
        seed: 4_000_000_000,
      },
    });
    expect(store.runs.get("run-1")).toMatchObject({
      expiresAt: new Date("2026-10-16T12:00:00.000Z"),
      gameId: "any-game",
      seed: 4_000_000_000,
      state: "issued",
      userId: "player",
      verifierDigest: "d".repeat(64),
    });
  });

  it("says runs are unavailable for a game with no verifier the platform has loaded", async () => {
    const { service, store } = setup({ game: null });
    expect(await service.start("player", "any-game")).toEqual({
      code: "unavailable",
      ok: false,
    });
    expect(store.runs.size).toBe(0);
  });

  it("stops at the open-run limit, per player and game", async () => {
    const { service } = setup();
    for (let n = 0; n < 3; n += 1)
      expect((await service.start("player", "any-game")).ok).toBe(true);
    expect(await service.start("player", "any-game")).toEqual({
      code: "too-many-open-runs",
      ok: false,
    });
    expect((await service.start("someone-else", "any-game")).ok).toBe(true);
  });
});

describe("submitting a run", () => {
  it("settles it once with a verified verdict, keeping only the milestones the manifest says can be replay-verified", async () => {
    const { service, store, verify } = setup();
    await service.start("player", "any-game");
    const record = recordFor(4_000_000_000);
    expect(await service.submit("player", "any-game", "run-1", record)).toEqual(
      {
        ok: true,
        verdict: {
          digest: recordDigest,
          earned: ["first-win"],
          reason: null,
          status: "verified",
        },
      },
    );
    // The verifier was given the record the player sent, parsed.
    expect(verify.mock.calls[0]?.[0]).toBe("any-game");
    expect(verify.mock.calls[0]?.[1]).toEqual(record);
    expect(store.runs.get("run-1")?.state).toBe("submitted");
    expect(store.verdicts.get("run-1")?.recordText).toBe(
      '{"claims":["first-win"],"config":{},"gameId":"any-game","inputs":[],"schemaVersion":1,"seed":4000000000,"verifier":"rules","verifierVersion":1}',
    );
  });

  it("refuses a second submission, whatever it carries, and does not replay it", async () => {
    const { service, verify } = setup();
    await service.start("player", "any-game");
    await service.submit(
      "player",
      "any-game",
      "run-1",
      recordFor(4_000_000_000),
    );
    expect(
      await service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
    ).toEqual({
      code: "already-submitted",
      ok: false,
    });
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("answers another player's run, another game's run and a run that does not exist the same way", async () => {
    const { service, store } = setup();
    await service.start("player", "any-game");
    for (const result of [
      await service.submit(
        "someone-else",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
      await service.submit(
        "player",
        "other-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
      await service.submit(
        "player",
        "any-game",
        "run-99",
        recordFor(4_000_000_000),
      ),
    ])
      expect(result).toEqual({ code: "not-found", ok: false });
    expect(store.runs.get("run-1")?.state).toBe("issued");
  });

  it("spends the seed on a record for another seed, rejecting it without a replay", async () => {
    const { service, store, verify } = setup();
    await service.start("player", "any-game");
    expect(
      await service.submit("player", "any-game", "run-1", recordFor(7)),
    ).toMatchObject({
      ok: true,
      verdict: { earned: [], reason: "seed-mismatch", status: "rejected" },
    });
    expect(verify).not.toHaveBeenCalled();
    expect(store.runs.get("run-1")?.state).toBe("submitted");
    expect(store.verdicts.get("run-1")?.recordText).not.toBeNull();
  });

  it("rejects a claim of a milestone the manifest does not declare replay-verifiable, without a replay", async () => {
    const { service, verify } = setup();
    await service.start("player", "any-game");
    expect(
      await service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000, ["first-win", "first-cashout"]),
      ),
    ).toMatchObject({
      verdict: { reason: "claim-not-verifiable", status: "rejected" },
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects what the replay rejects, with its reason, and a malformed record with nothing kept", async () => {
    const rejected = setup({
      verify: () => ({
        detail: "no",
        digest: recordDigest,
        reason: "illegal-input",
        status: "rejected",
      }),
    });
    await rejected.service.start("player", "any-game");
    expect(
      await rejected.service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
    ).toMatchObject({
      verdict: { earned: [], reason: "illegal-input", status: "rejected" },
    });

    const malformed = setup({
      verify: () => ({
        detail: "bad",
        digest: null,
        reason: "malformed",
        status: "rejected",
      }),
    });
    await malformed.service.start("player", "any-game");
    expect(
      await malformed.service.submit("player", "any-game", "run-1", {
        nonsense: true,
      }),
    ).toMatchObject({
      verdict: { digest: null, reason: "malformed", status: "rejected" },
    });
    expect(malformed.store.verdicts.get("run-1")).toMatchObject({
      recordDigest: null,
      recordText: null,
    });
    // Anything that is not even an object reaches the verifier unchanged, and the run is spent.
    const junk = setup({
      verify: () => ({
        detail: "bad",
        digest: null,
        reason: "malformed",
        status: "rejected",
      }),
    });
    await junk.service.start("player", "any-game");
    await junk.service.submit("player", "any-game", "run-1", "not a record");
    expect(junk.verify.mock.calls[0]?.[1]).toBe("not a record");
  });
});
