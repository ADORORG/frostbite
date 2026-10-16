import { describe, expect, it } from "vitest";
import type { UnsignedTransaction } from "@ador/shared/chain";

import { chain, claimIntent, sign } from "../support/claims.ts";
import { build, builder } from "../support/verification.ts";

describe("verifying that a transaction does what it was shown to do", () => {
  it("refuses a transaction that does not do what the summary says", async () => {
    const unsigned = await build();
    const signed = sign(unsigned);
    const summarised = (
      summary: Partial<UnsignedTransaction["summary"]>,
    ): UnsignedTransaction => ({
      ...unsigned,
      summary: { ...unsigned.summary, ...summary },
    });
    const mismatch = (candidate: UnsignedTransaction) =>
      builder.verifySigned(candidate, signed);
    expect(
      mismatch(summarised({ fee: { ...unsigned.summary.fee, baseUnits: 1n } })),
    ).toMatchObject({ reason: "summary-mismatch" });
    expect(
      mismatch(
        summarised({
          milestone: { contract: claimIntent.contract, id: "other-win" },
        }),
      ),
    ).toMatchObject({
      reason: "summary-mismatch",
    });
    expect(
      mismatch(
        summarised({
          milestone: {
            contract: { ...claimIntent.contract, id: "9:9" },
            id: "first-frost",
          },
        }),
      ),
    ).toMatchObject({ reason: "summary-mismatch" });
    expect(
      mismatch(
        summarised({
          recipient: {
            chain,
            value:
              "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0",
          },
        }),
      ),
    ).toMatchObject({ reason: "summary-mismatch" });
    expect(mismatch(summarised({ recipient: undefined }))).toMatchObject({
      reason: "summary-mismatch",
    });
    expect(mismatch(summarised({ milestone: undefined }))).toMatchObject({
      reason: "summary-mismatch",
    });
    expect(mismatch(summarised({ operation: "transfer" }))).toMatchObject({
      reason: "summary-mismatch",
    });
    expect(
      mismatch(summarised({ recipient: { chain, value: "nope" } })),
    ).toMatchObject({ reason: "summary-mismatch" });
    expect(
      mismatch(
        summarised({
          milestone: {
            contract: { ...claimIntent.contract, id: "rewards" },
            id: "first-frost",
          },
        }),
      ),
    ).toMatchObject({
      reason: "summary-mismatch",
    });
  });
});
