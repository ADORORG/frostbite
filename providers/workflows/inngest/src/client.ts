import { Inngest, type Logger } from "inngest";

import type { InngestConfig } from "./config.ts";

export interface InngestClientOverrides {
  readonly fetch?: typeof fetch;
  readonly logger?: Logger;
}

// Server-only client built from validated configuration; keys are passed explicitly, never read
// from the ambient environment by the SDK.
export function createInngestClient(
  config: InngestConfig,
  overrides: InngestClientOverrides = {},
): Inngest {
  return new Inngest({
    ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
    eventKey: config.eventKey,
    id: config.appId,
    isDev: config.dev,
    signingKey: config.signingKey,
    ...(overrides.fetch === undefined ? {} : { fetch: overrides.fetch }),
    ...(overrides.logger === undefined ? {} : { logger: overrides.logger }),
  });
}
