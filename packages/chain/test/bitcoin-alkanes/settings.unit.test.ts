import { chainRefSchema } from "@ador/shared/chain";
import { describe, expect, it } from "vitest";

import {
  alkanesServices,
  templateEntries,
  type AlkanesChainSettings,
  type TemplateSetting,
} from "../../src/bitcoin-alkanes/settings.ts";
import { templateReadOnlyOpcodes } from "../../src/bitcoin-alkanes/admin/calls.ts";

const game: TemplateSetting = {
  codeHash: "a".repeat(64),
  crate: "game-rewards",
  version: "1.0.0",
};
const collectible: TemplateSetting = {
  codeHash: "b".repeat(64),
  crate: "milestone-collectible",
  version: "1.0.0",
};

describe("template entries", () => {
  it("are keyed by crate and version, with the Alkane, hash and read-only opcode of each", () => {
    const entries = templateEntries([game, collectible], () =>
      Promise.resolve(new Uint8Array()),
    );
    expect([...entries.keys()]).toEqual([
      "game-rewards@1.0.0",
      "milestone-collectible@1.0.0",
    ]);
    expect(entries.get("game-rewards@1.0.0")).toMatchObject({
      codeHash: game.codeHash,
      readOnlyOpcode: templateReadOnlyOpcodes.gameRewards,
    });
    expect(entries.get("milestone-collectible@1.0.0")).toMatchObject({
      readOnlyOpcode: templateReadOnlyOpcodes.collectible,
    });
  });

  it("read each one's own file, and only when asked", async () => {
    const read: string[] = [];
    const entries = templateEntries([game, collectible], (crate) => {
      read.push(crate);
      return Promise.resolve(Uint8Array.of(crate.length));
    });
    expect(read).toEqual([]);
    expect(await entries.get("milestone-collectible@1.0.0")?.load()).toEqual(
      Uint8Array.of("milestone-collectible".length),
    );
    expect(read).toEqual(["milestone-collectible"]);
  });

  it("stop boot on an Alkane that is not block:tx", () => {});
});

describe("the services the adapter is wired to", () => {
  const random = (length: number) => new Uint8Array(length);
  const settings: AlkanesChainSettings = {
    administration: {
      maxCodeBytes: 1000,
      maxDrawingBytes: 2048n,
      random,
      read: () => Promise.resolve(new Uint8Array()),
      templates: [game, collectible],
    },
    chain: chainRefSchema.parse("bip122:00000008819873e925422c1ff0f99f7c"),
    maxPreviewBytes: 512,
    network: "signet",
    now: () => new Date("2026-01-01T00:00:00.000Z"),
    rpc: {
      fetch: () => Promise.reject(new Error("offline")),
      headers: {},
      timeoutMs: 400,
      url: "https://user:key@node.example.invalid/rpc",
    },
    transactions: {
      changeDustSats: 294n,
      templateSequence: { attempts: 200, first: 1000n },
      claimOutputSats: 546n,
      feeTargetBlocks: 3,
      lifetimeMs: 60_000,
    },
  };

  it("carry the limits, the random source and the policy values as given", () => {
    const services = alkanesServices(settings);
    expect(services.maxPreviewBytes).toBe(512);
    expect(services.administration).toMatchObject({
      maxCodeBytes: 1000,
      maxDrawingBytes: 2048n,
      random,
    });
    expect(services.transactions).toMatchObject({
      changeDustSats: 294n,
      templateSequence: { attempts: 200, first: 1000n },
      claimOutputSats: 546n,
      feeTargetBlocks: 3,
      lifetimeMs: 60_000,
      providerId: "node.example.invalid",
    });
    expect(services.transactions?.now()).toEqual(settings.now());
  });

  it("have no administration where none is configured", () => {
    expect(
      alkanesServices({ ...settings, administration: null }).administration,
    ).toBeUndefined();
  });
});
