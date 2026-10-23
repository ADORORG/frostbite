import { maxAdminPayloadChars } from "@ador/shared/games";
import { describe, expect, it } from "vitest";

import { encodeBundle } from "../../src/bitcoin-alkanes/admin/bundle.ts";
import { defineMilestoneCall } from "../../src/bitcoin-alkanes/admin/calls.ts";
import { planEnvelopeStep } from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { fixedKey, fundingFor } from "../support/admin.ts";

// The most code a template may hold (`rewardsPolicy.maxTemplateCodeBytes`, which a test in the configs pins to this).
const largestTemplateBytes = 512 * 1024;

describe("the size of a step that publishes a template", () => {
  it("fits the bound the page and the platform's record share, even for code that does not compress", () => {
    // Bytes that do not compress are the worst case: the transaction carries them as they are.
    const code = Uint8Array.from(
      { length: largestTemplateBytes },
      (_, index) => (index * 2_654_435_761) % 251,
    );
    const step = planEnvelopeStep(
      defineMilestoneCall({ block: 2n, tx: 1n }, 77n, 3n),
      code,
      fundingFor(null, 1_000_000_000n),
      fixedKey(),
    );
    const payload = encodeBundle(step).length;
    expect(payload).toBeGreaterThan(largestTemplateBytes);
    expect(payload).toBeLessThanOrEqual(maxAdminPayloadChars);
    // Room is left for the signatures the wallet adds and the JSON around the two transactions.
    expect(maxAdminPayloadChars - payload).toBeGreaterThan(50_000);
  });
});
