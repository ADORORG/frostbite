import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));

import { GET, POST } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Adorbitals test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
});

const origin = "https://launch.example";
const post = (path: string, body: unknown, from: string | null = origin) =>
  POST(
    new Request(`${origin}/api/v1/${path}`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        ...(from === null ? {} : { origin: from }),
      },
      method: "POST",
    }),
    { params: Promise.resolve({ segments: path.split("/") }) },
  );
const code = async (response: Response) =>
  httpErrorEnvelopeSchema.parse(await response.json()).error.code;

const protectedPosts = [
  "auth/wallet/link/challenge",
  "auth/wallet/link/verify",
  "auth/wallet/step-up/challenge",
  "auth/wallet/step-up/verify",
  "auth/wallet/unlink",
  "auth/sign-out",
];
const publicPosts = ["auth/wallet/challenge", "auth/wallet/verify"];

describe("the wallet sign-in routes at the HTTP boundary", () => {
  it.each(protectedPosts)(
    "%s needs a session, before it reads the request",
    async (path) => {
      const response = await post(path, {});
      expect(response.status).toBe(401);
      expect(await code(response)).toBe("unauthorized");
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it("lists the account's ways in only for a session", async () => {
    const response = await GET(new Request(`${origin}/api/v1/auth/methods`), {
      params: Promise.resolve({ segments: ["auth", "methods"] }),
    });
    expect(response.status).toBe(401);
    expect(await code(response)).toBe("unauthorized");
  });

  it.each([...publicPosts, ...protectedPosts])(
    "%s refuses a request from another origin, or from none",
    async (path) => {
      for (const from of ["https://attacker.example", null]) {
        const response = await post(path, {}, from);
        expect(response.status).toBe(403);
        expect(response.headers.get("set-cookie")).toBeNull();
      }
    },
  );

  it.each([
    ["no body fields", {}],
    [
      "an address that is not one",
      { address: "not an address!", network: "signet", walletAdapter: "x" },
    ],
    [
      "a network that does not exist",
      {
        address: "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v",
        network: "regtest",
        walletAdapter: "x",
      },
    ],
    [
      "a field nobody declared",
      {
        address: "tb1q9vza2e8x573nczrlzms0wvx3gsqjx7vaxwd45v",
        network: "signet",
        walletAdapter: "x",
        userId: "someone",
      },
    ],
  ])(
    "asks for a sign-in challenge only with a valid request: %s",
    async (_why, body) => {
      const response = await post("auth/wallet/challenge", body);
      expect(response.status).toBe(400);
      expect(await code(response)).toBe("invalid_request");
    },
  );

  it.each([
    ["no signature", { challengeId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab" }],
    ["a challenge id that is not one", { challengeId: "x", signature: "s" }],
    [
      "a signature of nothing",
      { challengeId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab", signature: "" },
    ],
  ])("verifies a sign-in only with a valid request: %s", async (_why, body) => {
    const response = await post("auth/wallet/verify", body);
    expect(response.status).toBe(400);
    expect(await code(response)).toBe("invalid_request");
  });
});
