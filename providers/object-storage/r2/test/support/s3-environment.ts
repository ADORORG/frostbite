function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required by the S3 conformance harness.`);
  return value;
}

// The disposable S3 service the integration scripts start; see `run-s3.ts`.
export const s3Environment = {
  accessKeyId: requiredEnvironment("S3_TEST_ACCESS_KEY_ID"),
  endpoint: requiredEnvironment("S3_TEST_ENDPOINT"),
  secretAccessKey: requiredEnvironment("S3_TEST_SECRET_ACCESS_KEY"),
};
