import { randomUUID } from "node:crypto";

// Rows that are waiting to be swept, as the tables take them. Each row lives from `issuedAgo` to `expiresAgo`, both as how long before
// `at`, so a negative expiry is a row that has not expired yet. Shared by the database's and the worker's tests of the sweeps.
const before = (at: Date, ms: number) => new Date(at.getTime() - ms);

export const walletChallengeRow = (
  at: Date,
  issuedAgo: number,
  expiresAgo: number,
) => ({
  action: "sign-in" as const,
  address: "tb1qexample",
  attempts: 0,
  domain: "example.test",
  expiresAt: before(at, expiresAgo),
  id: randomUUID(),
  issuedAt: before(at, issuedAgo),
  messageHash: "b".repeat(64),
  network: "signet",
  nonce: randomUUID(),
  origin: "https://example.test",
  requestId: randomUUID(),
  schemaVersion: 1,
  scriptIdentity: "script",
  signatureScheme: "bip322-simple",
  uri: "https://example.test",
  walletAdapter: "unisat",
});

export const contactCodeRow = (
  at: Date,
  issuedAgo: number,
  expiresAgo: number,
) => ({
  codeHash: "c".repeat(64),
  destination: `${randomUUID().slice(0, 8)}@example.test`,
  expiresAt: before(at, expiresAgo),
  id: randomUUID(),
  issuedAt: before(at, issuedAgo),
  kind: "email",
  salt: "salt",
});
