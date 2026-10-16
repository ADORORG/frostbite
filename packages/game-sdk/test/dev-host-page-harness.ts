import { vi, beforeEach, afterEach } from "vitest";

import { mountDevPage } from "../src/dev-host/page-controller.ts";
import { gameChannel, protocolVersion } from "../src/protocol.ts";

// Shared by the test page tests: mounts the page in jsdom with a recorded frame address, and drives it as the game would.
export const game = {
  capabilities: ["wallet", "milestone:claim"],
  id: "tiny-game",
  milestones: [
    {
      claimPolicy: "once" as const,
      criteria: "Win.",
      description: "You won.",
      id: "first-win",
      title: "First win",
    },
  ],
};

type Mounted = ReturnType<typeof mountDevPage>;
// The page mounted by the current test, and every address it gave the frame.
export const state: { page: Mounted | null; recordedSrc: string[] } = {
  page: null,
  recordedSrc: [],
};
const original = HTMLIFrameElement.prototype.setAttribute;

export function useDevPage(): void {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML =
      '<section id="dev-stage"></section><section id="dev-panel"></section>';
    state.recordedSrc = [];
    // jsdom replaces a frame's window when it is given an address, which a browser does not; so it is recorded instead.
    vi.spyOn(HTMLIFrameElement.prototype, "setAttribute").mockImplementation(
      function (this: HTMLIFrameElement, name: string, value: string) {
        if (name !== "src") return original.call(this, name, value);
        state.recordedSrc.push(value);
      },
    );
  });
  afterEach(() => {
    state.page?.dispose();
    state.page = null;
    vi.restoreAllMocks();
  });
}

export function mount(over: Partial<typeof game> = {}) {
  state.page = mountDevPage({
    document,
    game: { ...game, ...over },
    src: "/play/tiny-game/index.html",
    storage: window.localStorage,
    window,
  });
  const target = state.page.frame.contentWindow;
  if (target === null) throw new Error("no frame");
  const toGame = vi.spyOn(target, "postMessage");
  let id = 0;
  return {
    toGame,
    ask: async (method: string, params: unknown = {}) => {
      id += 1;
      const mine = `r${String(id)}`;
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            channel: gameChannel,
            id: mine,
            method,
            params,
            version: protocolVersion,
          },
          source: target,
        }),
      );
      await vi.waitFor(() => {
        if (!answers().some((message) => message.id === mine))
          throw new Error("not yet");
      });
      return answers().find((message) => message.id === mine);
    },
    pushed: () =>
      toGame.mock.calls
        .map(([message]) => message as { data?: unknown; event?: string })
        .filter((message) => message.event !== undefined),
  };

  function answers() {
    return toGame.mock.calls.map(
      ([message]) =>
        message as {
          error?: { code: string };
          id?: string;
          ok?: boolean;
          result?: unknown;
        },
    );
  }
}
export const click = async (id: string) => {
  document
    .getElementById(id)
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await Promise.resolve();
  await Promise.resolve();
};
export const panel = () =>
  document.getElementById("dev-panel")?.textContent ?? "";
export const log = () =>
  [...(document.getElementById("dev-log")?.children ?? [])].map(
    (item) => item.textContent,
  );
