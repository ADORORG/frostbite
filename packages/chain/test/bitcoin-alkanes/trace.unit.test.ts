import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MessageWriter } from "../../src/bitcoin-alkanes/node/protobuf.ts";
import { toHex } from "../../src/bitcoin-alkanes/node/hex.ts";
import { decodeTraceOutcome } from "../../src/bitcoin-alkanes/node/trace.ts";
import { mainnetSuccessTrace } from "../support/recorded.ts";

// Traces the Alkanes indexer itself recorded for a claim that succeeded and one that reverted (`contracts/templates/harness`).
const vectors = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../contracts/templates/abi/trace-vectors.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as { readonly failure: string; readonly success: string };

describe("a trace the indexer recorded", () => {
  it("reads as a success when the outer call exited with the success flag", () => {
    expect(decodeTraceOutcome(vectors.success)).toBe("success");
  });

  it("reads the trace a live mainnet node returned", () => {
    expect(decodeTraceOutcome(mainnetSuccessTrace)).toBe("success");
  });

  it("reads as a failure when the outer call reverted, even though inner calls may have succeeded", () => {
    expect(decodeTraceOutcome(vectors.failure)).toBe("failure");
  });

  it("is read from the last exit, so a failing inner call that was handled does not fail the transaction", () => {
    const exit = (status: bigint) =>
      new MessageWriter()
        .bytesField(2, new MessageWriter().varint(1, status).finish())
        .finish();
    const trace = (...statuses: bigint[]) =>
      toHex(
        statuses
          .reduce(
            (writer, status) => writer.bytesField(1, exit(status)),
            new MessageWriter(),
          )
          .finish(),
      );
    expect(decodeTraceOutcome(trace(1n, 0n))).toBe("success");
    expect(decodeTraceOutcome(trace(0n, 1n))).toBe("failure");
    expect(decodeTraceOutcome(trace(0n))).toBe("success");
  });

  it("is none when the indexer holds no trace, or the trace has no exit", () => {
    expect(decodeTraceOutcome("0x")).toBe("none");
    expect(decodeTraceOutcome("")).toBe("none");
    const enterOnly = toHex(
      new MessageWriter()
        .bytesField(1, new MessageWriter().bytesField(1, []).finish())
        .finish(),
    );
    expect(decodeTraceOutcome(enterOnly)).toBe("none");
  });

  it("ignores fields that are not events", () => {
    const other = toHex(
      new MessageWriter().varint(3, 1n).bytesField(2, [1, 2]).finish(),
    );
    expect(decodeTraceOutcome(other)).toBe("none");
  });
});
