import { describe, expect, it } from "vitest";

import { configFrom, parseArguments } from "../src/config.ts";

describe("the regtest stack's settings", () => {
  it("separates flags from words, in order, and falls back to the defaults", () => {
    const { flags, words } = parseArguments([
      "mine",
      "--gateway-port=19000",
      "5",
    ]);
    expect(words).toEqual(["mine", "5"]);
    expect(flags["gateway-port"]).toBe("19000");
    expect(flags["bitcoind-port"]).toBe("18443");
  });

  it("refuses a flag it does not have", () => {
    expect(() => parseArguments(["--nope=1"])).toThrow("Unknown flag --nope");
  });

  it("puts state and the built indexer under the package, unless told otherwise", () => {
    const { flags } = parseArguments([]);
    const config = configFrom(flags, "/repo/tooling/regtest");
    expect(config.stateDir).toBe("/repo/tooling/regtest/.regtest");
    expect(config.indexer.logLevel).toBe("info");
    expect(config.indexer.viewMemoryFloorMb).toBe(1024);
    expect(config.indexer.binary).toBe(
      "/repo/tooling/regtest/.regtest/bin/rockshrew-mono",
    );
    expect(config.indexer.alkanesWasm).toBe(
      "/repo/tooling/regtest/.regtest/bin/alkanes.wasm",
    );
    const moved = configFrom(
      parseArguments([
        "--state-dir=/tmp/s",
        "--indexer-binary=/x/bin",
        "--alkanes-wasm=/x/a.wasm",
        "--wallet=w",
      ]).flags,
      "/repo",
    );
    expect(moved.stateDir).toBe("/tmp/s");
    expect(moved.indexer).toMatchObject({
      alkanesWasm: "/x/a.wasm",
      binary: "/x/bin",
    });
    expect(moved.bitcoind.wallet).toBe("w");
  });

  it("refuses a port that is not one", () => {
    for (const bad of ["0", "70000", "x", "1.5"])
      expect(() =>
        configFrom(parseArguments([`--indexer-port=${bad}`]).flags, "/r"),
      ).toThrow("must be a port number");
  });
});
