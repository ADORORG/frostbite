import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { bundleVerifier } from "@frostbite/game-sdk/build";
import { defineGame } from "@frostbite/shared/games";

// A game made up for tests that need a game the platform has never heard of, onboarded the way any game is: its rules built
// into verifier.js by the SDK, the digest pinned in its manifest, the file placed where the game is served. Nothing in the
// platform is edited for it. Its one milestone, `reached`, is earned once the numbers added reach three.
export const adderMilestone = "reached";

const rulesSource = `
import type { GameVerifier } from "@frostbite/game-sdk/run-record";
const rules: GameVerifier<number> = {
  earned: (total) => (total >= 3 ? ["${adderMilestone}"] : []),
  id: "adder",
  init: () => ({ ok: true, state: 0 }),
  step: (total, input) =>
    input.type === "add" && typeof input.data === "number"
      ? { ok: true, state: total + input.data }
      : { ok: false, reason: "add takes a number" },
  version: 1,
};
export default rules;
export const sample = () => ({
  claims: ["${adderMilestone}"], config: {}, gameId: "SAMPLE_GAME", inputs: [{ data: 3, type: "add" }],
  schemaVersion: 1 as const, seed: 5, verifier: "adder", verifierVersion: 1,
});
`;

export interface PublishedAdder {
  readonly code: string;
  readonly sha256: string;
}

// Builds the adder's verifier under `root/source/<gameId>` and places it at `root/play/<gameId>/verifier.js`, the way a
// built game is served. `altered` appends to the served file so it no longer matches the digest the build produced.
export async function publishAdderGame(
  root: string,
  gameId: string,
  altered = false,
): Promise<PublishedAdder> {
  const source = join(root, "source", gameId);
  await mkdir(join(source, "src"), { recursive: true });
  await writeFile(
    join(source, "src", "replay.ts"),
    rulesSource.replace("SAMPLE_GAME", gameId),
  );
  const built = await bundleVerifier(source);
  if (built === null) throw new Error("The adder game built no verifier.");
  await mkdir(join(root, "play", gameId), { recursive: true });
  await writeFile(
    join(root, "play", gameId, "verifier.js"),
    altered ? `${built.code}\n` : built.code,
  );
  return { code: built.code, sha256: built.sha256 };
}

export const adderManifest = (id: string, sha256: string) =>
  defineGame({
    capabilities: ["run:submit"],
    description: "",
    id,
    launch: { mode: "embedded" },
    milestones: [
      {
        claimPolicy: "once",
        criteria: "Reach three.",
        description: "Reached three.",
        id: adderMilestone,
        title: "Reached",
        verification: "replay-verified",
      },
    ],
    network: "bip122:00000008819873e925422c1ff0f99f7c",
    schemaVersion: 1,
    summary: "An adder.",
    tags: ["arcade"],
    title: "Adder",
    verification: { replay: { id: "adder", sha256, version: 1 } },
    version: "1",
  });

// A record of one run of the adder, as a game would send it.
export const adderRecord = (
  gameId: string,
  seed: number,
  adds: readonly (number | string)[],
  claims: readonly string[] = [adderMilestone],
) => ({
  claims: [...claims],
  config: {},
  gameId,
  inputs: adds.map((data) => ({ data, type: "add" })),
  schemaVersion: 1 as const,
  seed,
  verifier: "adder",
  verifierVersion: 1,
});
