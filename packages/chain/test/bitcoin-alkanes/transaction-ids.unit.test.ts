import { Psbt } from "bitcoinjs-lib";
import { describe, expect, it } from "vitest";

import { decodeBundle } from "../../src/bitcoin-alkanes/admin/bundle.ts";
import { transactionsOf } from "../../src/bitcoin-alkanes/signed-transactions.ts";
import {
  walletRequests,
  withWalletSignatures,
} from "../../src/bitcoin-alkanes/wallet-signing.ts";
import { signRemaining } from "../support/admin.ts";
import { adminBuilder, funding, intents } from "../support/administration.ts";

const builder = adminBuilder();

// What the wallet sends back for a built step: every input signed, as the platform checks and then sends it.
async function signedStep(intent: Parameters<typeof builder.build>[0]) {
  const unsigned = await builder.build(intent, funding);
  const requests = walletRequests(unsigned.format, unsigned.payload) ?? [];
  const payload = withWalletSignatures(
    unsigned.format,
    unsigned.payload,
    requests.map(({ psbt }) => signRemaining(Psbt.fromBase64(psbt)).toBase64()),
  );
  if (payload === null) throw new Error("the answers did not fit");
  return { ...unsigned, payload };
}

describe("the ids of the transactions a signed step holds", () => {
  it("names the commit and the reveal of a template publish, in the order they are sent, with the ids the network will know them by", async () => {
    const signed = await signedStep(intents.publish);
    const parts = builder.transactionIds(signed);
    expect(parts.map(({ role }) => role)).toEqual(["commit", "reveal"]);
    const bundle = decodeBundle(signed.payload);
    if (bundle === null) throw new Error("not a bundle");
    const sent = transactionsOf(signed)?.map((tx) => tx.getId());
    expect(parts.map(({ id }) => id)).toEqual(sent);
    expect(new Set(parts.map(({ id }) => id)).size).toBe(2);
    for (const { id } of parts) expect(id).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("names a single transaction as just the transaction", async () => {
    const signed = await signedStep(intents.pause);
    const parts = builder.transactionIds(signed);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.role).toBe("transaction");
  });

  it("lists nothing for a step the wallet has not signed", async () => {
    const unsigned = await builder.build(intents.publish, funding);
    expect(builder.transactionIds(unsigned)).toEqual([]);
  });
});
