import { createContext, runInContext } from "node:vm";

import {
  metaGlobal,
  replayGlobal,
  sampleGlobal,
} from "@frostbite/game-sdk/replay";

// What a loaded verifier artifact can do: replay a record given as text (the artifact's whole surface), say what its rules
// are, and give the sample run it was published with.
export interface LoadedArtifact {
  readonly meta: { readonly id: string; readonly version: number };
  replay(recordText: string): string;
  sample(): string;
}

// Runs a game's verifier artifact. The port is what a game's published script is run through; which implementation backs it
// is a security decision (below), so the loader chooses by whose code it is.
export interface VerifierRunner {
  // Loads the script and checks it published what an artifact must. Throws when it did not.
  load(code: string): LoadedArtifact;
}

export interface InProcessRunnerOptions {
  // The longest one replay may take. A script that runs longer is stopped and the replay fails; the limit is on one call,
  // so a loop in a game's rules cannot hold the server.
  readonly replayTimeoutMs: number;
}

const input = "__frostbiteInput";

// Runs an artifact in this process, in a V8 context of its own: its globals are its own, and a call is time limited. A
// `node:vm` context is **not a security boundary** (code in it can reach the host through its own constructors), so this
// runner is for the platform's **own** games, whose rules it reviews; the loader never gives it anyone else's code. Outside
// games need a sandboxed runner (its own task, with an ADR).
export function createInProcessRunner(
  options: InProcessRunnerOptions,
): VerifierRunner {
  return {
    load(code) {
      const scope: Record<string, unknown> = {};
      const context = createContext(scope);
      runInContext(code, context, { timeout: options.replayTimeoutMs });
      const replay = scope[replayGlobal];
      const sample = scope[sampleGlobal];
      const meta: unknown = JSON.parse(String(scope[metaGlobal] ?? "null"));
      if (
        typeof replay !== "function" ||
        typeof sample !== "string" ||
        typeof meta !== "object" ||
        meta === null ||
        !("id" in meta) ||
        !("version" in meta) ||
        typeof meta.id !== "string" ||
        typeof meta.version !== "number"
      )
        throw new Error("The script does not publish a verifier.");
      return {
        meta: { id: meta.id, version: meta.version },
        replay: (recordText) => {
          scope[input] = recordText;
          const answer: unknown = runInContext(
            `${replayGlobal}(${input})`,
            context,
            { timeout: options.replayTimeoutMs },
          );
          if (typeof answer !== "string")
            throw new Error("The verifier did not answer with text.");
          return answer;
        },
        sample: () => sample,
      };
    },
  };
}
