import {
  gameLaunchSettingsMapSchema,
  type GameLaunchSettings,
} from "@ador/shared/games";
import { z } from "zod";

import { environmentNames } from "./definitions.ts";

export const environmentSchema = z.object({
  APP_ENV: z.enum(environmentNames),
  PUBLIC_BASE_URL: z.url(),
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1),
});

export const authSessionEnvironmentSchema = z.object({
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: z.coerce.number().int().positive(),
  AUTH_SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive(),
  PASSKEY_CHALLENGE_TIMEOUT_MS: z.coerce.number().int().positive(),
  PASSKEY_RECENT_AUTH_WINDOW_MS: z.coerce.number().int().positive(),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;
export type AuthSessionEnvironment = z.infer<
  typeof authSessionEnvironmentSchema
>;

export function parseEnvironment(source: NodeJS.ProcessEnv): AppEnvironment {
  return environmentSchema.parse({
    APP_ENV: source.APP_ENV,
    PUBLIC_BASE_URL: source.PUBLIC_BASE_URL,
    NEXT_PUBLIC_APP_NAME: source.NEXT_PUBLIC_APP_NAME,
  });
}

export function parseAuthSessionEnvironment(
  source: NodeJS.ProcessEnv,
): AuthSessionEnvironment {
  return authSessionEnvironmentSchema.parse({
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MS: source.AUTH_SESSION_ABSOLUTE_TIMEOUT_MS,
    AUTH_SESSION_IDLE_TIMEOUT_MS: source.AUTH_SESSION_IDLE_TIMEOUT_MS,
    PASSKEY_CHALLENGE_TIMEOUT_MS: source.PASSKEY_CHALLENGE_TIMEOUT_MS,
    PASSKEY_RECENT_AUTH_WINDOW_MS: source.PASSKEY_RECENT_AUTH_WINDOW_MS,
  });
}

// The launch settings of the games, by game id. Blank means no game has a play address. In preview and
// production a play host must be HTTPS, and a return address must be on the platform's own origin, because the
// host will send a player there and it must never be a place an attacker can name. A game is never played on
// the platform's own origin, whatever its base path: a game is code the platform did not write, and on this
// origin it could act with a signed-in player's session (D23: separate origin by default).
export function parseGameLaunchEnvironment(
  source: NodeJS.ProcessEnv,
): Record<string, GameLaunchSettings> {
  const raw = source.GAME_LAUNCHES?.trim() ?? "";
  if (raw === "") return {};
  let document: unknown;
  try {
    // `unknown` is what parsing untrusted text yields; it is accepted only through the schema below.
    document = JSON.parse(raw);
  } catch {
    throw new Error("GAME_LAUNCHES is not valid JSON.");
  }
  const settings = gameLaunchSettingsMapSchema.parse(document);
  const { APP_ENV, PUBLIC_BASE_URL } = parseEnvironment(source);
  const strict = APP_ENV === "preview" || APP_ENV === "production";
  const platformOrigin = new URL(PUBLIC_BASE_URL).origin;
  for (const [id, setting] of Object.entries(settings)) {
    if (setting.url === platformOrigin)
      throw new Error(
        `GAME_LAUNCHES: "${id}" cannot be played on the platform's own origin ${platformOrigin}; use another host.`,
      );
    if (strict && !setting.url.startsWith("https://"))
      throw new Error(
        `GAME_LAUNCHES: the play host of "${id}" must use HTTPS.`,
      );
    if (
      setting.returnUrl !== null &&
      new URL(setting.returnUrl).origin !== platformOrigin
    )
      throw new Error(
        `GAME_LAUNCHES: the return address of "${id}" must be on ${platformOrigin}.`,
      );
  }
  return settings;
}

const blankAsUnset = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value.trim();

export const securityEnvironmentSchema = z.object({
  SECURITY_CSP_MODE: z.enum(["report-only", "enforce"]).default("report-only"),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

export interface SecurityEnvironment {
  readonly cspMode: "enforce" | "report-only";
  // The origin browsers talk to for stored images and direct uploads, or null when no storage is configured.
  readonly storageOrigin: string | null;
  readonly trustedProxyHops: number;
}

// The settings the security headers and the rate limiter share. Blank values mean the safe default: report
// before blocking, and one trusted proxy.
export function parseSecurityEnvironment(
  source: NodeJS.ProcessEnv,
): SecurityEnvironment {
  const parsed = securityEnvironmentSchema.parse({
    SECURITY_CSP_MODE: blankAsUnset(source.SECURITY_CSP_MODE),
    TRUSTED_PROXY_HOPS: blankAsUnset(source.TRUSTED_PROXY_HOPS),
  });
  const endpoint = blankAsUnset(source.R2_ENDPOINT);
  return {
    cspMode: parsed.SECURITY_CSP_MODE,
    storageOrigin:
      endpoint !== undefined && URL.canParse(endpoint)
        ? new URL(endpoint).origin
        : null,
    trustedProxyHops: parsed.TRUSTED_PROXY_HOPS,
  };
}
