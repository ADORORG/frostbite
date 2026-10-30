import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { persistedKeys, soundKey } from "../src/platform/storage-keys.ts";

const legacy = join(import.meta.dirname, "../src/legacy");
// Keys the game writes that are meant to last only as long as the page: its telemetry log.
const visitOnly = ["frostbite.telemetry.v1"];

// Every key the game's own code stores is a decision: kept across visits (saved by the platform, within its
// 64 KB) or for the visit only. A new key added to the game fails here until someone decides which.
describe("the keys the game stores", () => {
  it("are all either saved by the platform or deliberately kept for the visit only", async () => {
    const found = new Set<string>();
    for (const name of await readdir(legacy)) {
      if (!name.endsWith(".jsx")) continue;
      const text = await readFile(join(legacy, name), "utf8");
      for (const match of text.matchAll(
        /localStorage\.(?:get|set|remove)Item\(\s*["']([^"']+)["']/gu,
      ))
        found.add(match[1] ?? "");
      for (const match of text.matchAll(
        /(?:STORE_KEY|LS|INBOX_KEY)\s*=\s*["']([^"']+)["']/gu,
      ))
        found.add(match[1] ?? "");
    }
    // The cabinets write the sound key, not the original page, so it is not among the keys found in the page's files.
    expect([...found, soundKey].sort()).toEqual(
      [...persistedKeys, ...visitOnly].sort(),
    );
  });

  it("keeps the saved ones few, so the save stays far under the platform's limit", () => {
    expect(persistedKeys.length).toBeLessThanOrEqual(8);
    expect(new Set(persistedKeys).size).toBe(persistedKeys.length);
  });
});
