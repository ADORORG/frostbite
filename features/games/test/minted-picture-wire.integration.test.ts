import { randomUUID } from "node:crypto";

import type { MintedPictureResult } from "@ador/game-claims";
import { presentResponse } from "@ador/http/present";
import { registerHttpOperation } from "@ador/http/registered-operation";
import { readQueryInput } from "@ador/http/request-input";
import { mintedPictureHref } from "@ador/shared/games";
import { uuidV7Schema } from "@ador/shared/identifiers";
import { describe, expect, it, vi } from "vitest";

import { createGetMintedPictureOperation } from "../src/application/minted-operation.ts";

// The picture as a browser meets it: an address with the claim in its query string, answered with the drawing itself, kept for a
// day, and "unchanged" the next time it is asked about. Everything from the query string to the headers, short of the web framework.
const claimId = "5b0c1e7a-6d52-4c0f-9a43-7a3e2f1d8b60";
const userId = uuidV7Schema.parse("0198f2a4-7b3c-7d1e-8a5f-3c2b1d0e9f8a");
const svg = new TextEncoder().encode(
  "<svg xmlns='http://www.w3.org/2000/svg'/>",
);

function serve(
  answer: MintedPictureResult,
  options: {
    address?: string;
    ifNoneMatch?: string;
    userId?: typeof userId | null;
  } = {},
) {
  const picture = vi.fn(async () => answer);
  const operation = registerHttpOperation(
    createGetMintedPictureOperation(async () => ({ picture })),
  );
  const url = `https://launch.example${options.address ?? mintedPictureHref(claimId)}`;
  const signedIn = options.userId === undefined ? userId : options.userId;
  return operation
    .execute(
      {
        actorSession: null,
        actorUserId: signedIn,
        headers: {},
        method: "GET",
        rawInput: readQueryInput(url),
      },
      { createCorrelationId: randomUUID },
    )
    .then((response) => ({
      picture,
      sent: presentResponse(response, {
        cache: operation.cache,
        file: operation.file,
        ifNoneMatch: options.ifNoneMatch,
        scope: "private",
      }),
    }));
}
const found: MintedPictureResult = {
  bytes: svg,
  contentType: "image/svg+xml",
  edition: 1,
  ok: true,
};

describe("the minted picture as a browser asks for it", () => {
  it("is the drawing, shut in, kept privately for a day, and tied to who is signed in", async () => {
    const { picture, sent } = await serve(found);
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual(svg);
    expect(sent.headers).toMatchObject({
      "cache-control": "private, max-age=86400",
      "content-security-policy": "sandbox; default-src 'none'",
      "content-type": "image/svg+xml",
      vary: "Cookie",
      "x-content-type-options": "nosniff",
    });
    expect(picture).toHaveBeenCalledExactlyOnceWith(userId, claimId);
  });

  it("is answered 'unchanged' with no bytes when the browser asks again with the tag it was given", async () => {
    const first = await serve(found);
    const again = await serve(found, { ifNoneMatch: first.sent.headers.etag });
    expect(again.sent.status).toBe(304);
    expect(again.sent.body).toBeNull();
  });

  it.each(["chain-unavailable", "no-picture", "not-found"] as const)(
    "is a not-found that is never kept, and says why, when there is no picture (%s)",
    async (code) => {
      const { sent } = await serve({ code, ok: false }, { ifNoneMatch: "*" });
      expect(sent.status).toBe(404);
      expect(sent.headers["cache-control"]).toBe("no-store");
      expect(sent.headers).not.toHaveProperty("etag");
      expect(
        JSON.parse(new TextDecoder().decode(sent.body ?? undefined)),
      ).toMatchObject({
        error: { code: "not_found", reason: code },
      });
    },
  );

  it.each([
    ["no claim named", "/api/v1/games/milestones/picture"],
    [
      "a claim that is not an identifier",
      "/api/v1/games/milestones/picture?claimId=x",
    ],
    [
      "the claim named twice",
      `/api/v1/games/milestones/picture?claimId=${claimId}&claimId=${claimId}`,
    ],
    [
      "something else asked for as well",
      `/api/v1/games/milestones/picture?claimId=${claimId}&userId=${claimId}`,
    ],
  ])(
    "is refused as an invalid request, without asking the service, for %s",
    async (_name, address) => {
      const { picture, sent } = await serve(found, { address });
      expect(sent.status).toBe(400);
      expect(sent.headers["cache-control"]).toBe("no-store");
      expect(picture).not.toHaveBeenCalled();
    },
  );

  it("is refused, without asking the service, when nobody is signed in", async () => {
    const { picture, sent } = await serve(found, { userId: null });
    expect(sent.status).toBe(401);
    expect(picture).not.toHaveBeenCalled();
  });
});
