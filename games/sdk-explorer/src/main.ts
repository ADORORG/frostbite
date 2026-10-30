import { createGameClient } from "@ador/game-sdk/client";
import { eventNames, type JsonValue } from "@ador/game-sdk/protocol";

import { attempt, describeEvent, describeOutcome, probes } from "./probes.ts";
import { checkSandbox, pageActions } from "./sandbox.ts";

// The page of the explorer: a button for every call the SDK has, a log of what each returned, and a list of
// what the platform told the game on its own. It keeps nothing itself.
function element<Tag extends keyof HTMLElementTagNameMap>(
  id: string,
  tag: Tag,
): HTMLElementTagNameMap[Tag] {
  const found = document.getElementById(id);
  if (found === null || found.tagName.toLowerCase() !== tag)
    throw new Error(`Missing #${id}`);
  // The tag was just compared with the one asked for.
  return found as HTMLElementTagNameMap[Tag];
}

const client = createGameClient();
const status = element("status", "p");
const buttons = element("probes", "ul");
const log = element("log", "ol");

function write(line: string, source: "call" | "event"): void {
  const item = document.createElement("li");
  item.dataset.source = source;
  item.textContent = line;
  log.prepend(item);
}

for (const probe of probes) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.id = probe.id;
  button.textContent = probe.label;
  button.disabled = true;
  button.addEventListener("click", () => {
    void attempt(() => probe.run(client)).then((outcome) =>
      write(describeOutcome(probe.label, outcome), "call"),
    );
  });
  item.append(button);
  buttons.append(item);
}

// Not a call to the platform but a check on the frame: it tries what a game must not be able to do and says what happened.
const sandbox = document.createElement("li");
const sandboxButton = document.createElement("button");
sandboxButton.type = "button";
sandboxButton.id = "sandbox";
sandboxButton.textContent = "sandbox check";
sandboxButton.disabled = true;
sandboxButton.addEventListener("click", () => {
  void checkSandbox(pageActions).then((verdicts) =>
    write(
      describeOutcome("sandbox check", { kind: "result", value: verdicts }),
      "call",
    ),
  );
});
sandbox.append(sandboxButton);
buttons.append(sandbox);

for (const name of eventNames)
  client.on(name, (data) =>
    write(describeEvent(name, data satisfies JsonValue), "event"),
  );

client.ready().then(
  () => {
    status.textContent = "Connected. Call anything below.";
    for (const button of buttons.querySelectorAll("button"))
      button.disabled = false;
  },
  () => {
    status.textContent = "Could not connect to the platform.";
  },
);
