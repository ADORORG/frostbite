import { createProviderRegistry } from "@frostbite/plugin-kit/providers";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { createInngestProviderEntrypoint } from "../src/provider-entrypoint.ts";
import { inngestWorkflowProvider } from "../src/registration.ts";

const environment = {
  APP_ENV: "local",
  INNGEST_APP_ID: "frostbit",
  INNGEST_BASE_URL: "http://localhost:8288",
  INNGEST_DEV: "true",
  INNGEST_EVENT_KEY: "event-key",
  INNGEST_SIGNING_KEY: "signing-key",
};

describe("Inngest provider registration", () => {
  it("loads an entrypoint matching its explicit manifest", async () => {
    await expect(inngestWorkflowProvider.load()).resolves.toMatchObject({
      capabilities: [
        "workflow-orchestration:event-publisher",
        "workflow-orchestration:signed-endpoint",
      ],
      createServices: expect.any(Function),
      id: "inngest-workflows",
      version: "1.0.0",
    });
    expect(inngestWorkflowProvider.manifest.requiredDecisionGates).toEqual([]);
    expect(inngestWorkflowProvider.manifest.capabilities).toEqual(
      (await inngestWorkflowProvider.load()).capabilities,
    );
  });

  it("resolves a publisher and an endpoint factory lazily from validated configuration", async () => {
    const registry = createProviderRegistry([
      {
        load: async () => createInngestProviderEntrypoint(environment),
        manifest: inngestWorkflowProvider.manifest,
      },
    ]);
    await expect(
      registry.resolve("workflow-orchestration:event-publisher"),
    ).resolves.toMatchObject({
      publish: expect.any(Function),
    });
    await expect(
      registry.resolve("workflow-orchestration:signed-endpoint"),
    ).resolves.toMatchObject({
      createEndpoint: expect.any(Function),
    });
  });

  it("defers configuration errors to first use", async () => {
    const registry = createProviderRegistry([
      {
        load: async () => createInngestProviderEntrypoint({}),
        manifest: inngestWorkflowProvider.manifest,
      },
    ]);
    expect(
      registry.hasCapability("workflow-orchestration:event-publisher"),
    ).toBe(true);
    await expect(
      registry.resolve("workflow-orchestration:event-publisher"),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
