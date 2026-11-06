import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { createBitcoind, type Bitcoind } from "@repo/regtest/bitcoind";
import { defaultFlags } from "@repo/regtest/config";
import { objectOf } from "@repo/regtest/json";
import {
  chainFamilyIdSchema,
  chainRefSchema,
  jsonValueSchema,
  type ChainConfig,
  type TransactionIntent,
  type SignedTransaction,
  type UnsignedTransaction,
} from "@frostbite/shared/chain";

import {
  createConfiguredRegistry,
  feeCeiling,
  type ConfiguredChain,
} from "../src/configured.ts";
import { createRpcNode } from "../src/bitcoin-alkanes/node/node.ts";
import { feeSpeeds } from "./fee-speeds.ts";
import { createJsonRpc } from "../src/bitcoin-alkanes/node/transport.ts";
import {
  walletRequests,
  withWalletSignatures,
} from "../src/bitcoin-alkanes/wallet-signing.ts";

// The local regtest stack (`pnpm --filter @repo/regtest regtest up`) as a test reaches it. Its addresses and Bitcoin Core's credentials
// are the stack's own defaults (tooling/regtest/src/config.ts): a regtest chain guards nothing.
const gateway = `http://127.0.0.1:${defaultFlags["gateway-port"]}`;
const bitcoindUrl = `http://127.0.0.1:${defaultFlags["bitcoind-port"]}`;
export const templates = join(
  dirname(createRequire(import.meta.url).resolve("../package.json")),
  "../../contracts/templates",
);

// Regtest's CAIP-2 id: `bip122:` and the first 16 bytes of its genesis block hash (0f9188f1…2206).
export const regtestChain = chainRefSchema.parse(
  "bip122:0f9188f13cb7b2c71f2a335e3a4fc328",
);
export const family = chainFamilyIdSchema.parse("bitcoin-alkanes");

export const core: Bitcoind = createBitcoind({
  password: defaultFlags["bitcoind-password"],
  url: bitcoindUrl,
  user: defaultFlags["bitcoind-user"],
  wallet: defaultFlags.wallet,
});
export const node = createRpcNode(
  createJsonRpc({ fetch, timeoutMs: 60_000, url: gateway }),
);

const finality = { kind: "confirmations", required: 1 } as const;
const config: ChainConfig = {
  chainId: regtestChain,
  confirmations: {
    deploy: finality,
    mint: finality,
    "mint-milestone": finality,
    "publish-template": finality,
    "define-milestone": finality,
    "set-claims-paused": finality,
    transfer: finality,
  },
  displayName: "Bitcoin regtest",
  enabled: true,
  family,
  releaseGate: "open",
  role: "test",
};

// The adapter, configured the way the platform configures it for a chain, pointed at the local gateway, with the released templates
// read from the contract build.
export async function regtest() {
  const release = objectOf(
    jsonValueSchema.parse(
      JSON.parse(await readFile(join(templates, "release.json"), "utf8")),
    ),
  );
  const hash = (crate: string) => {
    const sha = objectOf(release?.[crate])?.["sha256"];
    if (typeof sha !== "string")
      throw new Error(`release.json has no hash for ${crate}.`);
    return sha;
  };
  const configured: ConfiguredChain = {
    adapter: {
      kind: "bitcoin-alkanes",
      settings: {
        feeApi: null,
        administration: {
          maxCodeBytes: 512 * 1024,
          maxDrawingBytes: 16_384n,
          random: (length) => crypto.getRandomValues(new Uint8Array(length)),
          read: async (crate) =>
            new Uint8Array(
              await readFile(
                join(
                  templates,
                  "target/wasm32-unknown-unknown/release",
                  `${crate.replaceAll("-", "_")}.wasm`,
                ),
              ),
            ),
          templates: [
            {
              codeHash: hash("game-rewards"),
              crate: "game-rewards",
              version: "1.0.0",
            },
            {
              codeHash: hash("milestone-collectible"),
              crate: "milestone-collectible",
              version: "1.0.0",
            },
          ],
        },
        chain: regtestChain,
        maxPreviewBytes: 16_384,
        network: "regtest",
        now: () => new Date(),
        rpc: { fetch, headers: {}, timeoutMs: 60_000, url: gateway },
        transactions: {
          changeDustSats: 294n,
          random: (length) => crypto.getRandomValues(new Uint8Array(length)),
          templateSequence: {
            attempts: 10,
            first: 1_000_000n,
            window: 1_000_000n,
          },
          claimOutputSats: 546n,
          feeTargetBlocks: 3,
          feeSpeeds,
          lifetimeMs: 30 * 60_000,
        },
      },
    },
    config,
  };
  const registry = createConfiguredRegistry([configured]);
  return {
    funding: feeCeiling(configured, 1_000_000n),
    ports: {
      broadcaster: registry.port(regtestChain, "broadcaster"),
      builder: registry.port(regtestChain, "builder"),
      contracts: registry.port(regtestChain, "contracts"),
      observer: registry.port(regtestChain, "observer"),
      rewards: registry.port(regtestChain, "rewards"),
    },
  };
}

// What the node's wallet does for a step: signs, and finalises, the inputs it owns, one PSBT at a time.
export async function signWithNode(
  unsigned: UnsignedTransaction,
): Promise<SignedTransaction> {
  const requests = walletRequests(unsigned.format, unsigned.payload);
  if (requests === null) throw new Error("not a format this family builds");
  const answers: string[] = [];
  for (const { psbt } of requests) {
    const done = await core.call("walletprocesspsbt", [
      psbt,
      true,
      "ALL",
      true,
      true,
    ]);
    const answer = objectOf(done)?.["psbt"];
    if (typeof answer !== "string")
      throw new Error("the wallet did not answer a PSBT");
    answers.push(answer);
  }
  const payload = withWalletSignatures(
    unsigned.format,
    unsigned.payload,
    answers,
  );
  if (payload === null) throw new Error("the answers do not fit the request");
  return {
    chain: unsigned.chain,
    family: unsigned.family,
    format: unsigned.format,
    payload,
  };
}

export async function newAddress(): Promise<string> {
  const address = await core.call("getnewaddress", ["", "bech32"]);
  if (typeof address !== "string") throw new Error("no address");
  return address;
}

export async function mine(blocks = 1): Promise<void> {
  await core.call("generatetoaddress", [blocks, await newAddress()]);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type Ports = Awaited<ReturnType<typeof regtest>>;

// Builds a step, has the wallet sign it, checks it, sends it, mines blocks, and waits for the indexer to have run it.
export async function runStep(
  ports: {
    readonly builder: Ports["ports"]["builder"];
    readonly funding: Ports["funding"];
  } & Pick<Ports["ports"], "broadcaster" | "observer">,
  intent: TransactionIntent,
) {
  const unsigned = await ports.builder.build(intent, ports.funding);
  const signed = await signWithNode(unsigned);
  const verified = ports.builder.verifySigned(unsigned, signed);
  if (!verified.ok)
    throw new Error(`the platform's check refused: ${verified.reason}`);
  const sent = await ports.broadcaster.broadcast(signed);
  if (sent.kind !== "accepted")
    throw new Error(
      `not accepted: ${JSON.stringify(sent, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`,
    );
  // The indexer holds back the newest block until another follows it (finding S78), so a second block is mined.
  await mine(2);
  for (let turn = 0; turn < 90; turn += 1) {
    const seen = await ports.observer.observe(sent.ref);
    if (seen.status === "confirmed") return { seen, txid: sent.ref.id };
    if (seen.status === "reverted")
      throw new Error("the network reverted the step");
    await sleep(1000);
  }
  throw new Error("the indexer did not run the step in time");
}
