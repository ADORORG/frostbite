import { parseObjectKey } from "@frostbite/object-storage";

export const config = {
  accessKeyId: "access-key",
  endpoint: "https://account.r2.cloudflarestorage.com",
  environment: "test" as const,
  privateBucket: "private-assets",
  publicBucket: "public-assets",
  region: "auto",
  secretAccessKey: "secret-key",
};
export const key = parseObjectKey("drafts/account/art.png");
