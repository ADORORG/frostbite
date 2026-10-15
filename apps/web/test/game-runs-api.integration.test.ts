import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@ador/http/json-body", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ador/http/json-body")>();
  return { ...original, readJsonBody: vi.fn(original.readJsonBody) };
});

import { readJsonBody } from "@ador/http/json-body";
import { GET, POST } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Adorbitals test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

const origin = "https://launch.example";
const context = (...segments: string[]) => ({
  params: Promise.resolve({ segments }),
});
const post = (segments: string[], body: string, from = origin) =>
  POST(
    new Request(`${origin}/api/v1/${segments.join("/")}`, {
      body,
      headers: { "content-type": "application/json", origin: from },
      method: "POST",
    }),
    context(...segments),
  );
const errorCode = async (response: Response) =>
  httpErrorEnvelopeSchema.parse(await response.json()).error.code;
const routes = [
  ["games", "runs", "start"],
  ["games", "runs", "submit"],
] as const;

describe("the run routes", () => {
  it.each(routes)("%j requires a session", async (...segments) => {
    const response = await post([...segments], "{}");
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("unauthorized");
  });

  it.each(routes)(
    "%j refuses another origin before anything else",
    async (...segments) => {
      const response = await post(
        [...segments],
        "{}",
        "https://attacker.example",
      );
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("forbidden");
    },
  );

  it("publishes both in the OpenAPI document", async () => {
    const document: {
      paths: Record<string, Record<string, { operationId: string }>>;
    } = await (
      await GET(new Request(`${origin}/api/v1/openapi`), context("openapi"))
    ).json();
    const operationIds = Object.values(document.paths)
      .flatMap((methods) => Object.values(methods))
      .map(({ operationId }) => operationId);
    expect(operationIds).toEqual(
      expect.arrayContaining(["startGameRun", "submitGameRun"]),
    );
  });
});

describe("the size of a request body", () => {
  it("is held to a limit before it is parsed: a body past it is an invalid request, on any route", async () => {
    // An operation open to anyone, so the body is read without a session.
    const response = await post(
      ["wallet", "balance"],
      JSON.stringify({ padding: "x".repeat(1_048_576) }),
    );
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
  });

  it("is read by the bounded reader, never by the request's own parser", async () => {
    vi.mocked(readJsonBody).mockClear();
    await post(["wallet", "balance"], "{}");
    expect(readJsonBody).toHaveBeenCalledTimes(1);
  });
});
