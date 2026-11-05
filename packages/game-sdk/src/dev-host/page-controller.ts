import { attachGameHost } from "../attach.ts";
import { createGameHost } from "../host.ts";
import type { GameHostBackend, HostedGame } from "../host-types.ts";
import { createLocalBackend } from "../local-backend.ts";
import {
  requestSchema,
  type EventData,
  type EventName,
  type Response,
} from "../protocol.ts";
import {
  createFakePlatform,
  devNetworks,
  type FakePlatform,
} from "./fake-platform.ts";

// The local test page's behaviour, apart from how it is served: the game's frame joined to the real host, with the fake platform
// behind it, a panel to drive the platform's side, and a log of everything said in either direction.
export interface DevPageOptions {
  readonly document: Document;
  readonly game: HostedGame;
  // The address of the game's built page, set on the frame once the host is listening.
  readonly src: string;
  readonly storage: Storage;
  readonly window: Window;
}

const logLimit = 200;

function element<Name extends keyof HTMLElementTagNameMap>(
  document: Document,
  name: Name,
  text?: string,
): HTMLElementTagNameMap[Name] {
  const made = document.createElement(name);
  if (text !== undefined) made.textContent = text;
  return made;
}

const show = (value: unknown): string => {
  const text = JSON.stringify(value);
  return text.length > 300 ? `${text.slice(0, 297)}…` : text;
};

export function mountDevPage(options: DevPageOptions) {
  const { document, game, src, storage } = options;
  const frame = element(document, "iframe");
  frame.title = game.id;
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("allow", "fullscreen; autoplay; gamepad");
  document.getElementById("dev-stage")?.replaceChildren(frame);

  const log = element(document, "ol");
  log.id = "dev-log";
  const say = (kind: string, text: string) => {
    log.prepend(element(document, "li", `${kind} ${text}`));
    while (log.children.length > logLimit) log.lastElementChild?.remove();
  };
  const toast = element(document, "p");
  toast.id = "dev-toast";
  toast.setAttribute("role", "status");

  let host: ReturnType<typeof createGameHost> | null = null;
  const emit = <Name extends EventName>(name: Name, data: EventData<Name>) =>
    host?.emit(name, data);

  // The page shows what the platform holds right now; it is drawn again after anything changes.
  const panel = element(document, "div");
  const render = () => draw();

  const local = createLocalBackend({
    gameId: game.id,
    player: () => ({
      signedIn: platform.isSignedIn(),
      walletConnected: platform.isConnected(),
    }),
    storage,
  });
  const platform: FakePlatform = createFakePlatform({
    earned: async (milestoneId) => milestoneId in (await local.milestones()),
    emit,
    localId: async () => (await local.identity()).id,
    onChange: render,
  });
  // Who the game is told the player is follows the fake sign-in; everything the player keeps is the browser's, as it is for a
  // player who is signed out.
  const backend: GameHostBackend = {
    ...local,
    identity: () => platform.identity(),
  };

  const send = (message: unknown) => {
    say("⇢", show(message));
    frame.contentWindow?.postMessage(message, "*");
  };
  // Requests are logged as they arrive from the game's frame; answers as the host gives them.
  const pending = new Map<string, string>();
  const onRequest = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow) return;
    const request = requestSchema.safeParse(event.data);
    if (!request.success) return;
    pending.set(request.data.id, request.data.method);
    say("→", `${request.data.method} ${show(request.data.params)}`);
  };
  options.window.addEventListener("message", onRequest);

  host = createGameHost({
    backend,
    game,
    onEvent: (event) => {
      if (event.type === "refused")
        say("✖", `${event.method} refused: ${event.code}`);
    },
    push: send,
    reply: (response: Response) => {
      const method = pending.get(response.id) ?? "?";
      pending.delete(response.id);
      say(
        "←",
        response.ok
          ? `${method} ${show(response.result)}`
          : `${method} ${response.error.code}: ${response.error.message}`,
      );
      frame.contentWindow?.postMessage(response, "*");
    },
    services: {
      claims: { claim: (id) => platform.claim(id) },
      connectWallet: () => platform.connect(),
      toast: (message) => {
        toast.textContent = `${game.id}: ${message}`;
        say("✎", `toast ${show(message)}`);
      },
      wallet: () => platform.wallet(),
    },
  });
  const detach = attachGameHost({
    frame: frame.contentWindow,
    host,
    listenOn: options.window,
  });

  const button = (id: string, label: string, run: () => void) => {
    const made = element(document, "button", label);
    made.type = "button";
    made.id = id;
    made.addEventListener("click", run);
    return made;
  };
  const box = (title: string, ...children: Node[]) => {
    const section = element(document, "section");
    section.append(element(document, "h2", title), ...children);
    return section;
  };

  let hidden = false;
  let fullscreen = false;
  function draw() {
    const wallet = platform.wallet();
    const signedIn = platform.isSignedIn();
    const network = element(document, "select");
    network.id = "dev-network";
    network.setAttribute("aria-label", "Network");
    for (const name of devNetworks) {
      const option = element(document, "option", name);
      option.value = name;
      option.selected = name === platform.network();
      network.append(option);
    }
    network.addEventListener("change", () => {
      const chosen = devNetworks.find((name) => name === network.value);
      if (chosen !== undefined) platform.setNetwork(chosen);
    });
    const claims = platform.claims();
    panel.replaceChildren(
      box(
        "Player",
        element(
          document,
          "p",
          signedIn
            ? "Signed in (the account's id)"
            : "Signed out (this browser's id)",
        ),
        button(
          "dev-signin",
          signedIn ? "Sign out" : "Sign in",
          () => void platform.setSignedIn(!signedIn),
        ),
      ),
      box(
        "Wallet",
        element(
          document,
          "p",
          wallet === null
            ? "No wallet connected"
            : `${wallet.address} on ${wallet.network}`,
        ),
        button(
          "dev-wallet",
          wallet === null ? "Connect wallet" : "Disconnect",
          () => (wallet === null ? platform.connect() : platform.disconnect()),
        ),
        network,
      ),
      box(
        "Events",
        button("dev-hidden", hidden ? "Show tab" : "Hide tab", () => {
          hidden = !hidden;
          emit("lifecycle.changed", { state: hidden ? "paused" : "active" });
          render();
        }),
        button(
          "dev-fullscreen",
          fullscreen ? "Leave full screen" : "Enter full screen",
          () => {
            fullscreen = !fullscreen;
            emit("fullscreen.changed", { active: fullscreen });
            render();
          },
        ),
      ),
      box(
        "Claims (simulated)",
        ...(claims.length === 0
          ? [
              element(
                document,
                "p",
                "No claims. Earn a milestone, sign in, connect a wallet and ask for one.",
              ),
            ]
          : claims.map(({ milestoneId, state }) => {
              const row = element(document, "p", `${milestoneId}: ${state} `);
              row.dataset.claimState = state;
              if (
                state !== "failed" &&
                state !== "expired" &&
                state !== "complete"
              )
                row.append(
                  button(
                    `dev-claim-${milestoneId}`,
                    state === "awaiting-signature" ? "Sign" : "Next step",
                    () => platform.press(milestoneId),
                  ),
                );
              return row;
            })),
      ),
      box(
        "Saved progress",
        button("dev-reset", "Clear what the game saved", () => {
          for (const key of Object.keys(storage))
            if (key.startsWith(`frostbite:game:${game.id}:`))
              storage.removeItem(key);
          say("✎", "cleared saved progress; reload the game");
          frame.setAttribute("src", src);
        }),
      ),
      box("Platform message", toast),
      box("Log (newest first)", log),
    );
  }
  document.getElementById("dev-panel")?.replaceChildren(panel);
  draw();
  // Started only now, so the host is listening when the game first speaks.
  frame.setAttribute("src", src);

  return {
    dispose: () => {
      detach();
      options.window.removeEventListener("message", onRequest);
    },
    frame,
    platform,
  };
}
