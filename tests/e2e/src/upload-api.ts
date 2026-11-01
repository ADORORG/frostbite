import { httpErrorEnvelopeSchema } from "@ador/shared/http";
import {
  completedUploadResponseSchema,
  libraryResponseSchema,
  uploadIntentResponseSchema,
} from "@ador/shared/uploads";

export const intentsPath = "/api/v1/uploads/intents";
export const completePath = "/api/v1/uploads/intents/complete";
export const assetsPath = "/api/v1/uploads/assets";
export const olderAssetsPath = "/api/v1/uploads/assets/older";

export function origin(baseURL: string | undefined): string {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  return new URL(baseURL).origin;
}

// The one thing the helpers need from Playwright's request context, so a test can pass a plain fake.
export interface JsonPoster<Response> {
  post(
    path: string,
    options: { data: object; headers: Record<string, string> },
  ): Promise<Response>;
}

export function post<Response>(
  request: JsonPoster<Response>,
  baseURL: string | undefined,
  path: string,
  data: object,
  headers: Record<string, string> = {},
) {
  return request.post(path, {
    data,
    headers: { origin: origin(baseURL), ...headers },
  });
}

// A read: a GET that takes its input from the query string (reads are not POSTs, so they need no origin or key).
export function get<Response>(
  request: {
    get(
      path: string,
      options: { params: Record<string, string> },
    ): Promise<Response>;
  },
  path: string,
  params: Record<string, string> = {},
) {
  return request.get(path, { params });
}

export const createIntent = <Response>(
  request: JsonPoster<Response>,
  baseURL: string | undefined,
  key: string,
  body: {
    byteLength: number;
    contentType: string;
    fileName?: string;
    purpose?: string;
  },
) =>
  post(
    request,
    baseURL,
    intentsPath,
    { purpose: "collection-artwork", ...body },
    { "idempotency-key": key },
  );

// Every response body is parsed with the shared contract, so a drift in the API fails here too. A body
// is `unknown` (untrusted) until a schema accepts it, and these helpers are where that happens.
export const errorCode = async (response: { json(): Promise<unknown> }) =>
  httpErrorEnvelopeSchema.parse(await response.json()).error.code;
export const intentOf = async (response: { json(): Promise<unknown> }) =>
  uploadIntentResponseSchema.parse(await response.json());
export const assetOf = async (response: { json(): Promise<unknown> }) =>
  completedUploadResponseSchema.parse(await response.json()).asset;
export const libraryOf = async (response: { json(): Promise<unknown> }) =>
  libraryResponseSchema.parse(await response.json());
