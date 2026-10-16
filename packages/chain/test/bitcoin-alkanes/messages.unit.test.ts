import { describe, expect, it } from "vitest";

import {
  decodeSimulateResponse,
  encodeBytecodeRequest,
  encodeSimulateRequest,
} from "../../src/bitcoin-alkanes/node/messages.ts";
import {
  formatAlkaneId,
  parseAlkaneId,
} from "../../src/bitcoin-alkanes/node/alkane-id.ts";
import { HexError, fromHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import {
  bytecodeRequestOfTwoZero,
  dieselName,
  dieselNameRequest,
  missingContract,
  unrecognisedOpcode,
} from "../support/recorded.ts";

const diesel = { block: 2n, tx: 0n };

describe("requests", () => {
  it("encode a call as the height and a varint calldata", () => {
    expect(
      encodeSimulateRequest({
        height: 971738,
        inputs: [],
        opcode: 99n,
        target: diesel,
      }),
    ).toBe(dieselNameRequest);
  });

  it("carry the arguments after the opcode, including numbers wider than 64 bits", () => {
    const wide = (1n << 100n) + 5n;
    // Written out by an independent implementation: height 1, calldata 2 0 100 <wide> 7.
    expect(
      encodeSimulateRequest({
        height: 1,
        inputs: [wide, 7n],
        opcode: 100n,
        target: diesel,
      }),
    ).toBe("0x20012a1302006485808080808080808080808080800407");
  });

  it("carry the transaction a call is made in ahead of the height", () => {
    const request = encodeSimulateRequest({
      height: 1,
      inputs: [],
      opcode: 99n,
      target: diesel,
      transaction: Uint8Array.of(0xaa, 0xbb),
    });
    expect(request).toBe("0x1202aabb200 12a03020063".replace(" ", ""));
  });

  it("encode a bytecode request exactly as the Alkanes SDK does", () => {
    expect(encodeBytecodeRequest(diesel)).toBe(bytecodeRequestOfTwoZero);
  });

  it("write both halves of a wide id", () => {
    expect(encodeBytecodeRequest({ block: 1n << 70n, tx: 3n })).toBe(
      "0x0a080a02104012020803",
    );
  });
});

describe("answers recorded from the node", () => {
  it("give the contract's data and the fuel used", () => {
    const answer = decodeSimulateResponse(dieselName);
    expect(answer).toMatchObject({ fuelUsed: 40683n, ok: true });
    expect(answer.ok && new TextDecoder().decode(answer.data)).toBe("DIESEL");
  });

  it("report a revert and a missing contract as errors", () => {
    expect(decodeSimulateResponse(unrecognisedOpcode)).toEqual({
      error: "ALKANES: revert: Error: Unrecognized opcode",
      ok: false,
    });
    expect(decodeSimulateResponse(missingContract)).toEqual({
      error: "unexpected end-of-file (at offset 0x0)",
      ok: false,
    });
  });

  it("give empty data for a call that returns nothing", () => {
    expect(decodeSimulateResponse("0x")).toEqual({
      data: new Uint8Array(),
      fuelUsed: 0n,
      ok: true,
    });
  });
});

describe("ids and hex", () => {
  it("parse and format an Alkane id", () => {
    expect(parseAlkaneId("2:0")).toEqual(diesel);
    expect(formatAlkaneId({ block: 840000n, tx: 123n })).toBe("840000:123");
    const largest = `${(1n << 128n) - 1n}:0`;
    expect(parseAlkaneId(largest)?.block).toBe((1n << 128n) - 1n);
  });

  it("refuse anything else", () => {
    for (const bad of [
      "",
      "2",
      "2:",
      "02:0",
      "2:00",
      "-1:0",
      "2:0:1",
      " 2:0",
      "1e3:0",
      `${1n << 128n}:0`,
    ]) {
      expect(parseAlkaneId(bad), bad).toBeNull();
    }
  });

  it("refuse text that is not whole bytes of hexadecimal", () => {
    expect(fromHex("0x0a0B")).toEqual(Uint8Array.of(10, 11));
    expect(fromHex("")).toEqual(new Uint8Array());
    for (const bad of ["0x0", "zz", "0xg0"]) {
      expect(() => fromHex(bad), bad).toThrow(HexError);
    }
  });
});
