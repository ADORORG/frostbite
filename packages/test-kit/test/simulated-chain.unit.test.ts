import { describe, expect, it } from "vitest";

import { createChainRegistry } from "@ador/chain/registry";
import { InvalidAddressError } from "@ador/chain/ports";
import { chainRefSchema, contractRefSchema } from "@ador/shared/chain";

import { simulatedAddress } from "../src/simulated-chain/address.ts";
import { simulatedChainConfig } from "../src/simulated-chain/config.ts";
import {
  one,
  simulated,
  simulatedPorts,
  three,
  two,
} from "./support/chains.ts";

describe("simulated address format", () => {
  it("binds an address to its chain", () => {
    const { need, sender } = simulatedPorts();
    expect(need("addressCodec").parse(one, sender.value)).toEqual(sender);
    expect(() => need("addressCodec").parse(two, sender.value)).toThrow(
      InvalidAddressError,
    );
    expect(() =>
      need("addressCodec").parse(
        chainRefSchema.parse("eip155:1"),
        sender.value,
      ),
    ).toThrow(/not a simulated chain/u);
  });

  it("rejects an address that names another chain even when its checksum is right", () => {
    const { need } = simulatedPorts();
    // Same body, but the text names chain `two` while carrying chain `one`'s checksum.
    const forged = `sim:two:a1b2c3${simulatedAddress(one, "a1b2c3").value.slice(-2)}`;
    expect(() => need("addressCodec").parse(one, forged)).toThrow(
      InvalidAddressError,
    );
  });

  it("rejects a bad checksum and non-canonical case", () => {
    const { need } = simulatedPorts();
    const good = simulatedAddress(one, "a1b2c3").value;
    expect(() =>
      need("addressCodec").parse(one, `${good.slice(0, -2)}00`),
    ).toThrow(InvalidAddressError);
    expect(() => need("addressCodec").parse(one, good.toUpperCase())).toThrow(
      InvalidAddressError,
    );
  });
});

describe("simulated reads and contracts", () => {
  it("reads the head and balances, advancing only when told", async () => {
    const { controls, need, recipient, sender } = simulatedPorts();
    const before = await need("reader").head(one);
    controls.advance(one, 2);
    expect((await need("reader").head(one)).height).toBe(before.height + 2);
    expect(await need("reader").balances(sender)).toEqual([
      { asset: { chain: one, id: "sim", kind: "native" }, baseUnits: 100n },
    ]);
    expect(await need("reader").balances(recipient)).toEqual([
      { asset: { chain: one, id: "sim", kind: "native" }, baseUnits: 0n },
    ]);
    expect(
      await need("reader").balances(sender, [
        { chain: one, id: "other", kind: "fungible" },
      ]),
    ).toEqual([]);
    expect(
      await need("reader").balances(sender, [
        { chain: two, id: "sim", kind: "native" },
      ]),
    ).toEqual([]);
    expect(() => controls.advance(three, 1)).toThrow(/not simulated here/u);
  });

  it("simulates a transfer against the balance, and other operations as free of balance checks", async () => {
    const { intent, need, recipient } = simulatedPorts();
    expect(await need("contracts").simulate(intent)).toMatchObject({
      ok: true,
    });
    const broke = { ...intent, sender: recipient };
    expect(await need("contracts").simulate(broke)).toEqual({
      ok: false,
      reason: "insufficient balance",
    });
    expect(
      await need("contracts").simulate({
        chain: one,
        operation: "deploy",
        sender: recipient,
        templateId: "t",
        templateVersion: "1.0.0",
      }),
    ).toMatchObject({ ok: true });
    const ref = contractRefSchema.parse({
      chain: one,
      family: "simulated",
      id: "c",
    });
    expect((await need("contracts").inspect(ref)).exists).toBe(false);
  });
});

describe("the registry and the simulated family", () => {
  it("serves a test chain, and refuses to serve a public chain", () => {
    const { adapter } = simulated();
    expect(
      createChainRegistry({
        adapters: [adapter],
        chains: [simulatedChainConfig(one)],
      }).supports(one, "chain:read"),
    ).toBe(true);
    expect(() =>
      createChainRegistry({
        adapters: [adapter],
        chains: [simulatedChainConfig(one, "public-beta")],
      }),
    ).toThrow(/Test-only adapter simulated/u);
  });
});
