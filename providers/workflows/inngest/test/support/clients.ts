import type { Logger } from "inngest";

import { createInngestClient } from "../../src/client.ts";
import type { InngestConfig } from "../../src/config.ts";

export const silentLogger: Logger = {
  debug: () => undefined,
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

export const devConfig: InngestConfig = {
  appId: "probe",
  baseUrl: "http://localhost:8288",
  dev: true,
  eventKey: "event-key",
  signingKey: "signkey-test-0123456789abcdef",
};

export const cloudConfig: InngestConfig = {
  appId: "probe",
  dev: false,
  eventKey: "event-key",
  signingKey: "signkey-test-0123456789abcdef",
};

export interface SentRequest {
  readonly body: unknown;
  readonly headers: Headers;
  readonly url: string;
}

// A fetch double that records each request and answers with a fixed status or throws.
export function recordingFetch(answer: number | Error) {
  const requests: SentRequest[] = [];
  const fetchDouble: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push({
      body: JSON.parse(await request.text()),
      headers: request.headers,
      url: request.url,
    });
    if (answer instanceof Error) throw answer;
    return answer === 200
      ? Response.json({ ids: ["event"], status: 200 })
      : Response.json(
          { error: "rejected", status: answer },
          { status: answer },
        );
  };
  return { fetchDouble, requests };
}

export function clientWith(config: InngestConfig, fetchDouble?: typeof fetch) {
  return createInngestClient(config, {
    ...(fetchDouble === undefined ? {} : { fetch: fetchDouble }),
    logger: silentLogger,
  });
}
