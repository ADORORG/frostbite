import { join } from "node:path";

// The local regtest stack, as typed defaults. Everything here is for one machine: ports are bound to the loopback interface and the
// node's credentials are throwaway values that guard nothing (a regtest chain has no value). Any of them can be changed with a
// `--name=value` flag on the command.
export interface RegtestConfig {
  readonly bitcoind: {
    readonly container: string;
    readonly image: string;
    readonly password: string;
    readonly rpcPort: number;
    readonly user: string;
    // The node's wallet that mines and funds.
    readonly wallet: string;
  };
  readonly gatewayPort: number;
  readonly indexer: {
    readonly alkanesWasm: string;
    readonly binary: string;
    // The indexer's log level (`info` shows what the wasm prints about each call; `debug` shows far more).
    readonly logLevel: string;
    readonly port: number;
    // The host memory below which the indexer refuses new view calls. Its own default (8 GB free) suits a server, not a laptop
    // with other work running.
    readonly viewMemoryFloorMb: number;
  };
  // Where the stack keeps its processes' ids, logs and the indexer's database.
  readonly stateDir: string;
}

export const defaultFlags = {
  "alkanes-wasm": "",
  "bitcoind-container": "ador-regtest-bitcoind",
  "bitcoind-image": "ruimarinho/bitcoin-core:24",
  "bitcoind-password": "ador-regtest-only",
  "bitcoind-port": "18443",
  "bitcoind-user": "ador",
  "gateway-port": "18081",
  "indexer-binary": "",
  "indexer-log-level": "info",
  "indexer-port": "18080",
  "indexer-view-memory-floor-mb": "1024",
  "state-dir": "",
  wallet: "ador",
} as const;

export type FlagName = keyof typeof defaultFlags;

// `--name=value` flags and the words that are not flags, in order.
export function parseArguments(args: readonly string[]): {
  readonly flags: Readonly<Record<FlagName, string>>;
  readonly words: readonly string[];
} {
  const flags: Record<FlagName, string> = { ...defaultFlags };
  const words: string[] = [];
  for (const argument of args) {
    const match = /^--([a-z-]+)=(.*)$/u.exec(argument);
    if (match === null) {
      words.push(argument);
      continue;
    }
    const name = match[1];
    if (name === undefined || !(name in defaultFlags))
      throw new Error(`Unknown flag --${name ?? ""}.`);
    flags[name as FlagName] = match[2] ?? "";
  }
  return { flags, words };
}

function port(value: string, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65_535)
    throw new Error(`--${name} must be a port number.`);
  return number;
}

export function configFrom(
  flags: Readonly<Record<FlagName, string>>,
  root: string,
): RegtestConfig {
  const stateDir =
    flags["state-dir"] === "" ? join(root, ".regtest") : flags["state-dir"];
  return {
    bitcoind: {
      container: flags["bitcoind-container"],
      image: flags["bitcoind-image"],
      password: flags["bitcoind-password"],
      rpcPort: port(flags["bitcoind-port"], "bitcoind-port"),
      user: flags["bitcoind-user"],
      wallet: flags.wallet,
    },
    gatewayPort: port(flags["gateway-port"], "gateway-port"),
    indexer: {
      alkanesWasm:
        flags["alkanes-wasm"] === ""
          ? join(stateDir, "bin", "alkanes.wasm")
          : flags["alkanes-wasm"],
      binary:
        flags["indexer-binary"] === ""
          ? join(stateDir, "bin", "rockshrew-mono")
          : flags["indexer-binary"],
      logLevel: flags["indexer-log-level"],
      port: port(flags["indexer-port"], "indexer-port"),
      viewMemoryFloorMb: Number(flags["indexer-view-memory-floor-mb"]),
    },
    stateDir,
  };
}
