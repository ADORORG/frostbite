import type { Readable } from "node:stream";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpRequest } from "@smithy/protocol-http";

import type { R2Config } from "./config.ts";
import type { ProviderMetadata } from "./metadata.ts";

export interface R2ClientPort {
  copyIfAbsent(input: {
    readonly destinationBucket: string;
    readonly key: string;
    readonly sourceBucket: string;
    readonly sourceEntityTag: string;
  }): Promise<void>;
  delete(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<void>;
  get(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<ProviderMetadata>;
  head(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<ProviderMetadata>;
  presignPut(input: {
    readonly bucket: string;
    readonly contentLength: number;
    readonly contentType: string;
    readonly expiresInSeconds: number;
    readonly key: string;
  }): Promise<string>;
  put(input: {
    readonly body: Readable;
    readonly bucket: string;
    readonly contentLength: number;
    readonly contentType: string;
    readonly ifAbsent: boolean;
    readonly key: string;
  }): Promise<void>;
}

function encodedCopySource(bucket: string, key: string): string {
  return `${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function createR2Client(
  config: R2Config,
  clientOverride?: S3Client,
): R2ClientPort {
  const client =
    clientOverride ??
    new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      // A local S3 stand-in on a loopback address has no per-bucket DNS name, so it needs path-style
      // addressing; Cloudflare's own hostname keeps the SDK's default virtual-hosted style.
      forcePathStyle: new URL(config.endpoint).protocol === "http:",
      region: config.region,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });

  return {
    copyIfAbsent: async ({
      destinationBucket,
      key,
      sourceBucket,
      sourceEntityTag,
    }) => {
      const command = new CopyObjectCommand({
        Bucket: destinationBucket,
        CopySource: encodedCopySource(sourceBucket, key),
        CopySourceIfMatch: sourceEntityTag,
        Key: key,
      });
      command.middlewareStack.add(
        (next) => async (arguments_) => {
          if (HttpRequest.isInstance(arguments_.request)) {
            arguments_.request.headers["cf-copy-destination-if-none-match"] =
              "*";
          }
          return next(arguments_);
        },
        { name: "r2ConditionalDestinationCopy", step: "build" },
      );
      await client.send(command);
    },
    delete: async ({ bucket, key }) => {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    get: async ({ bucket, key }) =>
      client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    head: async ({ bucket, key }) =>
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    presignPut: async ({
      bucket,
      contentLength,
      contentType,
      expiresInSeconds,
      key,
    }) =>
      getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          ContentLength: contentLength,
          ContentType: contentType,
          Key: key,
        }),
        { expiresIn: expiresInSeconds },
      ),
    put: async ({
      body,
      bucket,
      contentLength,
      contentType,
      ifAbsent,
      key,
    }) => {
      await client.send(
        new PutObjectCommand({
          Body: body,
          Bucket: bucket,
          ContentLength: contentLength,
          ContentType: contentType,
          IfNoneMatch: ifAbsent ? "*" : undefined,
          Key: key,
        }),
      );
    },
  };
}
