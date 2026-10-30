import type { JsonValue } from "@ador/game-sdk/protocol";

// The things a game must not be able to do from inside the platform's frame, each as an action to try: reach the network, read the
// page's storage, read its cookies. The explorer tries all three and says what happened to each, so a builder (and the platform's own
// end-to-end test) can see that the frame really is cut off.
export interface SandboxActions {
  readonly cookie: () => unknown;
  readonly fetch: () => unknown;
  readonly localStorage: () => unknown;
}

const attempt = async (
  action: () => unknown,
): Promise<"allowed" | "blocked"> => {
  try {
    await action();
    return "allowed";
  } catch {
    return "blocked";
  }
};

export async function checkSandbox(
  actions: SandboxActions,
): Promise<JsonValue> {
  const [cookie, fetch, localStorage] = await Promise.all([
    attempt(actions.cookie),
    attempt(actions.fetch),
    attempt(actions.localStorage),
  ]);
  return { cookie, fetch, localStorage };
}

// What the page can really try: the platform's own API, its storage and its cookies.
export const pageActions: SandboxActions = {
  cookie: () => document.cookie.length,
  fetch: () => fetch("/api/v1/platform"),
  localStorage: () => localStorage.getItem("x"),
};
