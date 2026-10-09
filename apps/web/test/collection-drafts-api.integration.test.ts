import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import {
  DELETE,
  GET,
  POST,
  PUT,
} from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Adorbitals test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

const handlers = { DELETE, GET, POST, PUT };
const origin = "https://launch.example";
const context = (...segments: string[]) => ({
  params: Promise.resolve({ segments }),
});

async function errorCode(response: Response) {
  return httpErrorEnvelopeSchema.parse(await response.json()).error.code;
}

const noSegments: readonly string[] = [];

describe("collection draft API", () => {
  it.each([
    ["GET", noSegments, "collection-drafts"],
    ["POST", ["read"], "collection-drafts"],
    ["POST", [], "collection-drafts"],
    ["PUT", [], "collection-drafts"],
    ["POST", ["items"], "collection-drafts"],
    ["PUT", ["items"], "collection-drafts"],
    ["DELETE", ["items"], "collection-drafts"],
  ] as const)("requires a session for %s %j", async (method, rest, base) => {
    const segments = [base, ...rest];
    const response = await handlers[method](
      new Request(`${origin}/api/v1/${segments.join("/")}`, {
        headers: method === "GET" ? {} : { origin },
        method,
      }),
      context(...segments),
    );
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("unauthorized");
  });

  it.each(["POST", "PUT", "DELETE"] as const)(
    "rejects a cross-origin %s before any session or body processing",
    async (method) => {
      const response = await handlers[method](
        new Request(`${origin}/api/v1/collection-drafts/items`, {
          headers: { origin: "https://attacker.example" },
          method,
        }),
        context("collection-drafts", "items"),
      );
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("forbidden");
    },
  );

  it("publishes every operation in the OpenAPI document", async () => {
    const response = await GET(
      new Request(`${origin}/api/v1/openapi`),
      context("openapi"),
    );
    const document: {
      paths: Record<string, Record<string, { operationId: string }>>;
    } = await response.json();
    const operationIds = Object.values(document.paths)
      .flatMap((methods) => Object.values(methods))
      .map(({ operationId }) => operationId);
    expect(operationIds).toEqual(
      expect.arrayContaining([
        "addCollectionItem",
        "createCollectionDraft",
        "listCollectionDrafts",
        "readCollectionDraft",
        "removeCollectionItem",
        "saveCollectionDraft",
        "updateCollectionItem",
      ]),
    );
  });
});
