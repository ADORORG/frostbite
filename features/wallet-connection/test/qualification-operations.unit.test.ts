import { describe, expect, it, vi } from "vitest";
import { registerHttpOperation } from "@ador/http/registered-operation";
import { createQualificationOperations } from "../src/application/qualification-operations.ts";
import { uuidV7Schema } from "@ador/shared/identifiers";
import type { QualificationChallenge } from "@ador/shared/wallet-qualification";

const challenge = {
  challengeId: uuidV7Schema.parse("01992cca-9c00-7000-8000-000000000001"),
  expiresAt: "2026-10-04T12:05:00.000Z",
  message: "qualification",
  signatureScheme: "bip322-simple",
} as const;
const correlationId = "01992cca-9c00-7000-8000-000000000002";
const input = { address: "candidate", provider: "xverse", network: "signet" };
describe("qualification HTTP operations", () => {
  it("validates requests, maps failures, and never emits cookie effects", async () => {
    const service = {
      begin: vi.fn(
        async (): Promise<QualificationChallenge | null> => challenge,
      ),
      verify: vi.fn(async () => true),
    };
    const [begin, verify] = createQualificationOperations(() => service);
    const beginOperation = registerHttpOperation(begin);
    const verificationOperation = registerHttpOperation(verify);
    const request = {
      actorSession: null,
      actorUserId: null,
      headers: {},
      method: "POST",
      rawInput: input,
    };
    const dependencies = { createCorrelationId: () => correlationId };
    expect(await beginOperation.execute(request, dependencies)).toMatchObject({
      status: 200,
      body: challenge,
      effects: [],
    });
    expect(service.begin).toHaveBeenCalledWith(input);
    expect(
      await beginOperation.execute(
        { ...request, rawInput: { ...input, unexpected: true } },
        dependencies,
      ),
    ).toMatchObject({ status: 400 });
    service.begin.mockResolvedValueOnce(null);
    expect(await beginOperation.execute(request, dependencies)).toMatchObject({
      status: 400,
    });
    const verification = {
      challengeId: challenge.challengeId,
      message: challenge.message,
      signature: "signature",
    };
    expect(
      await verificationOperation.execute(
        { ...request, rawInput: verification },
        dependencies,
      ),
    ).toMatchObject({
      status: 200,
      body: { signatureVerified: true, sessionCreated: false },
      effects: [],
    });
    expect(service.verify).toHaveBeenCalledWith(verification);
    service.verify.mockResolvedValueOnce(false);
    expect(
      await verificationOperation.execute(
        { ...request, rawInput: verification },
        dependencies,
      ),
    ).toMatchObject({ status: 400 });
    service.verify.mockRejectedValueOnce(new Error("database failure"));
    expect(
      await verificationOperation.execute(
        { ...request, rawInput: verification },
        dependencies,
      ),
    ).toMatchObject({ status: 500, effects: [] });
  });
});
