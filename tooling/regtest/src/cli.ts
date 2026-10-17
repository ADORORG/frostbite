import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { jsonValueSchema, type JsonValue } from "@ador/shared/chain";

import { configFrom, parseArguments, type RegtestConfig } from "./config.ts";
import { createGateway } from "./gateway.ts";
import { objectOf } from "./json.ts";
import { serveGateway } from "./serve.ts";
import {
  nodeOf,
  prepareWallet,
  runningProcesses,
  startBitcoind,
  startGateway,
  startIndexer,
  stopStack,
} from "./stack.ts";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "cli.ts");

// Regtest has no fee market; the platform asks for a rate and gets this one (satoshis per virtual byte) for every target.
const regtestFeeEstimates = { "1": 2, "3": 2, "6": 2 } as const;

const usage = `Local regtest stack for the rewards chain.

  up                    start Bitcoin Core (in Docker), the Alkanes indexer and the gateway; mine the first blocks
  down [--wipe]         stop them (--wipe also forgets the chain and the indexer's database)
  status                heights of the chain and the indexer, and whether the processes run
  address               a new address of the node's wallet (to use as a signer, or to fund)
  mine <blocks>         mine blocks to the wallet
  fund <address> <btc>  send coins from the wallet and mine a block
  sign-psbt <base64>    have the node's wallet sign and finalise the inputs it owns (what a wallet does for a step)
  gateway               run the gateway in the foreground (\`up\` does this for you)

Flags: --name=value (see src/config.ts).`;

async function indexerCall(
  config: RegtestConfig,
  method: string,
  params: readonly JsonValue[],
): Promise<JsonValue> {
  const response = await fetch(`http://127.0.0.1:${config.indexer.port}`, {
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const reply = objectOf(jsonValueSchema.parse(await response.json()));
  const failure = objectOf(reply?.["error"]);
  if (failure !== null)
    throw new Error(
      String(failure["message"] ?? "The indexer refused the call."),
    );
  return reply?.["result"] ?? null;
}

async function newAddress(config: RegtestConfig): Promise<string> {
  const address = await nodeOf(config, true).call("getnewaddress", [
    "",
    "bech32",
  ]);
  if (typeof address !== "string")
    throw new Error("The wallet gave no address.");
  return address;
}

async function mine(config: RegtestConfig, blocks: number): Promise<void> {
  await nodeOf(config, true).call("generatetoaddress", [
    blocks,
    await newAddress(config),
  ]);
}

async function main(): Promise<void> {
  const { flags, words } = parseArguments(process.argv.slice(2));
  const config = configFrom(flags, join(here, ".."));
  const [command, first, second] = words;
  switch (command) {
    case "up": {
      await startBitcoind(config);
      await prepareWallet(config);
      await startIndexer(config);
      await startGateway(config, entry);
      console.log(
        `Regtest is up. Point REWARDS_CHAIN_RPC_URL at http://127.0.0.1:${config.gatewayPort}`,
      );
      return;
    }
    case "down":
      await stopStack(
        config,
        words.includes("--wipe") || process.argv.includes("--wipe"),
      );
      console.log("Regtest is stopped.");
      return;
    case "status": {
      const height = await nodeOf(config)
        .call("getblockcount")
        .catch(() => null);
      const indexed = await indexerCall(config, "metashrew_height", []).catch(
        () => null,
      );
      console.log(
        JSON.stringify(
          {
            chainHeight: height,
            indexedHeight: indexed,
            processes: runningProcesses(config),
          },
          null,
          2,
        ),
      );
      return;
    }
    case "address":
      console.log(await newAddress(config));
      return;
    case "mine":
      await mine(config, Number(first ?? 1));
      return;
    case "fund": {
      if (first === undefined || second === undefined) throw new Error(usage);
      console.log(
        await nodeOf(config, true).call("sendtoaddress", [
          first,
          Number(second),
        ]),
      );
      await mine(config, 1);
      return;
    }
    case "sign-psbt": {
      if (first === undefined) throw new Error(usage);
      const signed = objectOf(
        await nodeOf(config, true).call("walletprocesspsbt", [
          first,
          true,
          "DEFAULT",
          true,
          true,
        ]),
      );
      console.log(signed?.["psbt"]);
      return;
    }
    case "gateway": {
      const gateway = createGateway({
        bitcoin: nodeOf(config),
        feeEstimates: regtestFeeEstimates,
        indexer: (method, params) => indexerCall(config, method, params),
      });
      await serveGateway({ gateway, port: config.gatewayPort });
      console.log(`Gateway on http://127.0.0.1:${config.gatewayPort}`);
      return;
    }
    default:
      console.log(usage);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
