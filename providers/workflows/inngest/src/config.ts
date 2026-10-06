import { environmentSchema } from "@repo/config/env";
import { z } from "zod";

// The adapter exclusively owns these keys (ADR-003): server-only, never in a client bundle.
const booleanText = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isSecureOrLoopback(value: string): boolean {
  const url = new URL(value);
  return url.protocol === "https:" || loopbackHosts.has(url.hostname);
}

export const inngestConfigSchema = z
  .object({
    appId: z.string().trim().min(1),
    // Blank means Inngest Cloud; a local development server sets an http URL.
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
    dev: z.boolean(),
    eventKey: z.string().trim().min(1),
    signingKey: z.string().trim().min(1),
  })
  .strict()
  .refine(
    ({ baseUrl, dev }) =>
      dev ||
      baseUrl === undefined ||
      !URL.canParse(baseUrl) ||
      isSecureOrLoopback(baseUrl),
    {
      message:
        "A non-development Inngest base URL must use https unless it is a loopback address.",
      path: ["baseUrl"],
    },
  );

export type InngestConfig = z.infer<typeof inngestConfigSchema>;

// Development mode skips request-signature verification, so it must never serve a hosted environment.
const hostedEnvironments: readonly string[] = ["preview", "production"];

function optional(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

export function parseInngestEnvironment(
  source: NodeJS.ProcessEnv,
): InngestConfig {
  const config = inngestConfigSchema.parse({
    appId: source.INNGEST_APP_ID,
    baseUrl: optional(source.INNGEST_BASE_URL),
    dev: booleanText.parse(source.INNGEST_DEV),
    eventKey: source.INNGEST_EVENT_KEY,
    signingKey: source.INNGEST_SIGNING_KEY,
  });
  const environment = environmentSchema.shape.APP_ENV.parse(source.APP_ENV);
  if (config.dev && hostedEnvironments.includes(environment))
    throw new Error(
      `INNGEST_DEV must be false when APP_ENV is ${environment}: development mode does not verify request signatures.`,
    );
  return config;
}
