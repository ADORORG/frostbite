import {
  createRequester,
  sameOriginFetch,
  type FetchLike,
} from "@ador/client-http";
import {
  chainIndexingRoute,
  chainIndexingSchema,
  type ChainIndexing,
} from "@ador/shared/chain";

// How long a look at the chain's status may take; it is a lamp, so a slow answer is not worth waiting for.
export const indexingTimeoutMs = 5_000;

export interface ChainStatusApi {
  indexing(signal: AbortSignal): Promise<ChainIndexing>;
}

export function createChainStatusApi(
  fetchImpl: FetchLike = sameOriginFetch,
): ChainStatusApi {
  const request = createRequester(fetchImpl);
  return {
    indexing: (signal) =>
      request(chainIndexingRoute, chainIndexingSchema, {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(indexingTimeoutMs),
        ]),
      }),
  };
}
