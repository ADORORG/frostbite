import { createHmac } from "node:crypto";

import { waitFor } from "@ador/test-kit/inngest-runtime";
import { describe, expect, it } from "vitest";

import { createInngestClient } from "../src/client.ts";
import { createInngestEventPublisher } from "../src/publisher.ts";
import { silentLogger } from "./support/clients.ts";
import { happy, useRealRuntime } from "./support/runtime-harness.ts";

const harness = useRealRuntime();

describe("the signed boundary against the real Inngest runtime", () => {
  it("synced the signed endpoint at startup", async () => {
    // The server reports healthy before its one startup sync reaches the endpoint, so wait for it.
    const sync = await waitFor(
      () => harness.served().requests.find(({ method }) => method === "PUT"),
      15_000,
      "the startup sync",
    );
    expect(sync).toMatchObject({ path: "/api/inngest", status: 200 });
  });

  it("rejects a publish with the wrong event key as a retryable failure", async () => {
    const wrong = createInngestEventPublisher(
      createInngestClient(
        { ...harness.config(), eventKey: "not-the-key" },
        { logger: silentLogger },
      ),
    );
    const attempt = wrong.publish(harness.envelope("asset-wrong-key"));
    await expect(attempt).rejects.toThrow("401");
    await expect(attempt).rejects.not.toHaveProperty(
      "name",
      "TerminalWorkflowDeliveryError",
    );
    expect(harness.callsFor("asset-wrong-key")).toEqual([]);
  }, 60_000);

  it("rejects unsigned and wrongly signed requests without running an activity", async () => {
    harness.behave(happy);
    const before = harness.callCount();
    const url = `http://127.0.0.1:${harness.served().port}/api/inngest?fnId=runtime-test-asset-pipeline&stepId=step`;
    const body = JSON.stringify({ ctx: {}, event: {}, events: [], steps: {} });
    const timestamp = String(Math.round(Date.now() / 1000));
    const forged = createHmac("sha256", "cd".repeat(32))
      .update(body + timestamp)
      .digest("hex");
    const signatures: (string | undefined)[] = [
      undefined,
      `t=${timestamp}&s=${forged}`,
    ];
    for (const signature of signatures) {
      const headers = new Headers({ "content-type": "application/json" });
      if (signature !== undefined)
        headers.set("x-inngest-signature", signature);
      expect((await fetch(url, { body, headers, method: "POST" })).status).toBe(
        401,
      );
    }
    expect(harness.callCount()).toBe(before);
    await waitFor(
      () =>
        harness.served().requests.filter(({ status }) => status === 401)
          .length >= 2
          ? true
          : undefined,
      5_000,
      "recorded rejections",
    );
  }, 30_000);
});
