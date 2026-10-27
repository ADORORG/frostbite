import { gameChannel, protocolVersion } from "@ador/game-sdk/protocol";
import type { AccountPort } from "@ador/game-sdk/synced-backend";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDialogShim } from "@ador/test-kit/dom";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

import { GamePlayer } from "../../src/ui/game-player.tsx";
import { embeddedGame } from "./template-game.ts";

export const game = {
  id: embeddedGame.id,
  milestones: embeddedGame.milestones,
};

export const send = (
  source: unknown,
  method: string,
  params: unknown = {},
  id = "r1",
) =>
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        channel: gameChannel,
        id,
        method,
        params,
        version: protocolVersion,
      },
      source: source as MessageEventSource,
    }),
  );

export const flush = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

export const signedOut: AccountPort = {
  sync: async () => ({ kind: "signed-out" }),
};
// A stable function, as the page passes: a new one each render would restart the session.
export const noAccount = () => signedOut;

// jsdom replaces the frame's window when it is given an address, which a browser does not. So the address is
// recorded instead of followed, and `atStart` runs at the moment the game would begin.
const original = HTMLIFrameElement.prototype.setAttribute;

export const harness: {
  atStart: (() => void) | undefined;
  container: HTMLElement;
  root: Root;
  readonly started: string[];
} = {
  atStart: undefined,
  container: document.createElement("div"),
  root: createRoot(document.createElement("div")),
  started: [],
};

// Registers the lifecycle every player test needs: a fresh container, storage and mocks.
export function registerHarness(): void {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    installDialogShim();
  });
  beforeEach(() => {
    window.localStorage.clear();
    harness.atStart = undefined;
    harness.container = document.createElement("div");
    document.body.append(harness.container);
    harness.root = createRoot(harness.container);
  });
  afterEach(() => {
    act(() => harness.root.unmount());
    harness.container.remove();
    vi.restoreAllMocks();
  });
}

const player = (
  accountFor: (gameId: string) => AccountPort,
  extra: Partial<ComponentProps<typeof GamePlayer>>,
) => (
  <GamePlayer
    accountFor={accountFor}
    game={game}
    src="/play/embedded-game/index.html"
    title="Embedded game"
    {...extra}
  />
);

// Renders the player again with other properties, as the page does when the wallet connects.
export const rerender = (
  extra: Partial<ComponentProps<typeof GamePlayer>>,
  accountFor: (gameId: string) => AccountPort = noAccount,
) => act(async () => harness.root.render(player(accountFor, extra)));

export async function mount(
  accountFor: (gameId: string) => AccountPort = noAccount,
  extra: Partial<ComponentProps<typeof GamePlayer>> = {},
) {
  harness.started.length = 0;
  vi.spyOn(HTMLIFrameElement.prototype, "setAttribute").mockImplementation(
    function (this: HTMLIFrameElement, name: string, value: string) {
      if (name !== "src") return original.call(this, name, value);
      harness.started.push(value);
      harness.atStart?.();
    },
  );
  await act(async () => {
    harness.root.render(player(accountFor, extra));
  });
  const frame = harness.container.querySelector("iframe");
  if (frame === null || frame.contentWindow === null)
    throw new Error("No frame");
  const reply = vi.spyOn(frame.contentWindow, "postMessage");
  return { frame, reply, target: frame.contentWindow };
}
