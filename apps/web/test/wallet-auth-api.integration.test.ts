import { httpErrorEnvelopeSchema } from "@frostbite/shared/http";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));

import { GET, POST } from "../src/app/api/v1/[...segments]/route.ts";

beforeAll(() => {
  process.env.APP_ENV = "test";
  process.env.NEXT_PUBLIC_APP_NAME = "Frostbite test";
  process.env.PUBLIC_BASE_URL = "https://launch.example";
  // What building the sign-in services reads; the email routes build theirs on the first request.
  process.env.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS = "604800000";
  process.env.AUTH_SESSION_IDLE_TIMEOUT_MS = "86400000";
  process.env.PASSKEY_CHALLENGE_TIMEOUT_MS = "300000";
  process.env.PASSKEY_RECENT_AUTH_WINDOW_MS = "600000";
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
  // Opening a first-administrator setup link is for someone signed in.
  "auth/setup-link/redeem",
  // Adding and removing an email address change the account's ways in, so they need the account's own session.
  "email/link/request",
  "email/link/verify",
  "email/unlink",
  // The role screen's changes are for an administrator's own session.
  "admin/roles/find",
  "admin/roles/grant",
  "admin/roles/suspend",
];
const publicPosts = [
  "auth/wallet/challenge",
  "auth/wallet/verify",
  "passkeys/sign-in/options",
  "passkeys/sign-in/verify",
  "email/sign-in/request",
  "email/sign-in/verify",
];

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

  it("lists who holds platform roles only for a session", async () => {
    const response = await GET(new Request(`${origin}/api/v1/admin/roles`), {
      params: Promise.resolve({ segments: ["admin", "roles"] }),
    });
    expect(response.status).toBe(401);
    expect(await code(response)).toBe("unauthorized");
  });

  it("lists the account's email addresses only for a session", async () => {
    const response = await GET(
      new Request(`${origin}/api/v1/email/addresses`),
      {
        params: Promise.resolve({ segments: ["email", "addresses"] }),
      },
    );
    expect(response.status).toBe(401);
    expect(await code(response)).toBe("unauthorized");
  });

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

  it.each([
    ["no body fields", {}],
    ["a challenge id that is not one", { challengeId: "x", credential: {} }],
    [
      "a field nobody declared",
      {
        challengeId: "01890f0e-7c8a-7b3a-8a3e-0123456789ab",
        credential: {},
        userId: "someone",
      },
    ],
  ])(
    "finishes a passkey sign-in only with a valid request: %s",
    async (_why, body) => {
      const response = await post("passkeys/sign-in/verify", body);
      expect(response.status).toBe(400);
      expect(await code(response)).toBe("invalid_request");
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it.each([
    ["no body fields", {}],
    ["an empty address", { email: "" }],
    ["an address of absurd length", { email: "a".repeat(400) }],
    [
      "a field nobody declared",
      { email: "ada@example.com", userId: "someone" },
    ],
  ])(
    "asks for an emailed code only with a valid request: %s",
    async (_why, body) => {
      const response = await post("email/sign-in/request", body);
      expect(response.status).toBe(400);
      expect(await code(response)).toBe("invalid_request");
    },
  );

  it.each([
    ["no code", { email: "ada@example.com" }],
    ["an empty code", { code: "", email: "ada@example.com" }],
    [
      "a code of absurd length",
      { code: "1".repeat(40), email: "ada@example.com" },
    ],
    [
      "a field nobody declared",
      { code: "123456", email: "ada@example.com", userId: "x" },
    ],
  ])(
    "enters an emailed code only with a valid request: %s",
    async (_why, body) => {
      const response = await post("email/sign-in/verify", body);
      expect(response.status).toBe(400);
      expect(await code(response)).toBe("invalid_request");
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  // This process has no mail set up, so the platform says email sign-in is not available instead of pretending to send a code, and a
  // code cannot sign anyone in.
  it("answers that email sign-in is not available while no mail is set up", async () => {
    const asked = await post("email/sign-in/request", {
      email: "ada@example.com",
    });
    expect(asked.status).toBe(404);
    expect(await code(asked)).toBe("not_found");
    const entered = await post("email/sign-in/verify", {
      code: "123456",
      email: "ada@example.com",
    });
    expect(entered.status).toBe(401);
    expect(await code(entered)).toBe("unauthorized");
    expect(entered.headers.get("set-cookie")).toBeNull();
  });
});
