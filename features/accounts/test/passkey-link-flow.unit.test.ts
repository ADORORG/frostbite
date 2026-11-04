import { ApiError, type Requester } from "@ador/client-http";
import { describe, expect, it, vi } from "vitest";

import { failed } from "../src/client/outcome.ts";
import {
  linkPasskey,
  listPasskeys,
  removePasskey,
} from "../src/ui/passkey-link-flow.ts";
import { apiFailure } from "./support/failures.ts";

const begun = {
  challengeId: "01990a03-5d80-7c00-8000-000000000001",
  expiresAt: "2026-09-10T12:05:00.000Z",
  options: {
    challenge: "Y2hhbGxlbmdl",
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    rp: { id: "launch.invalid", name: "Launch" },
    user: { displayName: "Player", id: "cGxheWVy", name: "Player" },
  },
};
const credential = { id: "credential", type: "public-key" };

// A server that answers each path with the next thing queued for it: a body, or an ApiError to throw.
function server(answers: Record<string, (ApiError | object)[]>) {
  const sent: { body: object | undefined; method: string; path: string }[] = [];
  const request: Requester = async (route, schema, options) => {
    sent.push({ body: options?.body, method: route.method, path: route.path });
    const next = answers[route.path]?.shift();
    if (next === undefined) throw new Error(`unexpected ${route.path}`);
    if (next instanceof ApiError) throw next;
    const parsed = schema.safeParse(next);
    if (!parsed.success) throw new Error("fixture does not fit the contract");
    return parsed.data;
  };
  return { request, sent };
}
const paths = {
  begin: "/api/v1/passkeys/registration/options",
  finish: "/api/v1/passkeys/registration/verify",
  list: "/api/v1/passkeys",
  unlink: "/api/v1/passkeys/unlink",
};
const ask = vi.fn(async () => credential);
const supported = () => true;

describe("reading the passkeys in the browser", () => {
  it("lists the credential ids the server has", async () => {
    const { request, sent } = server({
      [paths.list]: [{ credentialIds: ["a", "b"] }],
    });
    expect(await listPasskeys(request)).toEqual(["a", "b"]);
    expect(sent).toEqual([
      { body: undefined, method: "GET", path: paths.list },
    ]);
  });
});

describe("linking a passkey in the browser", () => {
  it("asks for options, shows the prompt, sends what it made, and reports the list as the server now has it", async () => {
    ask.mockClear();
    const { request, sent } = server({
      [paths.begin]: [begun],
      [paths.finish]: [{ changed: true }],
      [paths.list]: [{ credentialIds: ["credential"] }],
    });
    expect(await linkPasskey({ ask, request, supported })).toEqual({
      credentialIds: ["credential"],
      kind: "linked",
    });
    expect(ask).toHaveBeenCalledExactlyOnceWith(begun.options);
    expect(sent.map(({ method, path }) => `${method} ${path}`)).toEqual([
      `POST ${paths.begin}`,
      `POST ${paths.finish}`,
      `GET ${paths.list}`,
    ]);
    expect(sent[1]?.body).toEqual({
      challengeId: begun.challengeId,
      credential,
    });
  });

  it("says the browser cannot, and asks the server nothing, when it has no passkeys", async () => {
    const { request, sent } = server({});
    expect(await linkPasskey({ ask, request, supported: () => false })).toEqual(
      failed("passkey-unsupported"),
    );
    expect(sent).toEqual([]);
  });

  it.each([
    [
      "forbidden",
      "recent-authentication-required",
      "recent-authentication-required",
    ],
    ["unauthorized", "signed-out", "signed-out"],
    ["conflict", null, "passkey-change-failed"],
    ["internal_error", null, "network"],
  ] as const)(
    "reports a refusal to begin (%s) as the outcome the server named, or a change that could not be completed",
    async (code, reason, outcome) => {
      const { request } = server({
        [paths.begin]: [apiFailure(code, reason)],
      });
      expect(await linkPasskey({ ask, request, supported })).toEqual(
        failed(outcome),
      );
    },
  );

  it("says no passkey was used, and sends nothing more, when the prompt is closed", async () => {
    const { request, sent } = server({ [paths.begin]: [begun] });
    const closed = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    expect(await linkPasskey({ ask: closed, request, supported })).toEqual(
      failed("passkey-cancelled"),
    );
    expect(sent).toHaveLength(1);
  });

  it("reports a refusal of what the prompt made, and does not read the list", async () => {
    const { request, sent } = server({
      [paths.begin]: [begun],
      [paths.finish]: [
        apiFailure("forbidden", "recent-authentication-required"),
      ],
    });
    expect(await linkPasskey({ ask, request, supported })).toEqual(
      failed("recent-authentication-required"),
    );
    expect(sent.map(({ path }) => path)).toEqual([paths.begin, paths.finish]);
  });

  it("does not claim the passkey is linked when the list cannot be read afterwards", async () => {
    const { request } = server({
      [paths.begin]: [begun],
      [paths.finish]: [{ changed: true }],
      [paths.list]: [apiFailure("conflict")],
    });
    expect(await linkPasskey({ ask, request, supported })).toEqual(
      failed("passkey-change-failed"),
    );
  });

  it("does not hide a bug found while reading the list afterwards", async () => {
    const answers = [{ changed: true }];
    const request: Requester = async (route, schema) => {
      if (route.path === paths.list) throw new TypeError("a bug");
      const parsed = schema.safeParse(answers.shift());
      if (!parsed.success) throw new Error("fixture does not fit the contract");
      return parsed.data;
    };
    await expect(removePasskey(request, "credential")).rejects.toThrow("a bug");
  });

  it("does not hide a failure that is not the server's", async () => {
    const request: Requester = async () => {
      throw new TypeError("a bug");
    };
    await expect(linkPasskey({ ask, request, supported })).rejects.toThrow(
      "a bug",
    );
  });
});

describe("removing a passkey in the browser", () => {
  it("posts the credential and reports the list as the server now has it", async () => {
    const { request, sent } = server({
      [paths.list]: [{ credentialIds: [] }],
      [paths.unlink]: [{ changed: true }],
    });
    expect(await removePasskey(request, "credential")).toEqual({
      credentialIds: [],
      kind: "removed",
    });
    expect(sent[0]).toEqual({
      body: { credentialId: "credential" },
      method: "POST",
      path: paths.unlink,
    });
  });

  it("reports a refusal as the outcome the server named, and does not read the list", async () => {
    const { request, sent } = server({
      [paths.unlink]: [
        apiFailure("forbidden", "recent-authentication-required"),
      ],
    });
    expect(await removePasskey(request, "credential")).toEqual(
      failed("recent-authentication-required"),
    );
    expect(sent).toHaveLength(1);
  });

  it("does not claim the passkey is gone when the list cannot be read afterwards", async () => {
    const { request } = server({
      [paths.list]: [apiFailure("internal_error")],
      [paths.unlink]: [{ changed: true }],
    });
    expect(await removePasskey(request, "credential")).toEqual(
      failed("passkey-change-failed"),
    );
  });
});
