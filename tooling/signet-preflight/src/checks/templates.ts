import { resolve } from "node:path";

import { packCode, sha256Hex } from "@ador/chain/bitcoin-alkanes";

import { messageOf, type CheckResult } from "../result.ts";

export const templatesName = "Template code matches the release";

export interface TemplateSpec {
  readonly codeHash: string;
  readonly crate: string;
  readonly version: string;
}

// A template found on disk: what it would weigh once packed for the chain, which is what publishing pays for.
export interface FoundTemplate {
  readonly crate: string;
  readonly packedBytes: number;
}

// The platform refuses to publish code whose hash is not the released one (`stepData`); this finds that out before a coin is spent.
export async function checkTemplates(
  directory: string | null,
  templates: readonly TemplateSpec[],
  readFile: (path: string) => Promise<Uint8Array>,
): Promise<{
  readonly found: readonly FoundTemplate[];
  readonly result: CheckResult;
}> {
  if (directory === null) {
    return {
      found: [],
      result: {
        detail:
          "REWARDS_TEMPLATES_DIR is not set, so the platform cannot publish templates or create games.",
        name: templatesName,
        verdict: "fail",
      },
    };
  }
  const found: FoundTemplate[] = [];
  const problems: string[] = [];
  for (const { codeHash, crate, version } of templates) {
    const path = resolve(directory, `${crate}.wasm`);
    try {
      const code = await readFile(path);
      if (sha256Hex(code) === codeHash) {
        found.push({ crate, packedBytes: packCode(code).length });
      } else {
        problems.push(
          `${crate}@${version}: ${path} is not the released code (hash differs).`,
        );
      }
    } catch (error) {
      problems.push(
        `${crate}@${version}: ${path} could not be read (${messageOf(error)}).`,
      );
    }
  }
  return {
    found,
    result:
      problems.length === 0
        ? {
            detail:
              found.map(({ crate }) => crate).join(" and ") +
              " match the released hashes.",
            name: templatesName,
            verdict: "pass",
          }
        : { detail: problems.join(" "), name: templatesName, verdict: "fail" },
  };
}
