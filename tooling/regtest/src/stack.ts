import { execFile, spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { createBitcoind, type Bitcoind } from "./bitcoind.ts";
import type { RegtestConfig } from "./config.ts";

const run = promisify(execFile);

// The blocks a fresh chain needs before its first coinbase can be spent.
export const matureBlocks = 101;

export function nodeOf(config: RegtestConfig, wallet = false): Bitcoind {
  return createBitcoind({
    password: config.bitcoind.password,
    url: `http://127.0.0.1:${config.bitcoind.rpcPort}`,
    user: config.bitcoind.user,
    ...(wallet ? { wallet: config.bitcoind.wallet } : {}),
  });
}

async function docker(args: readonly string[]): Promise<string> {
  const { stdout } = await run("docker", [...args]);
  return stdout.trim();
}

async function containerState(
  name: string,
): Promise<"missing" | "running" | "stopped"> {
  try {
    return (await docker(["inspect", "-f", "{{.State.Running}}", name])) ===
      "true"
      ? "running"
      : "stopped";
  } catch {
    return "missing";
  }
}

async function until<T>(
  what: string,
  attempt: () => Promise<T | null>,
  seconds = 60,
): Promise<T> {
  for (let tries = 0; tries < seconds; tries += 1) {
    try {
      const found = await attempt();
      if (found !== null) return found;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Gave up waiting for ${what}.`);
}

// Starts Bitcoin Core in regtest mode in a container whose RPC is published on the loopback interface only.
export async function startBitcoind(config: RegtestConfig): Promise<void> {
  const { bitcoind } = config;
  const state = await containerState(bitcoind.container);
  if (state === "missing")
    await docker([
      "run",
      "-d",
      "--name",
      bitcoind.container,
      "-p",
      `127.0.0.1:${bitcoind.rpcPort}:18443`,
      bitcoind.image,
      "-regtest=1",
      "-server=1",
      "-txindex=1",
      "-fallbackfee=0.0002",
      `-rpcuser=${bitcoind.user}`,
      `-rpcpassword=${bitcoind.password}`,
      "-rpcbind=0.0.0.0",
      "-rpcallowip=0.0.0.0/0",
    ]);
  else if (state === "stopped") await docker(["start", bitcoind.container]);
  const core = nodeOf(config);
  await until("Bitcoin Core", async () => core.call("getblockcount"));
}

// The node's wallet, made on first use, and enough mined blocks that it has coins to spend.
export async function prepareWallet(config: RegtestConfig): Promise<string> {
  const core = nodeOf(config);
  const loaded = await core.call("listwallets");
  const names = Array.isArray(loaded) ? loaded : [];
  if (!names.includes(config.bitcoind.wallet)) {
    try {
      await core.call("loadwallet", [config.bitcoind.wallet]);
    } catch {
      await core.call("createwallet", [config.bitcoind.wallet]);
    }
  }
  const wallet = nodeOf(config, true);
  const address = await wallet.call("getnewaddress", ["", "bech32"]);
  if (typeof address !== "string")
    throw new Error("The wallet gave no address.");
  const height = await core.call("getblockcount");
  if (typeof height === "number" && height < matureBlocks)
    await wallet.call("generatetoaddress", [matureBlocks - height, address]);
  return address;
}

const pidFile = (config: RegtestConfig, name: string) =>
  join(config.stateDir, `${name}.pid`);

function startedProcess(config: RegtestConfig, name: string): number | null {
  try {
    const pid = Number(readFileSync(pidFile(config, name), "utf8"));
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

// Runs a command in the background, with its output in the state directory, and remembers its process id.
async function background(
  config: RegtestConfig,
  name: string,
  command: string,
  args: readonly string[],
  logLevel?: string,
): Promise<void> {
  if (startedProcess(config, name) !== null) return;
  await mkdir(config.stateDir, { recursive: true });
  const log = openSync(join(config.stateDir, `${name}.log`), "a");
  const child = spawn(command, [...args], {
    detached: true,
    // The indexer is silent unless asked; its log is what explains a block it is slow on.
    env: {
      ...process.env,
      ...(logLevel === undefined ? {} : { RUST_LOG: logLevel }),
    },
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  child.unref();
  if (child.pid === undefined) throw new Error(`${name} did not start.`);
  writeFileSync(pidFile(config, name), String(child.pid));
}

export async function startIndexer(config: RegtestConfig): Promise<void> {
  const { indexer, bitcoind } = config;
  for (const path of [indexer.binary, indexer.alkanesWasm])
    if (!existsSync(path))
      throw new Error(
        `${path} is missing. Build the indexer first: tooling/regtest/scripts/build-indexer.sh`,
      );
  await background(
    config,
    "indexer",
    indexer.binary,
    [
      "--daemon-rpc-url",
      `http://127.0.0.1:${bitcoind.rpcPort}`,
      "--auth",
      `${bitcoind.user}:${bitcoind.password}`,
      "--indexer",
      indexer.alkanesWasm,
      "--db-path",
      join(config.stateDir, "indexer-db"),
      "--host",
      "127.0.0.1",
      "--port",
      String(indexer.port),
      "--start-block",
      "0",
      "--cors",
      "*",
      "--reorg-check-threshold",
      "0",
      "--view-memory-floor-mb",
      String(indexer.viewMemoryFloorMb),
    ],
    indexer.logLevel,
  );
}

export async function startGateway(
  config: RegtestConfig,
  entry: string,
): Promise<void> {
  await background(config, "gateway", process.execPath, [
    "--experimental-strip-types",
    entry,
    "gateway",
    `--gateway-port=${config.gatewayPort}`,
    `--indexer-port=${config.indexer.port}`,
    `--bitcoind-port=${config.bitcoind.rpcPort}`,
    `--bitcoind-user=${config.bitcoind.user}`,
    `--bitcoind-password=${config.bitcoind.password}`,
  ]);
}

// Stops the indexer and gateway and the node's container. The chain and the indexer's database are kept unless `wipe` is set.
export async function stopStack(
  config: RegtestConfig,
  wipe: boolean,
): Promise<void> {
  for (const name of ["gateway", "indexer"]) {
    const pid = startedProcess(config, name);
    if (pid !== null) process.kill(pid);
    rmSync(pidFile(config, name), { force: true });
  }
  const state = await containerState(config.bitcoind.container);
  if (state === "running") await docker(["stop", config.bitcoind.container]);
  if (wipe) {
    if (state !== "missing")
      await docker(["rm", "-f", config.bitcoind.container]);
    rmSync(join(config.stateDir, "indexer-db"), {
      force: true,
      recursive: true,
    });
  }
}

export function runningProcesses(
  config: RegtestConfig,
): Record<string, number | null> {
  return {
    gateway: startedProcess(config, "gateway"),
    indexer: startedProcess(config, "indexer"),
  };
}
