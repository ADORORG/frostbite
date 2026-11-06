import { describe, expect, it } from "vitest";

describe("events package boundary", () => {
  it("exports its runtime contract from the public package path", async () => {
    const module = await import("@frostbite/events");
    expect(module.domainEventEnvelopeSchema).toBeDefined();
  });
});
