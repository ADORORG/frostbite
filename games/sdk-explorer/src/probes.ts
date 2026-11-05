import { GameHostError, type GameClient } from "@frostbite/game-sdk/client";
import type { JsonValue } from "@frostbite/game-sdk/protocol";

// One thing the platform offers a game, as a button: what it is called, and how to call it. The explorer
// exists to show a builder what each call returns, so every method the SDK has is here.
export interface Probe {
  readonly id: string;
  readonly label: string;
  run(client: GameClient): Promise<JsonValue>;
}

// The milestone this game declares (configs/games/sdk-explorer.ts); calling it from the explorer earns it.
export const exploredMilestone = "first-call";
// The milestone with a target (configs/games/sdk-explorer.ts); each press of the progress probe reports one more.
export const progressMilestone = "ten-presses";

// A run id no run has: the platform answers `unknown-run` whoever is signed in, which is what the probe shows.
export const neverIssuedRun = "00000000-0000-4000-8000-000000000000";

// The counter this game keeps in its save: how many times it has been saved from here. Anything else a save
// might hold is a counter that starts again at nothing.
function savedCalls(saved: JsonValue | null): number {
  if (saved === null || typeof saved !== "object") return 0;
  const found = Object.entries(saved).find(([key]) => key === "calls")?.[1];
  return typeof found === "number" ? found : 0;
}

export const probes: readonly Probe[] = [
  {
    id: "capabilities",
    label: "capabilities.get",
    run: (client) => client.capabilities.get(),
  },
  {
    id: "identity",
    label: "player.identity",
    run: (client) => client.player.identity(),
  },
  {
    id: "player",
    label: "player.info",
    run: (client) => client.player.info(),
  },
  {
    id: "wallet",
    label: "wallet.get",
    run: (client) => client.wallet.get().then((wallet) => ({ wallet })),
  },
  {
    id: "wallet-connect",
    label: "wallet.connect",
    // Opens the platform's wallet chooser; the outcome comes back as the `wallet.changed` event, not as an answer.
    run: (client) => client.wallet.connect().then((status) => ({ status })),
  },
  {
    id: "run-start",
    label: "run.start",
    // Asks for a run. This game has no replay verifier, so the platform says `not-supported` (or `signed-out`): the
    // answer a game without rules for the platform to replay always gets.
    run: (client) => client.run.start(),
  },
  {
    id: "run-submit",
    label: "run.submit",
    // Submits a record for a run that was never issued, to show the shape of a refusal. A game submits the record of
    // the run `run.start` gave it, built with `@frostbite/game-sdk/run-record`.
    run: (client) => client.run.submit(neverIssuedRun, {}),
  },
  {
    id: "progress-load",
    label: "progress.load",
    run: async (client) => ({ state: await client.progress.load() }),
  },
  {
    id: "progress-save",
    label: "progress.save",
    run: async (client) => {
      const calls = savedCalls(await client.progress.load());
      await client.progress.save({ calls: calls + 1 });
      return { saved: { calls: calls + 1 } };
    },
  },
  {
    id: "milestones-counts",
    label: "milestones.counts",
    run: async (client) => ({ counts: await client.milestones.counts() }),
  },
  {
    id: "milestones-progress",
    label: "milestones.progress",
    // Reports the total the platform holds plus one: the call takes a total, never a change.
    run: async (client) => {
      const held = (await client.milestones.counts()).find(
        ({ id }) => id === progressMilestone,
      )?.current;
      return client.milestones.progress(progressMilestone, (held ?? 0) + 1);
    },
  },
  {
    id: "milestones-list",
    label: "milestones.list",
    run: async (client) => ({ milestones: await client.milestones.list() }),
  },
  {
    id: "milestones-unlock",
    label: "milestones.unlock",
    run: (client) => client.milestones.unlock(exploredMilestone),
  },
  {
    id: "milestones-claim",
    label: "milestones.claim",
    // Asks the platform to start a claim of the milestone this game's explorer earns. The platform answers `unavailable`:
    // `signed-out`, `not-earned` or, as today, `not-supported` (no contract is deployed for this game). A game that gets
    // `requested` learns how the claim goes from the `claim.changed` event.
    run: (client) => client.milestones.claim(exploredMilestone),
  },
  {
    id: "toast",
    label: "ui.toast",
    run: async (client) => ({
      shown: await client.ui.toast("Hello from the SDK explorer"),
    }),
  },
];

export type Outcome =
  | { readonly kind: "result"; readonly value: JsonValue }
  | {
      readonly code: string;
      readonly kind: "refused";
      readonly message: string;
    };

// Runs a call and reports what came back, including a refusal, instead of throwing: a refusal is the answer
// a builder most needs to see.
export async function attempt(
  call: () => Promise<JsonValue>,
): Promise<Outcome> {
  try {
    return { kind: "result", value: await call() };
  } catch (error) {
    if (error instanceof GameHostError)
      return { code: error.code, kind: "refused", message: error.message };
    throw error;
  }
}

// One line of the log.
export function describeOutcome(label: string, outcome: Outcome): string {
  return outcome.kind === "result"
    ? `${label} → ${JSON.stringify(outcome.value)}`
    : `${label} → refused (${outcome.code}): ${outcome.message}`;
}

export function describeEvent(name: string, data: JsonValue): string {
  return `event ${name} ${JSON.stringify(data)}`;
}
