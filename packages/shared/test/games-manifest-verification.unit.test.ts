import { describe, expect, it } from "vitest";

import {
  gameManifestHash,
  gameManifestSchema,
  gameMilestoneSchema,
  gameReplayVerifierSchema,
} from "../src/games/index.ts";

const sha = "a".repeat(64);
const milestone = {
  claimPolicy: "once",
  criteria: "Win a board.",
  description: "You won.",
  id: "first-win",
  title: "First win",
} as const;
const manifest = (over: object = {}) => ({
  capabilities: [],
  description: "",
  id: "sample-game",
  launch: { mode: "embedded" },
  milestones: [milestone],
  network: "bip122:00000008819873e925422c1ff0f99f7c",
  schemaVersion: 1,
  summary: "A game.",
  tags: ["arcade"],
  title: "Sample",
  version: "1",
  ...over,
});
const verified = {
  capabilities: ["run:submit"],
  milestones: [{ ...milestone, verification: "replay-verified" }],
  verification: { replay: { id: "ice-field", sha256: sha, version: 1 } },
};
const accepts = (value: object) => gameManifestSchema.safeParse(value).success;
const message = (value: object) => {
  const result = gameManifestSchema.safeParse(value);
  return result.success
    ? null
    : result.error.issues.map(({ message }) => message).join(" | ");
};

describe("a milestone's verification", () => {
  it("is self-reported unless it says otherwise, and a manifest with none declared is unchanged", () => {
    expect(gameMilestoneSchema.parse(milestone).verification).toBeUndefined();
    expect(
      gameMilestoneSchema.parse({ ...milestone, verification: "self-reported" })
        .verification,
    ).toBe("self-reported");
    expect(
      gameMilestoneSchema.safeParse({ ...milestone, verification: "verified" })
        .success,
    ).toBe(false);
    // Nothing about verification is in a manifest that declares none, so its digest does not move.
    expect(gameManifestHash(gameManifestSchema.parse(manifest()))).toBe(
      gameManifestHash(gameManifestSchema.parse(manifest())),
    );
    expect(Object.keys(gameManifestSchema.parse(manifest()))).not.toContain(
      "verification",
    );
  });

  it("can be replay-verified only for a milestone earned once, with no target", () => {
    expect(
      gameMilestoneSchema.safeParse({
        ...milestone,
        verification: "replay-verified",
      }).success,
    ).toBe(true);
    for (const bad of [
      {
        ...milestone,
        claimPolicy: "repeatable",
        maxCount: 5,
        verification: "replay-verified",
      },
      { ...milestone, target: 5, verification: "replay-verified" },
    ])
      expect(gameMilestoneSchema.safeParse(bad).success).toBe(false);
    expect(
      gameMilestoneSchema.safeParse({
        ...milestone,
        target: 5,
        verification: "replay-verified",
      }).error?.issues[0]?.message,
    ).toContain("replay-verified");
  });
});

describe("a game's replay verifier", () => {
  it("is the rules' id, their version and the digest of the artifact, and nothing else", () => {
    expect(
      gameReplayVerifierSchema.safeParse({
        id: "ice-field",
        sha256: sha,
        version: 1,
      }).success,
    ).toBe(true);
    for (const bad of [
      { id: "Ice Field", sha256: sha, version: 1 },
      { id: "ice-field", sha256: "A".repeat(64), version: 1 },
      { id: "ice-field", sha256: "a".repeat(63), version: 1 },
      { id: "ice-field", sha256: sha, version: 0 },
      { id: "ice-field", sha256: sha, version: 1.5 },
      { id: "ice-field", sha256: sha, version: 0x1_0000 },
      { id: "ice-field", sha256: sha, version: 1, extra: true },
    ])
      expect(gameReplayVerifierSchema.safeParse(bad).success).toBe(false);
  });

  it("is accepted for a game the platform plays, that declares run:submit and a milestone to verify", () => {
    expect(accepts(manifest(verified))).toBe(true);
    expect(
      gameManifestSchema.parse(manifest(verified)).verification?.replay.id,
    ).toBe("ice-field");
  });

  it("needs the run:submit capability, which is how a run is sent to be checked", () => {
    expect(message(manifest({ ...verified, capabilities: [] }))).toContain(
      "run:submit",
    );
    expect(
      message(manifest({ ...verified, capabilities: ["wallet"] })),
    ).toContain("run:submit");
  });

  it("is refused for a game the platform does not play, because its artifact comes with its files", () => {
    const external = {
      launch: { basePath: "", mode: "external", returnUrl: null, url: null },
    };
    expect(message(manifest({ ...verified, ...external }))).toContain(
      "plays itself",
    );
  });

  it("needs a milestone that asks for it, and a milestone cannot ask for it without one", () => {
    expect(
      message(manifest({ ...verified, milestones: [milestone] })),
    ).toContain("at least one milestone");
    expect(
      message(
        manifest({
          milestones: [{ ...milestone, verification: "replay-verified" }],
        }),
      ),
    ).toContain("publishes no replay verifier");
  });

  it("is a different manifest, with a different digest, from the same game without it", () => {
    const plain = gameManifestSchema.parse(manifest());
    const withVerifier = gameManifestSchema.parse(manifest(verified));
    expect(gameManifestHash(withVerifier)).not.toBe(gameManifestHash(plain));
    const other = gameManifestSchema.parse(
      manifest({
        ...verified,
        verification: {
          replay: { id: "ice-field", sha256: "b".repeat(64), version: 1 },
        },
      }),
    );
    expect(gameManifestHash(other)).not.toBe(gameManifestHash(withVerifier));
  });
});
