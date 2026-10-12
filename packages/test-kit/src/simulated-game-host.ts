import { JSDOM, type DOMWindow } from "jsdom";

import {
  createGameHost,
  type GameHost,
  type GameHostBackend,
  type HostedGame,
  type HostEvent,
} from "@ador/game-sdk/host";
import type { GameHostPolicy } from "@ador/game-sdk/policy";
import type { Response } from "@ador/game-sdk/protocol";

export interface SimulatedGame {
  // Closes the page the game ran in.
  close(): void;
  // Everything the host reported to the player, in order.
  readonly events: readonly HostEvent[];
  readonly host: GameHost;
  // The messages the host sent back to the game.
  readonly replies: readonly Response[];
  // The game's page, for reading what it showed and pressing what it offers.
  readonly window: DOMWindow;
}

// Runs a game's built script in a page with no network, no storage of its own and no parent but a simulated
// host, so the whole conversation can be checked without a browser. This is how a game is tested against the
// platform's interface before it is listed: what it asks for, what it shows when the platform refuses, and
// that it needs nothing the platform does not offer. A game that reaches for `fetch` or `localStorage` fails
// here as it would in the isolated frame.
export function runGameInSimulatedHost(options: {
  readonly backend: GameHostBackend;
  readonly game: HostedGame;
  readonly html?: string;
  readonly now?: () => Date;
  readonly policy?: GameHostPolicy;
  readonly script: string;
}): SimulatedGame {
  const dom = new JSDOM(options.html ?? "<!doctype html><body></body>", {
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const events: HostEvent[] = [];
  const replies: Response[] = [];
  const parent = {
    postMessage: (message: unknown) => void host.handle(message),
  };
  const host = createGameHost({
    backend: options.backend,
    game: options.game,
    now: options.now,
    onEvent: (event) => events.push(event),
    policy: options.policy,
    reply: (response) => {
      replies.push(response);
      const event = new window.Event("message");
      Object.assign(event, { data: response, source: parent });
      window.dispatchEvent(event);
    },
  });
  // The page the game runs in is a frame of the host; its parent is the host.
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  // The isolated frame has no storage and no network.
  for (const name of [
    "localStorage",
    "sessionStorage",
    "fetch",
    "XMLHttpRequest",
  ]) {
    Object.defineProperty(window, name, {
      configurable: true,
      get: () => {
        throw new window.DOMException(
          "Not available in the game frame.",
          "SecurityError",
        );
      },
    });
  }
  window.eval(options.script);
  return { close: () => window.close(), events, host, replies, window };
}
