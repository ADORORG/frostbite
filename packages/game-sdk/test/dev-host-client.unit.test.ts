// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const original = HTMLIFrameElement.prototype.setAttribute;

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML =
    '<section id="dev-stage"></section><section id="dev-panel"></section>';
  vi.spyOn(HTMLIFrameElement.prototype, "setAttribute").mockImplementation(
    function (this: HTMLIFrameElement, name: string, value: string) {
      if (name !== "src") return original.call(this, name, value);
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const config = {
  game: { capabilities: [], id: "client-game", milestones: [] },
  src: "/play/client-game/index.html",
};

describe("the test page's start", () => {
  it("asks the server what game this is and mounts the page for it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(config)),
    );
    await import("../src/dev-host/client.ts");
    await vi.waitFor(() =>
      expect(document.querySelector("iframe")).not.toBeNull(),
    );
    expect(document.getElementById("dev-panel")?.textContent).toContain(
      "Signed out",
    );
  });

  it("writes on the page why it could not start, instead of leaving it blank", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ not: "a config" })),
    );
    await import("../src/dev-host/client.ts");
    await vi.waitFor(() =>
      expect(document.getElementById("dev-stage")?.textContent).toContain(
        "could not start",
      ),
    );
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("says so when the server cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await import("../src/dev-host/client.ts");
    await vi.waitFor(() =>
      expect(document.getElementById("dev-stage")?.textContent).toContain(
        "offline",
      ),
    );
  });
});
