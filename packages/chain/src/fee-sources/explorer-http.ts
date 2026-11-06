import { jsonValueSchema, type JsonValue } from "@frostbite/shared/chain";

import { ChainUnavailableError } from "../ports.ts";
import type { ExplorerOptions } from "./types.ts";

function unavailable(message: string): ChainUnavailableError {
  return new ChainUnavailableError(message);
}

export function assertTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
    throw new Error(
      "The fee source timeout must be a positive whole number of milliseconds.",
    );
}

// Asks an explorer for one path and returns its answer as JSON. Every explorer format reads its answer through this, so what counts as
// unreachable (no connection, too slow, an error status, a body that is not JSON) is decided once.
export async function getExplorerJson(
  options: ExplorerOptions,
  path: string,
): Promise<JsonValue> {
  const address = `${options.url.replace(/\/+$/u, "")}${path}`;
  try {
    const response = await options.fetch(address, {
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    if (!response.ok)
      throw unavailable(`The fee source answered HTTP ${response.status}.`);
    return jsonValueSchema.parse(await response.json());
  } catch (error) {
    if (error instanceof ChainUnavailableError) throw error;
    throw unavailable("The fee source could not be reached.");
  }
}

export const isRecord = (
  value: JsonValue,
): value is { readonly [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A rate an explorer quoted: a positive, finite number, or a refusal naming where it was not.
export function positiveRate(
  value: JsonValue | undefined,
  where: string,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw unavailable(`The fee source's ${where} is not a positive number.`);
  return value;
}

export function badShape(what: string): ChainUnavailableError {
  return unavailable(`The fee source's answer is not ${what}.`);
}
