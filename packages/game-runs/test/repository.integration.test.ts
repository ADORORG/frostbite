import { describe, expect, it } from "vitest";

import type { SubmitDecision } from "../src/repository.ts";
import {
  clock,
  digest,
  hooks,
  hour,
  newRun,
  registerDatabase,
  repository,
  runOf,
  seedUser,
  verified,
} from "./support/database.ts";

registerDatabase();

const settle =
  (earned?: string[]): (() => SubmitDecision) =>
  () => ({
    kind: "settle",
    verdict: verified(earned),
  });
const keyOf = (run: { gameId: string; id: string; userId: string }) => ({
  gameId: run.gameId,
  runId: run.id,
  userId: run.userId,
});

describe("issuing runs in PostgreSQL", () => {
  it("stores the run as issued, with every field the platform gave it", async () => {
    const userId = await seedUser();
    const run = newRun(userId);
    expect(await repository.issue(run, 3)).toEqual({ ok: true });
    expect(await runOf(run.id)).toMatchObject({
      expiresAt: run.expiresAt,
      gameId: "any-game",
      issuedAt: run.issuedAt,
      seed: 4_000_000_000,
      state: "issued",
      submittedAt: null,
      userId,
      verdict: null,
      verifierDigest: digest,
    });
  });

  it("holds the open-run limit however many starts arrive together, per player and game", async () => {
    const userId = await seedUser();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => repository.issue(newRun(userId), 3)),
    );
    expect(results.filter(({ ok }) => ok)).toHaveLength(3);
    expect(results.filter(({ ok }) => !ok)).toEqual(
      Array.from({ length: 5 }, () => ({
        code: "too-many-open-runs",
        ok: false,
      })),
    );
    // Another game and another player have room of their own.
    expect((await repository.issue(newRun(userId, "other-game"), 3)).ok).toBe(
      true,
    );
    expect((await repository.issue(newRun(await seedUser()), 3)).ok).toBe(true);
  });

  it("does not count a run left open past its time, and marks it expired, so a player is not locked out", async () => {
    const userId = await seedUser();
    const old = [newRun(userId), newRun(userId), newRun(userId)];
    for (const run of old) await repository.issue(run, 3);
    expect((await repository.issue(newRun(userId), 3)).ok).toBe(false);
    clock.now = new Date(clock.now.getTime() + 25 * hour);
    expect(
      (
        await repository.issue(
          newRun(userId, "any-game", {
            expiresAt: new Date(clock.now.getTime() + 24 * hour),
            issuedAt: clock.now,
          }),
          3,
        )
      ).ok,
    ).toBe(true);
    for (const run of old) expect((await runOf(run.id))?.state).toBe("expired");
  });

  it("does not count submitted runs against the limit", async () => {
    const userId = await seedUser();
    const runs = [newRun(userId), newRun(userId)];
    for (const run of runs) {
      await repository.issue(run, 2);
      await repository.submit(keyOf(run), settle());
    }
    expect((await repository.issue(newRun(userId), 2)).ok).toBe(true);
  });
});

describe("submitting a run in PostgreSQL", () => {
  it("settles it with the verdict, the record and the time, and tells the milestone hook what it earned", async () => {
    const userId = await seedUser();
    const run = newRun(userId);
    await repository.issue(run, 3);
    clock.now = new Date(clock.now.getTime() + hour);
    const result = await repository.submit(
      keyOf(run),
      settle(["first-win", "first-glacier"]),
    );
    expect(result).toMatchObject({
      ok: true,
      run: { id: run.id, state: "submitted" },
    });
    expect(await runOf(run.id)).toMatchObject({
      earned: ["first-win", "first-glacier"],
      recordDigest: "b".repeat(64),
      recordText: '{"claims":[]}',
      state: "submitted",
      submittedAt: clock.now,
      verdict: "verified",
      verdictReason: null,
    });
    expect(hooks.calls).toEqual([
      { earned: ["first-win", "first-glacier"], runId: run.id },
    ]);
  });

  it("keeps the score of a verified run, with zero as a score, and none for a run that has no score", async () => {
    const userId = await seedUser();
    const [scored, zero, none] = [
      newRun(userId),
      newRun(userId),
      newRun(userId),
    ];
    for (const run of [scored, zero, none]) await repository.issue(run, 5);
    for (const [run, score] of [
      [scored, 4_210],
      [zero, 0],
      [none, null],
    ] as const)
      await repository.submit(keyOf(run), () => ({
        kind: "settle",
        verdict: verified([], score),
      }));
    expect((await runOf(scored.id))?.score).toBe(4_210);
    expect((await runOf(zero.id))?.score).toBe(0);
    expect((await runOf(none.id))?.score).toBeNull();
  });

  it("stores a rejection with its reason, and does not call the milestone hook for it or for a run that earned nothing", async () => {
    const userId = await seedUser();
    const [rejected, nothing] = [newRun(userId), newRun(userId)];
    await repository.issue(rejected, 3);
    await repository.issue(nothing, 3);
    await repository.submit(keyOf(rejected), () => ({
      kind: "settle",
      verdict: {
        earned: ["first-win"],
        reason: "illegal-input",
        recordDigest: null,
        recordText: null,
        score: null,
        status: "rejected",
      },
    }));
    await repository.submit(keyOf(nothing), settle([]));
    expect(await runOf(rejected.id)).toMatchObject({
      recordDigest: null,
      recordText: null,
      verdict: "rejected",
      verdictReason: "illegal-input",
    });
    expect(hooks.calls).toEqual([]);
  });

  it("settles a run once, however many submissions arrive together, and the milestone hook runs once", async () => {
    const userId = await seedUser();
    const run = newRun(userId);
    await repository.issue(run, 3);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        repository.submit(keyOf(run), (stored) =>
          stored.state === "issued"
            ? { kind: "settle", verdict: verified() }
            : { code: "already-submitted", expire: false, kind: "refuse" },
        ),
      ),
    );
    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(results.filter(({ ok }) => !ok)).toEqual(
      Array.from({ length: 5 }, () => ({
        code: "already-submitted",
        ok: false,
      })),
    );
    expect(hooks.calls).toHaveLength(1);
  });

  it("answers another player's run, another game's run and a run that does not exist as not found, and changes nothing", async () => {
    const owner = await seedUser();
    const run = newRun(owner);
    await repository.issue(run, 3);
    const decide = () => {
      throw new Error(
        "decide must not be called for a run that is not the caller's",
      );
    };
    for (const key of [
      { ...keyOf(run), userId: await seedUser() },
      { ...keyOf(run), gameId: "other-game" },
      { ...keyOf(run), runId: newRun(owner).id },
    ])
      expect(await repository.submit(key, decide)).toEqual({
        code: "not-found",
        ok: false,
      });
    expect((await runOf(run.id))?.state).toBe("issued");
  });

  it("spends a run the service refuses as expired or stale, and leaves one that is only refused open", async () => {
    const userId = await seedUser();
    const [spent, kept, already] = [
      newRun(userId),
      newRun(userId),
      newRun(userId),
    ];
    for (const run of [spent, kept, already]) await repository.issue(run, 5);
    expect(
      await repository.submit(keyOf(spent), () => ({
        code: "stale",
        expire: true,
        kind: "refuse",
      })),
    ).toEqual({ code: "stale", ok: false });
    expect(
      await repository.submit(keyOf(kept), () => ({
        code: "expired",
        expire: false,
        kind: "refuse",
      })),
    ).toEqual({ code: "expired", ok: false });
    await repository.submit(keyOf(already), settle());
    // Refusing a run that is not open never reopens or changes it.
    await repository.submit(keyOf(already), () => ({
      code: "expired",
      expire: true,
      kind: "refuse",
    }));
    expect((await runOf(spent.id))?.state).toBe("expired");
    expect((await runOf(kept.id))?.state).toBe("issued");
    expect((await runOf(already.id))?.state).toBe("submitted");
  });

  it("rolls the whole settlement back when the milestone write fails, so no verdict stands without its milestones", async () => {
    const userId = await seedUser();
    const run = newRun(userId);
    await repository.issue(run, 3);
    hooks.fail = true;
    await expect(repository.submit(keyOf(run), settle())).rejects.toThrow(
      "the milestone write failed",
    );
    expect(await runOf(run.id)).toMatchObject({
      state: "issued",
      submittedAt: null,
      verdict: null,
    });
    hooks.fail = false;
    expect((await repository.submit(keyOf(run), settle())).ok).toBe(true);
  });
});
