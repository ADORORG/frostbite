// @vitest-environment jsdom

import type { FetchLike } from "@ador/client-http";
import { mount, settle } from "@ador/test-kit/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClaimsCard } from "../src/ui/claims-card.tsx";
import { claimAt, claimId, milestoneId } from "./support/claims-ui.tsx";

afterEach(() => vi.unstubAllGlobals());

const answer = {
  contentType: "image/svg+xml",
  data: "PHN2Zz48L3N2Zz4=",
  edition: 1,
  status: "ok",
};
const show = (state: "complete" | "pending") =>
  mount(
    <ClaimsCard
      claims={[claimAt(state)]}
      onReview={() => undefined}
      titles={{ [milestoneId]: "First win" }}
    />,
  );

describe("the claims in the dock", () => {
  it("show the minted picture of a complete claim, asked for by its claim", async () => {
    const fetchStub = vi.fn<FetchLike>(
      async () => new Response(JSON.stringify(answer), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchStub);
    const container = await show("complete");
    await settle(() => expect(container.querySelector("img")).not.toBeNull());
    expect(container.querySelector("img")?.getAttribute("alt")).toBe(
      "First win",
    );
    const [path, init] = fetchStub.mock.calls[0] ?? [];
    expect(path).toBe("/api/v1/games/milestones/picture");
    expect(JSON.parse(init?.body ?? "null")).toEqual({ claimId });
  });

  it("ask for no picture of a claim that has minted nothing yet", async () => {
    const fetchStub = vi.fn<FetchLike>(
      async () => new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchStub);
    const container = await show("pending");
    await settle(() => expect(container.querySelector("ul")).not.toBeNull());
    expect(fetchStub).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
  });
});
