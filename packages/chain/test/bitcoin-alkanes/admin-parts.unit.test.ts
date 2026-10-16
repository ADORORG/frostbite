import { describe, expect, it } from "vitest";

import {
  envelopeData,
  envelopeScript,
} from "../../src/bitcoin-alkanes/admin/envelope.ts";
import {
  dataMatchesSummary,
  packCode,
  sha256Hex,
} from "../../src/bitcoin-alkanes/admin/data.ts";
import { witnessItems } from "../../src/bitcoin-alkanes/admin/witness.ts";
import { toHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { createIndexerClient } from "../../src/bitcoin-alkanes/node/indexer.ts";
import { decodeHoldings } from "../../src/bitcoin-alkanes/node/holdings.ts";
import { MessageWriter } from "../../src/bitcoin-alkanes/node/protobuf.ts";
import { pushData, readPushes } from "../../src/bitcoin-alkanes/tx/script.ts";
import {
  administration,
  gameCode,
  gameKey,
} from "../support/administration.ts";
import { scriptedRpc } from "../support/rpc.ts";

const key = new Uint8Array(32).fill(5);
const number = (value: bigint) => new MessageWriter().varint(1, value).finish();

describe("reading pushes and witnesses back", () => {
  it("reads every form of push `pushData` writes, and nothing it does not", () => {
    for (const length of [0, 1, 75, 76, 255, 256, 520]) {
      const data = Uint8Array.from({ length }, (_v, i) => i % 256);
      const read = readPushes(
        Uint8Array.from([...pushData(data), 0x68]),
        0,
        0x68,
      );
      expect(read?.pushes[0], `${length} bytes`).toEqual(data);
      expect(read?.end).toBe(pushData(data).length);
    }
    expect(readPushes(Uint8Array.from([5, 1, 2]), 0, 0x68)).toBeNull();
    expect(readPushes(Uint8Array.from([0x4c]), 0, 0x68)).toBeNull();
    expect(
      readPushes(Uint8Array.from([0x4e, 1, 0, 0, 0, 1]), 0, 0x68),
    ).toBeNull();
    expect(readPushes(Uint8Array.from([0x51]), 0, 0x68)).toBeNull();
  });

  it("reads a witness, and refuses one that is cut short or has bytes left over", () => {
    const long = new Uint8Array(300).fill(1);
    const witness = Uint8Array.from([3, 1, 9, 0xfd, 0x2c, 0x01, ...long, 0]);
    expect(witnessItems(witness)).toEqual([
      Uint8Array.of(9),
      long,
      new Uint8Array(),
    ]);
    expect(witnessItems(Uint8Array.from([1, 0xfe, 1, 0, 0, 0, 7]))).toEqual([
      Uint8Array.of(7),
    ]);
    expect(witnessItems(Uint8Array.from([1, 0xfe, 1, 0, 0]))).toBeNull();
    expect(witnessItems(Uint8Array.from([1, 0xfd]))).toBeNull();
    expect(witnessItems(Uint8Array.from([1, 0xff]))).toBeNull();
    expect(witnessItems(Uint8Array.from([2, 1, 9]))).toBeNull();
    expect(witnessItems(Uint8Array.from([1, 1, 9, 9]))).toBeNull();
    expect(witnessItems(new Uint8Array())).toBeNull();
  });
});

describe("reading an envelope back", () => {
  const data = Uint8Array.from({ length: 1300 }, (_v, i) => i % 256);

  it("returns the data of a script `envelopeScript` made", () => {
    expect(envelopeData(envelopeScript(key, data))).toEqual(data);
    expect(envelopeData(envelopeScript(key, new Uint8Array()))).toEqual(
      new Uint8Array(),
    );
  });

  it("returns nothing for a script that differs in any part", () => {
    const script = envelopeScript(key, data);
    const changed = (at: number) => {
      const copy = Uint8Array.from(script);
      copy[at] = (copy[at] ?? 0) ^ 1;
      return copy;
    };
    expect(envelopeData(changed(0))).toBeNull();
    expect(envelopeData(changed(33))).toBeNull();
    expect(envelopeData(changed(35))).toBeNull();
    expect(envelopeData(changed(37))).toBeNull();
    expect(envelopeData(script.subarray(0, 40))).toBeNull();
    expect(envelopeData(Uint8Array.from([...script, 0x51]))).toBeNull();
    expect(envelopeData(new Uint8Array())).toBeNull();
    expect(envelopeData(Uint8Array.from([2, 1, 1, 0xac]))).toBeNull();
  });
});

describe("matching data to what was shown", () => {
  const source = {
    operation: "publish-template",
    templateId: "game-rewards",
    templateVersion: "1.0.0",
  } as const;
  const shown = { template: { codeHash: sha256Hex(gameCode) } };

  it("accepts the packed code, and refuses other bytes, other code, or too much", () => {
    expect(
      dataMatchesSummary(source, shown, packCode(gameCode), administration),
    ).toBe(true);
    expect(
      dataMatchesSummary(source, shown, new Uint8Array(20), administration),
    ).toBe(false);
    expect(
      dataMatchesSummary(
        source,
        shown,
        packCode(new Uint8Array(50)),
        administration,
      ),
    ).toBe(false);
    expect(dataMatchesSummary(source, shown, null, administration)).toBe(false);
    expect(
      dataMatchesSummary(source, shown, packCode(gameCode), {
        ...administration,
        maxCodeBytes: 100,
      }),
    ).toBe(false);
    expect(gameKey).toContain("game-rewards");
  });
});

describe("reading what an output holds", () => {
  it("reads the tokens, the script and the value from the indexer's answer", () => {
    const rune = new MessageWriter()
      .bytesField(
        1,
        new MessageWriter()
          .bytesField(1, number(2n))
          .bytesField(2, number(9n))
          .finish(),
      )
      .finish();
    const entry = new MessageWriter()
      .bytesField(1, rune)
      .bytesField(2, number(5n))
      .finish();
    const answer = new MessageWriter()
      .bytesField(1, new MessageWriter().bytesField(1, entry).finish())
      .bytesField(
        3,
        new MessageWriter().bytesField(1, [1, 2, 3]).varint(2, 1000n).finish(),
      )
      .finish();
    expect(decodeHoldings(toHex(answer))).toEqual({
      alkanes: [{ amount: 5n, id: { block: 2n, tx: 9n } }],
      script: Uint8Array.of(1, 2, 3),
      value: 1000n,
    });
  });

  it("reads an output the indexer knows nothing about as holding nothing", () => {
    expect(decodeHoldings("")).toEqual({
      alkanes: [],
      script: new Uint8Array(),
      value: 0n,
    });
  });

  it("asks the indexer about the outpoint, with the transaction id in hashing order", async () => {
    const { calls, rpc } = scriptedRpc({ metashrew_view: "0x" });
    const holdings = await createIndexerClient(rpc).holdings(
      "01".padEnd(64, "0"),
      3,
    );
    expect(holdings.alkanes).toEqual([]);
    expect(calls[0]?.params[0]).toBe("protorunesbyoutpoint");
    expect(String(calls[0]?.params[1])).toContain("0".repeat(60));
    await expect(createIndexerClient(rpc).holdings("01", 0)).rejects.toThrow();
  });
});
