import type { createWalletQualificationService } from "@ador/auth/qualification";
import type { HttpOperation } from "@ador/http";
import {
  qualificationBeginSchema,
  qualificationChallengeSchema,
  qualificationResultSchema,
  qualificationRoutes,
  qualificationVerifySchema,
  type QualificationBegin,
  type QualificationChallenge,
  type QualificationResult,
  type QualificationVerify,
} from "@ador/shared/wallet-qualification";

type Service = ReturnType<typeof createWalletQualificationService>;
export function createQualificationOperations(getService: () => Service) {
  const begin: HttpOperation<QualificationBegin, QualificationChallenge> = {
    access: { kind: "public" },
    applicationErrors: ["invalid_request"],
    idempotency: "none",
    input: "json",
    inputSchema: qualificationBeginSchema,
    outputSchema: qualificationChallengeSchema,
    ...qualificationRoutes.begin,
    execute: async (input) => {
      const challenge = await getService().begin(input);
      return challenge === null
        ? {
            ok: false,
            error: "invalid_request",
            message: "Invalid qualification candidate.",
          }
        : { ok: true, value: challenge };
    },
  };
  const verify: HttpOperation<QualificationVerify, QualificationResult> = {
    access: { kind: "public" },
    applicationErrors: ["invalid_request"],
    idempotency: "none",
    input: "json",
    inputSchema: qualificationVerifySchema,
    outputSchema: qualificationResultSchema,
    ...qualificationRoutes.verify,
    execute: async (input) =>
      (await getService().verify(input))
        ? {
            ok: true,
            value: { signatureVerified: true, sessionCreated: false },
          }
        : {
            ok: false,
            error: "invalid_request",
            message:
              "Qualification signature could not be verified. Request a fresh challenge.",
          },
  };
  return [begin, verify] as const;
}
