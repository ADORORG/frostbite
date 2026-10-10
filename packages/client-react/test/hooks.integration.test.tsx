import { createServer, type Server } from "node:http";

import { ApiError, createRequester, type FetchLike } from "@ador/client-http";
import { button, click, mount, settle } from "@ador/test-kit/dom";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { useAction } from "../src/use-action.ts";
import { useResource } from "../src/use-resource.ts";

// The hooks driven by the real browser-side requester over a real socket, as a feature uses them.
const schema = z.object({ value: z.string() }).strict();
const correlationId = "018f22f2-9c1a-7b21-8c45-0000000000aa";
let server: Server;
let origin = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/refused") {
      response.statusCode = 409;
      response.end(
        JSON.stringify({
          error: { code: "conflict", correlationId, message: "Stale." },
        }),
      );
    } else response.end(JSON.stringify({ value: "from the server" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("The test server has no TCP address");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const realFetch: FetchLike = (input, init) => fetch(`${origin}${input}`, init);
const request = createRequester(realFetch);
const words = (error: unknown) =>
  error instanceof ApiError ? `${error.code}:${error.message}` : "unknown";

function Page({ path }: { readonly path: string }) {
  const resource = useResource(
    (signal) => request({ method: "POST", path }, schema, { signal }),
    path,
    words,
  );
  const action = useAction(words);
  const { state } = resource;
  return (
    <div>
      <p>
        {state.status === "ready" ? state.data.value : null}
        {state.status === "error" ? state.failure : null}
        {state.status === "loading" ? "loading" : null}
      </p>
      <button
        onClick={() =>
          void action.act(async () => {
            await request({ method: "POST", path: "/refused" }, schema);
          })
        }
        type="button"
      >
        act
      </button>
      <output>{action.notice ?? ""}</output>
    </div>
  );
}

describe("hooks over a real connection", () => {
  it("load a validated value from the server", async () => {
    const container = await mount(<Page path="/ok" />);
    await settle(() =>
      expect(container.querySelector("p")?.textContent).toBe("from the server"),
    );
  });

  it("describe a refusal from the platform's error envelope", async () => {
    const container = await mount(<Page path="/refused" />);
    await settle(() =>
      expect(container.querySelector("p")?.textContent).toBe("conflict:Stale."),
    );
  });

  it("report the failure of an action in the feature's words", async () => {
    const container = await mount(<Page path="/ok" />);
    await click(button(container, "act"));
    await settle(() =>
      expect(container.querySelector("output")?.textContent).toBe(
        "conflict:Stale.",
      ),
    );
  });
});
