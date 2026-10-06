import { environmentSchema } from "@repo/config/env";
import { isTransportAllowed } from "@repo/config/transport";
import { z } from "zod";

const bucketName = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);

export const r2ConfigSchema = z
  .object({
    accessKeyId: z.string().trim().min(1),
    // https, or plain http to this machine outside hosted environments (a local S3 stand-in).
    endpoint: z.url({ protocol: /^https?$/ }),
    environment: environmentSchema.shape.APP_ENV,
    privateBucket: bucketName,
    publicBucket: bucketName,
    region: z.string().trim().min(1),
    secretAccessKey: z.string().trim().min(1),
  })
  .strict()
  .refine(({ privateBucket, publicBucket }) => privateBucket !== publicBucket, {
    message: "Private and public R2 buckets must differ.",
    path: ["publicBucket"],
  })
  .refine(
    ({ endpoint, environment }) => isTransportAllowed(endpoint, environment),
    {
      message:
        "The R2 endpoint must use https; plain http is allowed only for a loopback address outside preview and production.",
      path: ["endpoint"],
    },
  );

export type R2Config = z.infer<typeof r2ConfigSchema>;

export function parseR2Environment(source: NodeJS.ProcessEnv): R2Config {
  return r2ConfigSchema.parse({
    accessKeyId: source.R2_ACCESS_KEY_ID,
    endpoint: source.R2_ENDPOINT,
    environment: source.APP_ENV,
    privateBucket: source.R2_PRIVATE_BUCKET,
    publicBucket: source.R2_PUBLIC_BUCKET,
    region: source.R2_REGION,
    secretAccessKey: source.R2_SECRET_ACCESS_KEY,
  });
}
