import { maxAdminPayloadChars } from "@frostbite/shared/games";
import { describe, expect, it } from "vitest";

import { encodeBundle } from "../../src/bitcoin-alkanes/admin/bundle.ts";
import { defineMilestoneCall } from "../../src/bitcoin-alkanes/admin/calls.ts";
import {
  planEnvelopeStep,
  type EnvelopeStep,
} from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { StepRefusedError } from "../../src/bitcoin-alkanes/admin/types.ts";
import { maxStandardVirtualBytes } from "../../src/bitcoin-alkanes/tx/standardness.ts";
import {
  fixedKey,
  fundingFor,
  signRemaining,
  tokenOutput,
} from "../support/admin.ts";

// The most code a template may hold (`rewardsPolicy.maxTemplateCodeBytes`, which a test in the configs pins to this).
const largestTemplateBytes = 320 * 1024;

// Bytes that do not compress are the worst case: the transaction carries them as they are.
const incompressible = (length: number) =>
  Uint8Array.from({ length }, (_, index) => (index * 2_654_435_761) % 251);

const stepFor = (code: Uint8Array): EnvelopeStep =>
  planEnvelopeStep(
    defineMilestoneCall({ block: 2n, tx: 1n }, 77n, 3n),
    code,
    fundingFor(tokenOutput, 1_000_000_000n),
    fixedKey(),
  );

// The step as staff leave it: the token's input signed, so the reveal is the transaction that will be sent.
const revealVsize = (step: EnvelopeStep) =>
  signRemaining(step.reveal).extractTransaction(true).virtualSize();

describe("the size of a step that publishes a template", () => {
  it("fits Bitcoin's relay limit and the bound the page and the record share, even for the largest code that does not compress", () => {
    const step = stepFor(incompressible(largestTemplateBytes));
    const payload = encodeBundle(step).length;
    expect(payload).toBeGreaterThan(largestTemplateBytes);
    expect(payload).toBeLessThanOrEqual(maxAdminPayloadChars);
    expect(revealVsize(step)).toBeLessThanOrEqual(maxStandardVirtualBytes);
    // Room is left for the signatures the wallet adds and the JSON around the two transactions.
    expect(maxAdminPayloadChars - payload).toBeGreaterThan(50_000);
  });

  it("holds the ratio the bound was derived from: a step of that many characters is under the relay limit", () => {
    // 5.33 characters per vB, measured on large steps; the bound is taken to be this much text for a 100,000 vB reveal.
    const step = stepFor(incompressible(380_000));
    const ratio = encodeBundle(step).length / revealVsize(step);
    expect(ratio).toBeGreaterThan(5.3);
    expect(ratio).toBeLessThan(5.34);
    expect(maxAdminPayloadChars / ratio).toBeLessThan(maxStandardVirtualBytes);
    expect(maxAdminPayloadChars / ratio).toBeGreaterThan(
      maxStandardVirtualBytes * 0.95,
    );
  });

  it("refuses data whose transaction Bitcoin would not relay, saying so", () => {
    const build = () => stepFor(incompressible(400_000));
    expect(build).toThrow(StepRefusedError);
    expect(build).toThrow(/too large to send.*100,000 vB/);
  });

  it("accepts data just under the limit", () => {
    expect(revealVsize(stepFor(incompressible(395_000)))).toBeLessThanOrEqual(
      maxStandardVirtualBytes,
    );
  });
});
