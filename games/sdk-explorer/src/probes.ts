import { GameHostError, type GameClient } from "@ador/game-sdk/client";
import type { JsonValue } from "@ador/game-sdk/protocol";

// One thing the platform offers a game, as a button: what it is called, and how to call it. The explorer
// exists to show a builder what each call returns, so every method the SDK has is here.
export interface Probe {
  readonly id: string;
  readonly label: string;
  run(client: GameClient): Promise<JsonValue>;
}

// The milestone this game declares (configs/games/sdk-explorer.ts); calling it from the explorer earns it.
export const exploredMilestone = "first-call";

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
