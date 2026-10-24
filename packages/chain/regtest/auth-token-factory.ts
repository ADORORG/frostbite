import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Address } from "@ador/shared/chain";

import { sha256Hex } from "../src/bitcoin-alkanes/admin/data.ts";
import { templateKey } from "../src/bitcoin-alkanes/admin/templates.ts";
import { createTransactionBuilder } from "../src/bitcoin-alkanes/builder.ts";
import {
  family,
  node,
  regtestChain,
  runStep,
  templates,
  type Ports,
} from "./stack.ts";

// Where the auth-token factory lives (`AUTH_TOKEN_FACTORY_ID`, 0xffed, in the reserved block): the game template calls it to make a
// game's auth token. Mainnet has it; a fresh regtest chain does not, so it is deployed once from the code the indexer was built with.
const authTokenFactory = "4:65517";

export async function ensureAuthTokenFactory(
  ports: Ports,
  sender: Address,
): Promise<void> {
  const at = { chain: regtestChain, family, id: authTokenFactory };
  if ((await ports.ports.contracts.inspect(at)).exists) return;
  const code = new Uint8Array(
    await readFile(
      join(templates, "../../tooling/regtest/.regtest/bin/auth-token.wasm"),
    ),
  );
  const builder = createTransactionBuilder(
    new Map([[regtestChain, { network: "regtest" as const, node }]]),
    {
      changeDustSats: 294n,
      random: (length) => crypto.getRandomValues(new Uint8Array(length)),
      templateSequence: { attempts: 10, first: 1_000_000n, window: 1_000_000n },
      claimOutputSats: 546n,
      feeTargetBlocks: 3,
      feeSpeeds: {
        fast: { approxMinutes: 30, targetBlocks: 3 },
        lightning: { approxMinutes: 15, targetBlocks: 1 },
        medium: { approxMinutes: 60, targetBlocks: 6 },
        slow: { approxMinutes: 250, targetBlocks: 25 },
      },
      lifetimeMs: 30 * 60_000,
      now: () => new Date(),
      providerId: "regtest",
    },
    family,
    {
      maxCodeBytes: 512 * 1024,
      maxDrawingBytes: 0n,
      random: (length) => crypto.getRandomValues(new Uint8Array(length)),
      templates: new Map([
        [
          templateKey("auth-token", "1.0.0"),
          {
            codeHash: sha256Hex(code),
            load: async () => code,
            readOnlyOpcode: 100n,
          },
        ],
      ]),
    },
  );
  await runStep(
    {
      broadcaster: ports.ports.broadcaster,
      builder,
      funding: ports.funding,
      observer: ports.ports.observer,
    },
    {
      chain: regtestChain,
      operation: "publish-template",
      sender,
      templateAt: at,
      templateId: "auth-token",
      templateVersion: "1.0.0",
    },
  );
  if (!(await ports.ports.contracts.inspect(at)).exists)
    throw new Error("the auth-token factory was not deployed");
}
