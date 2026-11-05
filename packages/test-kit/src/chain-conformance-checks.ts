import assert from "node:assert/strict";

import {
  portCapabilities,
  portNames,
  type ChainAdapter,
} from "@frostbite/chain/adapter";
import { InvalidAddressError } from "@frostbite/chain/ports";
import {
  broadcastOutcomeSchema,
  observationSchema,
  unsignedTransactionSchema,
  type ChainRef,
  type FundingPolicy,
  type SignedTransaction,
  type TransactionIntent,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";

export interface ChainConformanceFixtures {
  readonly address: {
    readonly canonical: string;
    // Wrong in shape, checksum, or case: must be refused, never repaired.
    readonly invalid: readonly string[];
  };
  readonly chain: ChainRef;
  // Addresses that are valid on another chain this adapter serves: must be refused here.
  readonly crossChain: readonly string[];
  // Required once the adapter declares the builder port.
  readonly transaction?: {
    readonly funding: FundingPolicy;
    readonly intent: TransactionIntent;
    readonly now: () => Date;
    // Stand-in for the wallet bridge: signs what was built, and alters what was signed.
    readonly sign: (unsigned: UnsignedTransaction) => SignedTransaction;
    readonly tamper: (signed: SignedTransaction) => SignedTransaction;
  };
  readonly unservedChain: ChainRef;
}

function transactionFixtures(
  fixtures: ChainConformanceFixtures,
): NonNullable<ChainConformanceFixtures["transaction"]> {
  assert.ok(fixtures.transaction, "the fixtures must cover a declared builder");
  return fixtures.transaction;
}

function port<Name extends keyof ChainAdapter["ports"]>(
  adapter: ChainAdapter,
  name: Name,
): NonNullable<ChainAdapter["ports"][Name]> {
  const found = adapter.ports[name];
  assert.ok(found, `the adapter declares ${name} but does not provide it`);
  return found;
}

export function checkCapabilityConsistency(adapter: ChainAdapter): void {
  for (const name of portNames) {
    assert.equal(
      adapter.capabilities.has(portCapabilities[name]),
      adapter.ports[name] !== undefined,
      `${name} is declared and provided inconsistently`,
    );
  }
}

export function checkAddressCodec(
  adapter: ChainAdapter,
  fixtures: ChainConformanceFixtures,
): void {
  const codec = port(adapter, "addressCodec");
  const parsed = codec.parse(fixtures.chain, fixtures.address.canonical);
  assert.equal(
    parsed.chain,
    fixtures.chain,
    "a parsed address stays on its chain",
  );
  assert.deepEqual(
    codec.parse(fixtures.chain, parsed.value),
    parsed,
    "parsing a canonical address is stable",
  );
  const refused = [...fixtures.address.invalid, ...fixtures.crossChain];
  for (const text of refused) {
    assert.throws(
      () => codec.parse(fixtures.chain, text),
      InvalidAddressError,
      `${text} must be refused with InvalidAddressError`,
    );
  }
  assert.throws(
    () => codec.parse(fixtures.unservedChain, fixtures.address.canonical),
    InvalidAddressError,
    "an unserved chain must be refused",
  );
  assert.equal(
    adapter.supports(fixtures.chain),
    true,
    "the adapter supports its own chain",
  );
  assert.equal(
    adapter.supports(fixtures.unservedChain),
    false,
    "the adapter does not claim a chain it cannot serve",
  );
}

export async function checkSummaryFidelity(
  adapter: ChainAdapter,
  fixtures: ChainConformanceFixtures,
): Promise<UnsignedTransaction> {
  const { funding, intent, now } = transactionFixtures(fixtures);
  const unsigned = await port(adapter, "builder").build(intent, funding);
  assert.ok(
    unsignedTransactionSchema.safeParse(unsigned).success,
    "the result matches its schema",
  );
  assert.equal(
    unsigned.chain,
    intent.chain,
    "the built transaction is on the intent's chain",
  );
  assert.equal(
    unsigned.family,
    adapter.family,
    "the built transaction names the adapter's family",
  );
  const { summary } = unsigned;
  assert.equal(
    summary.operation,
    intent.operation,
    "the summary names the built operation",
  );
  if (intent.operation === "transfer") {
    assert.deepEqual(
      summary.recipient,
      intent.recipient,
      "the recipient shown is the recipient built",
    );
    assert.deepEqual(
      summary.amount,
      intent.amount,
      "the amount shown is the amount built",
    );
  }
  if (intent.operation === "mint-milestone") {
    assert.deepEqual(
      summary.milestone,
      { contract: intent.contract, id: intent.milestoneId },
      "the milestone and contract shown are the ones built",
    );
    assert.deepEqual(
      summary.recipient,
      intent.sender,
      "a claim is shown as received by the one who makes it",
    );
  }
  assert.ok(
    Date.parse(summary.expiresAt) > now().getTime(),
    "a fresh summary has not expired",
  );
  assert.ok(
    summary.fee.baseUnits <= funding.maxFee.baseUnits,
    "the fee respects the funding policy",
  );
  return unsigned;
}

export async function checkSigningVerification(
  adapter: ChainAdapter,
  fixtures: ChainConformanceFixtures,
): Promise<SignedTransaction> {
  const builder = port(adapter, "builder");
  const unsigned = await checkSummaryFidelity(adapter, fixtures);
  const { sign, tamper } = transactionFixtures(fixtures);
  const signed = sign(unsigned);
  assert.deepEqual(
    builder.verifySigned(unsigned, signed),
    { ok: true },
    "what the wallet signed verifies",
  );
  const altered = builder.verifySigned(unsigned, tamper(signed));
  assert.equal(
    altered.ok,
    false,
    "a tampered signed transaction must not verify",
  );
  return signed;
}

export async function checkBroadcastAndObservation(
  adapter: ChainAdapter,
  fixtures: ChainConformanceFixtures,
): Promise<void> {
  const signed = await checkSigningVerification(adapter, fixtures);
  const broadcaster = port(adapter, "broadcaster");
  const first = await broadcaster.broadcast(signed);
  const second = await broadcaster.broadcast(signed);
  assert.ok(
    broadcastOutcomeSchema.safeParse(first).success,
    "the outcome matches its schema",
  );
  if ("ref" in first && "ref" in second) {
    assert.deepEqual(
      first.ref,
      second.ref,
      "broadcasting twice never yields two transaction ids",
    );
  }
  // The fixture is a valid, funded transaction: it is either accepted or, if the network cannot
  // say, ambiguous. Anything else would let the observation below be skipped silently.
  assert.ok(
    first.kind === "accepted" || first.kind === "ambiguous",
    `the fixture transaction must be accepted or ambiguous, not ${first.kind}`,
  );
  {
    const observer = port(adapter, "observer");
    const one = await observer.observe(first.ref);
    const two = await observer.observe(first.ref);
    assert.ok(
      observationSchema.safeParse(one).success,
      "the observation matches its schema",
    );
    assert.deepEqual(
      one.ref,
      first.ref,
      "the observation is of the asked transaction",
    );
    assert.deepEqual(
      {
        block: one.block,
        confirmations: one.confirmations,
        status: one.status,
      },
      {
        block: two.block,
        confirmations: two.confirmations,
        status: two.status,
      },
      "observing the same state twice returns equivalent evidence",
    );
  }
}

export async function checkReader(
  adapter: ChainAdapter,
  fixtures: ChainConformanceFixtures,
): Promise<void> {
  const reader = port(adapter, "reader");
  const head = await reader.head(fixtures.chain);
  assert.equal(
    head.chain,
    fixtures.chain,
    "the head is on the requested chain",
  );
  const owner = port(adapter, "addressCodec").parse(
    fixtures.chain,
    fixtures.address.canonical,
  );
  for (const amount of await reader.balances(owner)) {
    assert.equal(
      amount.asset.chain,
      fixtures.chain,
      "balances stay on the owner's chain",
    );
  }
}
