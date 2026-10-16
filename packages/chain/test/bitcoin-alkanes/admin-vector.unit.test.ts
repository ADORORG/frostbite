import { Psbt } from "bitcoinjs-lib";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createGameCall,
  defineMilestoneCall,
  pauseCall,
  resumeCall,
} from "../../src/bitcoin-alkanes/admin/calls.ts";
import { planEnvelopeStep } from "../../src/bitcoin-alkanes/admin/envelope-step.ts";
import { planPlainStep } from "../../src/bitcoin-alkanes/admin/plain-step.ts";
import { milestoneKey } from "../../src/bitcoin-alkanes/milestone-key.ts";
import {
  fixedKey,
  fundingFor,
  signRemaining,
  tokenOutput,
} from "../support/admin.ts";

// The transactions the indexer harness sends to a real Alkanes indexer (`contracts/templates/harness/tests/typescript_admin.rs`).
// If the code changes what it builds, this fails until the vector is rewritten and the harness run on the new bytes.
const vector = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../../../../contracts/templates/abi/admin-transaction-vectors.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
) as Record<string, string>;

const hex = (psbt: Psbt) =>
  signRemaining(Psbt.fromBase64(psbt.toBase64())).extractTransaction().toHex();
const game = { block: 2n, tx: 1n };

describe("the administration transactions the indexer harness accepts", () => {
  it("are exactly what the code builds for the same wallet, coins, templates and milestone", () => {
    const key = milestoneKey(vector["milestone"] ?? "");
    expect(key.toString()).toBe(vector["key"]);
    const create = planPlainStep(
      createGameCall(2000n, 1000n, 4096n),
      fundingFor(null),
    );
    const define = planEnvelopeStep(
      defineMilestoneCall(game, key, 2n),
      new TextEncoder().encode(vector["drawing"] ?? ""),
      fundingFor(tokenOutput),
      fixedKey(),
    );
    expect(hex(create.transaction)).toBe(vector["createHex"]);
    expect(hex(define.reveal)).toBe(vector["defineRevealHex"]);
    expect(
      hex(planPlainStep(pauseCall(game), fundingFor(tokenOutput)).transaction),
    ).toBe(vector["pauseHex"]);
    expect(
      hex(planPlainStep(resumeCall(game), fundingFor(tokenOutput)).transaction),
    ).toBe(vector["resumeHex"]);
  });
});
