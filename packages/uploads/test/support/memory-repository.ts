import type { UuidV7 } from "@frostbite/shared/identifiers";

import type {
  AssetValidationLookup,
  AssetValidationOutcome,
  AssetValidationRepository,
  AssetValidationSubject,
} from "../../src/application/validation-repository.ts";

// Mirrors the port contract: first conditional record wins and is returned to every caller.
export function memoryRepository(subject: AssetValidationSubject) {
  let outcome: AssetValidationOutcome | undefined;
  const repository: AssetValidationRepository & {
    readonly recorded: AssetValidationOutcome[];
  } = {
    recorded: [],
    async find(assetId: UuidV7): Promise<AssetValidationLookup> {
      if (assetId !== subject.assetId) return { kind: "missing" };
      return outcome === undefined
        ? { kind: "pending", subject }
        : { kind: "final", outcome };
    },
    async record(input) {
      repository.recorded.push(input.outcome);
      if (outcome !== undefined) return { kind: "replayed", outcome };
      outcome = input.outcome;
      return { kind: "recorded", outcome };
    },
  };
  return repository;
}
