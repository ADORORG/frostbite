import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { findTemplateReleaseViolations } from "../src/template-release-policy.ts";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

// A repository with a release.json that lists the given templates (hash and size of `listed`) and the released folder holding `kept`.
async function repository(
  listed: Record<string, string>,
  kept: Record<string, string> | null,
) {
  const root = await mkdtemp(join(tmpdir(), "template-release-"));
  roots.push(root);
  const directory = join(root, "contracts/templates");
  await mkdir(join(directory, "released"), { recursive: true });
  await writeFile(
    join(directory, "release.json"),
    JSON.stringify(
      Object.fromEntries(
        Object.entries(listed).map(([crate, text]) => [
          crate,
          { bytes: text.length, sha256: sha(text) },
        ]),
      ),
    ),
  );
  for (const [name, text] of Object.entries(kept ?? {}))
    await writeFile(join(directory, "released", name), text);
  return root;
}

describe("the released templates", () => {
  it("pass when each listed template is kept with exactly the listed bytes and hash", async () => {
    const root = await repository(
      { "game-rewards": "aaaa", "milestone-collectible": "bbb" },
      { "game-rewards.wasm": "aaaa", "milestone-collectible.wasm": "bbb" },
    );
    expect(await findTemplateReleaseViolations(root)).toEqual([]);
  });

  it("fail when a listed template is not kept", async () => {
    const root = await repository({ "game-rewards": "aaaa" }, {});
    expect(await findTemplateReleaseViolations(root)).toEqual([
      "contracts/templates/released/game-rewards.wasm is missing: release.json lists game-rewards.",
    ]);
  });

  it("fail when there is no released folder at all", async () => {
    const root = await repository({ "game-rewards": "aaaa" }, {});
    await rm(join(root, "contracts/templates/released"), { recursive: true });
    expect(await findTemplateReleaseViolations(root)).toHaveLength(1);
  });

  it("fail when a kept template has other content of the same size, and when it has another size", async () => {
    const same = await repository(
      { "game-rewards": "aaaa" },
      { "game-rewards.wasm": "aaab" },
    );
    expect(await findTemplateReleaseViolations(same)).toEqual([
      "contracts/templates/released/game-rewards.wasm does not match the bytes and hash in release.json.",
    ]);
    const longer = await repository(
      { "game-rewards": "aaaa" },
      { "game-rewards.wasm": "aaaaa" },
    );
    expect(await findTemplateReleaseViolations(longer)).toHaveLength(1);
  });

  it("fail when release.json states a size the kept file does not have, even if the hash is right", async () => {
    const root = await repository(
      { "game-rewards": "aaaa" },
      { "game-rewards.wasm": "aaaa" },
    );
    await writeFile(
      join(root, "contracts/templates/release.json"),
      JSON.stringify({ "game-rewards": { bytes: 99, sha256: sha("aaaa") } }),
    );
    expect(await findTemplateReleaseViolations(root)).toHaveLength(1);
  });

  it("fail for a kept file that release.json does not list, whatever it is called", async () => {
    const root = await repository(
      { "game-rewards": "aaaa" },
      {
        "game-rewards.wasm": "aaaa",
        "old-template.wasm": "x",
        "notes.txt": "x",
        "game-rewards": "aaaa",
      },
    );
    expect(await findTemplateReleaseViolations(root)).toEqual([
      "contracts/templates/released/game-rewards is not a template release.json lists.",
      "contracts/templates/released/notes.txt is not a template release.json lists.",
      "contracts/templates/released/old-template.wasm is not a template release.json lists.",
    ]);
  });

  it("is refused when release.json is not the shape it should be", async () => {
    const root = await repository({}, {});
    await writeFile(
      join(root, "contracts/templates/release.json"),
      '{"game-rewards":{"sha256":"x"}}',
    );
    await expect(findTemplateReleaseViolations(root)).rejects.toThrow();
  });
});
