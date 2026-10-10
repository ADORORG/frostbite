import { platformSessionCookieName } from "@ador/shared/auth";

import type { StackActor } from "./manual-stack.ts";

// The local stack's stand-in for wallet sign-in, which is not enabled yet: a page that lists the seeded
// people and starts a session as the one you pick. It lives in the stack's own front door
// (`stack-proxy.ts`), never in the web app, so it cannot be present in a deployed build.

export const signInPath = "/dev/sign-in";
export const signOutPath = "/dev/sign-out";

export interface DevResponse {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly status: number;
}

// The same attributes the platform gives a real session cookie (see `session.ts`).
const cookieAttributes = "Path=/; Secure; HttpOnly; SameSite=Lax";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function html(status: number, body: string): DevResponse {
  return {
    body,
    headers: { "content-type": "text/html; charset=utf-8" },
    status,
  };
}

export function renderPicker(actors: readonly StackActor[]): DevResponse {
  const people = actors
    .map(
      (actor) => `<li>
  <form method="post" action="${signInPath}">
    <input type="hidden" name="actor" value="${escapeHtml(actor.id)}">
    <button type="submit">${escapeHtml(actor.label)}</button>
    <span>${escapeHtml(actor.goal)}</span>
  </form>
</li>`,
    )
    .join("\n");
  return html(
    200,
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local test sign-in</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0 auto; max-width: 40rem; padding: 1rem; }
ul { list-style: none; padding: 0; }
li { margin: 0 0 .75rem; }
form { display: grid; gap: .25rem; }
button { font: inherit; padding: .5rem .75rem; text-align: left; cursor: pointer; }
</style>
</head>
<body>
<h1>Local test sign-in</h1>
<p>This page exists only in the local test stack. Real sign-in is by wallet and is not enabled yet. Pick a person to sign in as.</p>
<ul>
${people}
</ul>
<form method="post" action="${signOutPath}"><button type="submit">Sign out</button></form>
</body>
</html>`,
  );
}

function redirect(to: string, cookie: string): DevResponse {
  return {
    body: "",
    headers: { location: to, "set-cookie": cookie },
    status: 303,
  };
}

export function signInResponse(
  actors: readonly StackActor[],
  form: URLSearchParams,
): DevResponse {
  const actor = actors.find(({ id }) => id === form.get("actor"));
  if (actor === undefined) return html(400, "Unknown person.");
  return redirect(
    actor.landing,
    `${platformSessionCookieName}=${actor.token}; ${cookieAttributes}`,
  );
}

export function signOutResponse(): DevResponse {
  return redirect(
    signInPath,
    `${platformSessionCookieName}=; ${cookieAttributes}; Max-Age=0`,
  );
}
