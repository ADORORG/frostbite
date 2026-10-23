import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { betaChains } from "../../../configs/beta-chains.ts";
import { rewardsPolicy } from "../../../configs/rewards-policy.ts";

const run = promisify(execFile);
const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

const answers: Readonly<Record<string, string | number | object>> = {
  // The genesis block of signet, which the platform uses while BETA_NETWORK is blank: its id's thirty-two digits, padded to a block hash.
  "esplora_block-height": betaChains.signet.chain.chainId
    .slice("bip122:".length)
    .padEnd(64, "0"),
  "esplora_blocks:tip:hash": "00",
  "esplora_blocks:tip:height": 100,
  // The platform asks for the policy's target, whatever it is.
  "esplora_fee-estimates": { [String(rewardsPolicy.feeTargetBlocks)]: 2 },
  metashrew_height: "100",
  metashrew_view: "0x0061736d",
};

// A node on a local port that answers JSON-RPC from the table above.
async function node(): Promise<string> {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += String(chunk)));
    request.on("end", () => {
      const call = JSON.parse(body) as { id: number; method: string };
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          id: call.id,
          jsonrpc: "2.0",
          result: answers[call.method],
        }),
      );
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("no port");
  return `http://127.0.0.1:${address.port}`;
}

const preflight = (args: readonly string[]) =>
  run(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
    cwd: join(import.meta.dirname, ".."),
  }).then(
    ({ stdout }) => ({ code: 0, stdout }),
    (failure: { code: number; stdout: string }) => ({
      code: failure.code,
      stdout: failure.stdout,
    }),
  );

describe("the command", () => {
  it("reads the app's settings file, resolves the templates folder from it, and exits 1 for code that is not the release", async () => {
    const folder = await mkdtemp(join(tmpdir(), "preflight-"));
    await writeFile(join(folder, "game-rewards.wasm"), "not the release");
    await writeFile(
      join(folder, ".env.local"),
      `REWARDS_CHAIN_RPC_URL=${await node()}\nREWARDS_MAX_FEE_SATS=500000\nREWARDS_TEMPLATES_DIR=.\n`,
    );
    const { code, stdout } = await preflight([
      "--env",
      join(folder, ".env.local"),
    ]);
    expect(code).toBe(1);
    expect(stdout).toContain("PASS       Settings");
    expect(stdout).toContain(
      `${join(folder, "game-rewards.wasm")} is not the released code`,
    );
    expect(stdout).toContain("PASS       Indexer is keeping up with the chain");
    expect(stdout).toContain("PASS       Auth-token factory exists");
    expect(stdout).toContain("2 sat/vB");
  });

  it("exits 1 and checks nothing against a node when there is no settings file", async () => {
    const { code, stdout } = await preflight([
      "--env",
      join(tmpdir(), "preflight-absent", ".env.local"),
    ]);
    expect(code).toBe(1);
    expect(stdout).toContain("FAIL       Settings");
    expect(stdout).toContain("SKIPPED   ");
  });
});
