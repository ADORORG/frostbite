import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { loadGameVerifiers, type VerifiableGame } from "../src/loader.ts";
import { runVerifierConformance } from "../src/conformance.ts";
import { resolveVerificationPolicy } from "../src/policy.ts";
import { createInProcessRunner, type VerifierRunner } from "../src/runner.ts";
import { verifyRun } from "../src/verify.ts";
import { buildArtifact, handWritten } from "./support/artifact.ts";

const firstParty = createInProcessRunner({ replayTimeoutMs: 300 });
const sha = (code: string) => createHash("sha256").update(code).digest("hex");
const game = (
  code: string,
  over: Partial<VerifiableGame> = {},
): VerifiableGame => ({
  id: "tally-game",
  verification: { replay: { id: "tally", sha256: sha(code), version: 2 } },
  ...over,
});
const load = (
  games: VerifiableGame[],
  artifacts: Record<string, string | null>,
  extra: { sandboxed?: VerifierRunner; first?: string[] } = {},
) =>
  loadGameVerifiers({
    firstParty: new Set(extra.first ?? ["tally-game"]),
    games,
    readArtifact: async (id) => artifacts[id] ?? null,
    runners: {
      firstParty,
      ...(extra.sandboxed === undefined ? {} : { sandboxed: extra.sandboxed }),
    },
  });

describe("loading the verifiers games publish, with nothing about any game in the platform", () => {
  it("registers a game it has never heard of from its manifest and its pinned artifact, and replays runs with it", async () => {
    const { code } = await buildArtifact();
    const { problems, registry } = await load([game(code)], {
      "tally-game": code,
    });
    expect(problems).toEqual([]);
    expect(registry.gameIds()).toEqual(["tally-game"]);
    const sample = registry.find("tally-game")?.sample;
    expect(verifyRun(registry, sample)).toMatchObject({
      earned: ["reached"],
      status: "verified",
    });
    expect(
      verifyRun(registry, { ...sample, claims: ["perfect"] }),
    ).toMatchObject({ reason: "claim-not-earned" });
    expect(
      verifyRun(registry, { ...sample, inputs: [{ data: 7, type: "add" }] }),
    ).toMatchObject({
      detail: "add takes 1, 2 or 3",
      reason: "illegal-input",
    });
    expect(
      verifyRun(registry, { ...sample, config: { target: 0 } }),
    ).toMatchObject({ reason: "invalid-config" });
  });

  it("holds the loaded verifier to the conformance checks, like any other", async () => {
    const { code } = await buildArtifact();
    const { registry } = await load([game(code)], { "tally-game": code });
    const entry = registry.find("tally-game");
    if (entry === undefined) throw new Error("Not registered");
    expect(runVerifierConformance(entry).filter(({ ok }) => !ok)).toEqual([]);
  });

  it("answers a game's rules that never return as a failure of the verifier, quickly, and keeps serving", async () => {
    const { code } = await buildArtifact();
    const { registry } = await load([game(code)], { "tally-game": code });
    const sample = registry.find("tally-game")?.sample;
    const started = Date.now();
    expect(
      verifyRun(registry, {
        ...sample,
        claims: [],
        inputs: [{ type: "spin" }],
      }),
    ).toMatchObject({
      detail: "The verifier failed or took too long.",
      reason: "verifier-error",
    });
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(verifyRun(registry, sample).status).toBe("verified");
  });

  it.each([
    ["text that is not JSON", "'not json'"],
    ["JSON that is not an outcome", "'{}'"],
  ])(
    "answers %s as a failure of the verifier, in the one wording, and keeps serving",
    async (_name, answer) => {
      // A real build, wrapped so that one input makes it answer wrongly while the sample the platform checks it with is answered rightly.
      const built = await buildArtifact();
      const code = `${built.code}\n{ const real = globalThis.__adorReplay; globalThis.__adorReplay = (record) => record.includes('"garble"') ? ${answer} : real(record); }`;
      const { registry } = await load([game(code)], { "tally-game": code });
      const sample = registry.find("tally-game")?.sample;
      expect(
        verifyRun(registry, {
          ...sample,
          claims: [],
          inputs: [{ type: "garble" }],
        }),
      ).toMatchObject({
        detail: "The verifier did not answer with an outcome.",
        reason: "verifier-error",
      });
      expect(verifyRun(registry, sample).status).toBe("verified");
    },
  );

  it("ignores a game that publishes no verifier, without a problem", async () => {
    const { problems, registry } = await load([{ id: "plain-game" }], {});
    expect(problems).toEqual([]);
    expect(registry.gameIds()).toEqual([]);
  });

  it("refuses an artifact that is not the file the manifest pins, saying what the digest is", async () => {
    const { code } = await buildArtifact();
    const { problems, registry } = await load([game(code)], {
      "tally-game": `${code} `,
    });
    expect(registry.gameIds()).toEqual([]);
    expect(problems).toEqual([
      expect.objectContaining({
        gameId: "tally-game",
        reason: "digest-mismatch",
        detail: expect.stringContaining(sha(`${code} `)),
      }),
    ]);
  });

  it("reports an artifact that is not there, and does not register the game", async () => {
    const { code } = await buildArtifact();
    const { problems, registry } = await load([game(code)], {});
    expect(problems).toMatchObject([
      { gameId: "tally-game", reason: "missing-artifact" },
    ]);
    expect(registry.gameIds()).toEqual([]);
  });

  it("refuses an artifact that is not the rules the manifest names: another id, or another version", async () => {
    const { code } = await buildArtifact();
    for (const replay of [
      { id: "other", sha256: sha(code), version: 2 },
      { id: "tally", sha256: sha(code), version: 3 },
    ]) {
      const { problems } = await load(
        [game(code, { verification: { replay } })],
        { "tally-game": code },
      );
      expect(problems).toMatchObject([{ reason: "identity-mismatch" }]);
    }
  });

  it("reports a script that does not publish a verifier, and one whose sample is not a run of this game", async () => {
    const notAVerifier = "var x = 1;";
    expect(
      (await load([game(notAVerifier)], { "tally-game": notAVerifier }))
        .problems,
    ).toMatchObject([{ reason: "load-failed" }]);
    const meta = JSON.stringify({ id: "tally", version: 2 });
    for (const sample of [
      "not json",
      "{}",
      JSON.stringify({ gameId: "another-game" }),
    ]) {
      const code = handWritten("() => 'x'", sample, meta);
      expect(
        (await load([game(code)], { "tally-game": code })).problems,
      ).toMatchObject([{ reason: "bad-sample" }]);
    }
  });

  it("answers a verifier that returns something that is not an outcome as a failure of the verifier", async () => {
    const { code } = await buildArtifact();
    const sample = (
      await load([game(code)], { "tally-game": code })
    ).registry.find("tally-game")?.sample;
    const meta = JSON.stringify({ id: "tally", version: 2 });
    for (const answer of [
      "'not json'",
      "'{}'",
      "'{\"ok\":true}'",
      '\'{"ok":true,"earned":[1]}\'',
      '\'{"ok":false,"reason":"other","detail":"","index":null}\'',
    ]) {
      const bad = handWritten(`() => ${answer}`, JSON.stringify(sample), meta);
      const { registry } = await load([game(bad)], { "tally-game": bad });
      expect(verifyRun(registry, sample)).toMatchObject({
        reason: "verifier-error",
      });
    }
  });

  it("gives outside games' artifacts only to a sandboxed runner, and keeps them self-reported when there is none", async () => {
    const { code } = await buildArtifact();
    const outside = game(code, { id: "tally-game" });
    const refused = await load(
      [outside],
      { "tally-game": code },
      { first: [] },
    );
    expect(refused.problems).toMatchObject([{ reason: "no-sandbox" }]);
    expect(refused.registry.gameIds()).toEqual([]);
    const sandboxed: VerifierRunner = {
      load: vi.fn((script) => firstParty.load(script)),
    };
    const allowed = await load(
      [outside],
      { "tally-game": code },
      { first: [], sandboxed },
    );
    expect(allowed.problems).toEqual([]);
    expect(sandboxed.load).toHaveBeenCalledTimes(1);
    // A first-party game never goes through the sandboxed runner.
    const spy: VerifierRunner = {
      load: vi.fn(() => {
        throw new Error("not for first-party");
      }),
    };
    await load([outside], { "tally-game": code }, { sandboxed: spy });
    expect(spy.load).not.toHaveBeenCalled();
  });

  it("keeps a game's problem from stopping the others", async () => {
    const { code } = await buildArtifact();
    const second = { ...game(code), id: "tally-game" };
    const broken: VerifiableGame = {
      id: "broken-game",
      verification: { replay: { id: "x", sha256: "0".repeat(64), version: 1 } },
    };
    const { problems, registry } = await load([broken, second], {
      "tally-game": code,
      "broken-game": "x",
    });
    expect(problems.map(({ gameId }) => gameId)).toEqual(["broken-game"]);
    expect(registry.gameIds()).toEqual(["tally-game"]);
  });

  it("checks a record against the policy's limits before it is replayed", async () => {
    const { code } = await buildArtifact();
    const { registry } = await load([game(code)], { "tally-game": code });
    const sample = registry.find("tally-game")?.sample;
    expect(
      verifyRun(registry, sample, resolveVerificationPolicy({ maxInputs: 1 }))
        .status,
    ).toBe("verified");
    const many = {
      ...sample,
      claims: [],
      inputs: Array.from({ length: 3 }, () => ({ data: 1, type: "add" })),
    };
    expect(
      verifyRun(registry, many, resolveVerificationPolicy({ maxInputs: 2 })),
    ).toMatchObject({
      reason: "too-many-inputs",
    });
  });
});
