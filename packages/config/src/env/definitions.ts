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
  {
    key: "GAME_LAUNCHES",
    description:
      "JSON object keyed by the id of a game played at an address of its own, with its play host, base path, return address and network; none is registered today, so blank is the normal case.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "SECURITY_CSP_MODE",
    description:
      "Content Security Policy mode: report-only (violations are reported, nothing is blocked) or enforce; blank means report-only.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "TRUSTED_PROXY_HOPS",
    description:
      "How many reverse proxies in front of the app set X-Forwarded-For (0 to 5); blank means 1. The client address is read that many hops from the end.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_CHAIN_RPC_URL",
    description:
      "Address of the JSON-RPC node (Bitcoin and Alkanes methods) the games' rewards contracts are reached through; blank means no rewards chain, and claims and staff administration answer not available. It may carry a key, so it is secret.",
    exposure: "server",
    required: false,
    secret: true,
  },
  {
    key: "REWARDS_CHAIN_RPC_TIMEOUT_MS",
    description:
      "Milliseconds before a call to the rewards chain node gives up; blank means 15000.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_CHAIN_RELEASE_GATE",
    description:
      "closed or open. While closed the platform builds, sends and watches nothing on the rewards chain; the owner opens it after review. Blank means closed.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_MAX_FEE_SATS",
    description:
      "The most, in satoshis, a player's claim or a staff step may pay in fee. Required when REWARDS_CHAIN_RPC_URL is set.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_TEMPLATES_DIR",
    description:
      "Directory holding the built game-rewards.wasm and milestone-collectible.wasm (contracts/templates/build.sh). Set together with REWARDS_TEMPLATE_IDS; blank means staff cannot publish templates or create games.",
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_TEMPLATE_IDS",
    description:
      'JSON object giving the Alkane (block:tx) each template is published at: {"game-rewards":"4:1","milestone-collectible":"4:2"}. Set together with REWARDS_TEMPLATES_DIR.',
    exposure: "server",
    required: false,
    secret: false,
  },
  {
    key: "REWARDS_CONTRACTS",
    description:
      'JSON object keyed by game id giving its deployed rewards contract and the largest drawing it was created to accept: {"my-game":{"id":"4:3","maxDrawingBytes":4096}}. Blank when none is deployed.',
    exposure: "server",
    required: false,
    secret: false,
  },
] as const satisfies readonly EnvironmentDefinition[];

export const environmentKeys = environmentDefinitions.map(({ key }) => key);
