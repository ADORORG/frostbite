import { platformSessionCookieName } from "@ador/shared/auth";
import { describe, expect, it } from "vitest";

import { stackActors, type StackActor } from "../src/manual-stack.ts";
import {
  renderPicker,
  signInPath,
  signInResponse,
  signOutPath,
  signOutResponse,
} from "../src/sign-in-picker.ts";

const form = (actor: string) => new URLSearchParams({ actor });

describe("the sign-in page", () => {
  it("offers every person with what they are for, each as a button that posts to sign in", () => {
    const page = renderPicker(stackActors);
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    for (const actor of stackActors) {
      expect(page.body).toContain(actor.label);
      expect(page.body).toContain(`value="${actor.id}"`);
    }
    expect(page.body).toContain(`action="${signInPath}"`);
    expect(page.body).toContain(`action="${signOutPath}"`);
    expect(page.body).toContain("shortcut");
    expect(page.body).toContain('href="/sign-in"');
    expect(page.body).not.toContain("not enabled");
  });

  it("never puts a session token on the page", () => {
    const page = renderPicker(stackActors);
    for (const { token } of stackActors) expect(page.body).not.toContain(token);
  });

  it("escapes what it prints", () => {
    const hostile: StackActor = {
      goal: "<img src=x onerror=alert(1)>",
      id: 'a"b',
      label: "<script>x</script>",
      landing: "/",
      token: "t",
    };
    const page = renderPicker([hostile]);
    expect(page.body).not.toContain("<script>x");
    expect(page.body).not.toContain("<img");
    expect(page.body).toContain("&lt;script&gt;");
    expect(page.body).toContain('value="a&quot;b"');
  });
});

describe("signing in", () => {
  it("starts the chosen person's session with the platform's cookie and sends them to their page", () => {
    const reviewer = stackActors.find(({ id }) => id === "reviewer");
    const result = signInResponse(stackActors, form("reviewer"));
    expect(result.status).toBe(303);
    expect(result.headers.location).toBe(reviewer?.landing);
    const cookie = result.headers["set-cookie"];
    expect(cookie).toContain(`${platformSessionCookieName}=${reviewer?.token}`);
    // A `__Host-` cookie must be secure, on the whole site, and without a domain; and not readable by scripts.
    for (const attribute of ["Path=/", "Secure", "HttpOnly", "SameSite=Lax"])
      expect(cookie).toContain(attribute);
    expect(cookie).not.toContain("Domain");
  });

  it("gives different people different sessions", () => {
    const cookies = stackActors.map(
      ({ id }) => signInResponse(stackActors, form(id)).headers["set-cookie"],
    );
    expect(new Set(cookies).size).toBe(stackActors.length);
  });

  it("refuses an unknown or missing person without setting a cookie", () => {
    for (const body of [form("nobody"), new URLSearchParams()]) {
      const result = signInResponse(stackActors, body);
      expect(result.status).toBe(400);
      expect(result.headers["set-cookie"]).toBeUndefined();
    }
  });
});

describe("signing out", () => {
  it("expires the session cookie and returns to the sign-in page", () => {
    const result = signOutResponse();
    expect(result.status).toBe(303);
    expect(result.headers.location).toBe(signInPath);
    expect(result.headers["set-cookie"]).toContain(
      `${platformSessionCookieName}=;`,
    );
    expect(result.headers["set-cookie"]).toContain("Max-Age=0");
  });
});
