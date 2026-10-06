export const environmentNames = [
  "local",
  "test",
  "preview",
  "production",
] as const;

export type EnvironmentName = (typeof environmentNames)[number];

export interface EnvironmentDefinition {
  description: string;
  exposure: "public" | "server";
  key: string;
  required: boolean;
  secret: boolean;
}

export const environmentDefinitions = [
  {
    key: "APP_ENV",
    description: "Runtime environment; independent from the hosting provider.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "PUBLIC_BASE_URL",
    description: "Canonical origin used for links and redirects.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "NEXT_PUBLIC_APP_NAME",
    description: "Product name safe to expose in browser bundles.",
    exposure: "public",
    required: true,
    secret: false,
  },
  {
    key: "DATABASE_URL",
    description: "Standard PostgreSQL runtime connection URL.",
    exposure: "server",
    required: true,
    secret: true,
  },
  {
    key: "DATABASE_MIGRATION_URL",
    description: "Optional privileged migration URL; blank uses DATABASE_URL.",
    exposure: "server",
    required: false,
    secret: true,
  },
  {
    key: "DATABASE_SSL_MODE",
    description: "PostgreSQL TLS policy: disable, require, or verify-full.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "DATABASE_POOL_MAX",
    description: "Maximum runtime PostgreSQL pool connections per process.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "DATABASE_ACQUIRE_TIMEOUT_MS",
    description: "Maximum milliseconds to acquire a PostgreSQL connection.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "DATABASE_IDLE_TIMEOUT_MS",
    description: "Milliseconds before an idle pooled connection is closed.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "DATABASE_STATEMENT_TIMEOUT_MS",
    description: "Maximum PostgreSQL statement execution time in milliseconds.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "R2_ENDPOINT",
    description: "Cloudflare R2 S3 API HTTPS endpoint.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "R2_REGION",
    description: "S3 signing region configured for the R2 account.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "R2_ACCESS_KEY_ID",
    description: "Server-only R2 S3 API access-key identifier.",
    exposure: "server",
    required: true,
    secret: true,
  },
  {
    key: "R2_SECRET_ACCESS_KEY",
    description: "Server-only R2 S3 API secret access key.",
    exposure: "server",
    required: true,
    secret: true,
  },
  {
    key: "R2_PRIVATE_BUCKET",
    description: "Private R2 bucket for draft and quarantined originals.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "R2_PUBLIC_BUCKET",
    description: "Public R2 bucket for approved derivatives.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "INNGEST_APP_ID",
    description:
      "Inngest application identifier shown in the Inngest dashboard.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "INNGEST_DEV",
    description:
      "Use a local Inngest development server instead of Inngest Cloud: true or false. Must be false in preview and production.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "INNGEST_BASE_URL",
    description:
      "Inngest API base URL; blank uses Inngest Cloud, a development server uses http.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "INNGEST_EVENT_KEY",
    description: "Server-only key used to publish workflow events to Inngest.",
    exposure: "server",
    required: true,
    secret: true,
  },
  {
    key: "INNGEST_SIGNING_KEY",
    description:
      "Server-only key that verifies requests Inngest sends to the app.",
    exposure: "server",
    required: true,
    secret: true,
  },
  {
    key: "AUTH_SESSION_IDLE_TIMEOUT_MS",
    description:
      "Sliding idle lifetime for authenticated platform sessions in milliseconds.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "AUTH_SESSION_ABSOLUTE_TIMEOUT_MS",
    description:
      "Absolute authenticated platform session lifetime in milliseconds.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "PASSKEY_CHALLENGE_TIMEOUT_MS",
    description:
      "Maximum passkey registration ceremony lifetime in milliseconds.",
    exposure: "server",
    required: true,
    secret: false,
  },
  {
    key: "PASSKEY_RECENT_AUTH_WINDOW_MS",
    description: "Maximum age of authentication allowed for passkey changes.",
    exposure: "server",
    required: true,
    secret: false,
  },
] as const satisfies readonly EnvironmentDefinition[];

export const environmentKeys = environmentDefinitions.map(({ key }) => key);
