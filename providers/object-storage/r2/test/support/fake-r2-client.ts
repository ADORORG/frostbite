import { Readable } from "node:stream";

import type { R2ClientPort } from "../../src/r2-client.ts";

interface FakeObject {
  readonly contentLength: number;
  readonly contentType: string;
  readonly data: Buffer;
  readonly entityTag: string;
  readonly lastModified: Date;
}

function providerError(name: string, httpStatusCode: number): Error {
  return Object.assign(new Error(name), {
    $metadata: { httpStatusCode },
    name,
  });
}

export class FakeR2Client implements R2ClientPort {
  readonly calls: string[] = [];
  readonly objects = new Map<string, FakeObject>();
  failNext: Error | undefined;
  signedUrl = "https://signed.example.invalid/exact-key";

  private id(bucket: string, key: string): string {
    return `${bucket}\n${key}`;
  }

  private consumeFailure(): void {
    if (!this.failNext) return;
    const failure = this.failNext;
    this.failNext = undefined;
    throw failure;
  }

  async copyIfAbsent(input: {
    readonly destinationBucket: string;
    readonly key: string;
    readonly sourceBucket: string;
    readonly sourceEntityTag: string;
  }): Promise<void> {
    this.consumeFailure();
    const source = this.objects.get(this.id(input.sourceBucket, input.key));
    if (!source) throw providerError("NoSuchKey", 404);
    if (source.entityTag !== input.sourceEntityTag)
      throw providerError("PreconditionFailed", 412);
    const destination = this.id(input.destinationBucket, input.key);
    if (this.objects.has(destination))
      throw providerError("PreconditionFailed", 412);
    this.objects.set(destination, source);
    this.calls.push(
      `copy:${input.sourceBucket}:${input.destinationBucket}:${input.key}:${input.sourceEntityTag}`,
    );
  }

  async delete(input: {
    readonly bucket: string;
    readonly key: string;
  }): Promise<void> {
    this.consumeFailure();
    this.objects.delete(this.id(input.bucket, input.key));
    this.calls.push(`delete:${input.bucket}:${input.key}`);
  }

  async get(input: { readonly bucket: string; readonly key: string }) {
    this.consumeFailure();
    const object = this.objects.get(this.id(input.bucket, input.key));
    if (!object) throw providerError("NoSuchKey", 404);
    this.calls.push(`get:${input.bucket}:${input.key}`);
    return {
      Body: Readable.from([object.data]),
      ContentLength: object.contentLength,
      ContentType: object.contentType,
      ETag: object.entityTag,
      LastModified: object.lastModified,
    };
  }

  async head(input: { readonly bucket: string; readonly key: string }) {
    this.consumeFailure();
    const object = this.objects.get(this.id(input.bucket, input.key));
    if (!object) throw providerError("NotFound", 404);
    this.calls.push(`head:${input.bucket}:${input.key}`);
    return {
      ContentLength: object.contentLength,
      ContentType: object.contentType,
      ETag: object.entityTag,
      LastModified: object.lastModified,
    };
  }

  async presignGet(input: {
    readonly bucket: string;
    readonly expiresInSeconds: number;
    readonly key: string;
  }): Promise<string> {
    this.consumeFailure();
    this.calls.push(
      `presign-get:${input.bucket}:${input.key}:${input.expiresInSeconds}`,
    );
    return this.signedUrl;
  }

  async presignPut(input: {
    readonly bucket: string;
    readonly contentLength: number;
    readonly contentType: string;
    readonly expiresInSeconds: number;
    readonly key: string;
  }): Promise<string> {
    this.consumeFailure();
    this.calls.push(
      `presign:${input.bucket}:${input.key}:${input.contentType}:${input.contentLength}:${input.expiresInSeconds}`,
    );
    return this.signedUrl;
  }

  async put(input: {
    readonly body: Readable;
    readonly bucket: string;
    readonly contentLength: number;
    readonly contentType: string;
    readonly ifAbsent: boolean;
    readonly key: string;
  }): Promise<void> {
    this.consumeFailure();
    const id = this.id(input.bucket, input.key);
    if (input.ifAbsent && this.objects.has(id))
      throw providerError("PreconditionFailed", 412);
    const chunks: Buffer[] = [];
    for await (const chunk of input.body) chunks.push(Buffer.from(chunk));
    const data = Buffer.concat(chunks);
    this.objects.set(id, {
      contentLength: input.contentLength,
      contentType: input.contentType,
      data,
      entityTag: `etag-${data.toString("hex")}`,
      lastModified: new Date(1_000),
    });
    this.calls.push(
      `put:${input.bucket}:${input.key}:${String(input.ifAbsent)}`,
    );
  }
}
