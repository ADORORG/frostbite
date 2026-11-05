import { canonicalJson } from "@frostbite/game-sdk/run-record";
import { describe, expect, it } from "vitest";

import {
  hour,
  recordFor,
  recordDigest,
  setup,
  start,
} from "./support/service-fixture.ts";

describe("submitting a run: size, time and changed rules", () => {
  it("does not keep a record too large to keep, but still gives its digest", async () => {
    const { service, store } = setup();
    await service.start("player", "any-game");
    const big = {
      ...recordFor(4_000_000_000),
      config: { padding: "x".repeat(70_000) },
    };
    expect(
      await service.submit("player", "any-game", "run-1", big),
    ).toMatchObject({ ok: true });
    expect(store.verdicts.get("run-1")?.recordText).toBeNull();
    expect(store.verdicts.get("run-1")?.recordDigest).toBe(recordDigest);
  });

  it("refuses, and spends, a run submitted after its time, and says so ever after", async () => {
    const { clock, service, store, verify } = setup();
    await service.start("player", "any-game");
    clock.now = new Date(start.getTime() + 24 * hour);
    expect(
      await service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
    ).toEqual({
      code: "expired",
      ok: false,
    });
    expect(store.runs.get("run-1")?.state).toBe("expired");
    expect(
      await service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
    ).toEqual({
      code: "expired",
      ok: false,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("accepts a run submitted just inside its time", async () => {
    const { clock, service } = setup();
    await service.start("player", "any-game");
    clock.now = new Date(start.getTime() + 24 * hour - 1);
    expect(
      (
        await service.submit(
          "player",
          "any-game",
          "run-1",
          recordFor(4_000_000_000),
        )
      ).ok,
    ).toBe(true);
  });

  it("refuses, and spends, a run whose game has new rules since it was issued, or has none now", async () => {
    for (const change of [
      { verifiable: ["first-win"], verifierSha256: "c".repeat(64) },
      null,
    ]) {
      const { game, service, store, verify } = setup();
      await service.start("player", "any-game");
      game.current = change;
      expect(
        await service.submit(
          "player",
          "any-game",
          "run-1",
          recordFor(4_000_000_000),
        ),
      ).toEqual({
        code: "stale",
        ok: false,
      });
      expect(store.runs.get("run-1")?.state).toBe("expired");
      expect(verify).not.toHaveBeenCalled();
    }
  });

  it("keeps a record of exactly the largest size, and not one character more", async () => {
    const base = canonicalJson({
      ...recordFor(4_000_000_000),
      config: { p: "" },
    }).length;
    for (const [extra, kept] of [
      [0, true],
      [1, false],
    ] as const) {
      const { service, store } = setup();
      await service.start("player", "any-game");
      const record = {
        ...recordFor(4_000_000_000),
        config: { p: "x".repeat(65_536 - base + extra) },
      };
      expect(canonicalJson(record).length).toBe(65_536 + extra);
      await service.submit("player", "any-game", "run-1", record);
      expect(store.verdicts.get("run-1")?.recordText === null).toBe(!kept);
    }
  });

  it("answers expired, not stale-then-settled, for a run spent when its rules changed once the old rules are back", async () => {
    const { game, service, store, verify } = setup();
    await service.start("player", "any-game");
    const original = game.current;
    game.current = {
      verifiable: ["first-win"],
      verifierSha256: "c".repeat(64),
    };
    await service.submit(
      "player",
      "any-game",
      "run-1",
      recordFor(4_000_000_000),
    );
    game.current = original;
    expect(
      await service.submit(
        "player",
        "any-game",
        "run-1",
        recordFor(4_000_000_000),
      ),
    ).toEqual({ code: "expired", ok: false });
    expect(store.runs.get("run-1")?.state).toBe("expired");
    expect(verify).not.toHaveBeenCalled();
  });
});
