import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  chainFeesRoute,
  chainFeesSchema,
  chainIndexingRoute,
  chainIndexingSchema,
  type ChainFees,
  type ChainIndexing,
} from "@ador/shared/chain";

export type { StatusPolling } from "../domain/freshness.ts";

// How long a look at the chain's status may take; it is a lamp, so a slow answer is not worth waiting for.
export const indexingTimeoutMs = 5_000;

export interface ChainStatusApi {
  fees(signal: AbortSignal): Promise<ChainFees>;
  indexing(signal: AbortSignal): Promise<ChainIndexing>;
}

export function createChainStatusApi(
  fetchImpl: FetchLike = sameOriginFetch,
): ChainStatusApi {
  const request = createRequester(fetchImpl);
  return {
    fees: (signal) =>
      request(chainFeesRoute, chainFeesSchema, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(indexingTimeoutMs),
        ]),
      }),
    indexing: (signal) =>
      request(chainIndexingRoute, chainIndexingSchema, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(indexingTimeoutMs),
        ]),
      }),
  };
}
