import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export interface AssetValidationColumns {
  readonly contentSha256: AnyPgColumn;
  readonly detectedContentType: AnyPgColumn;
  readonly heightPixels: AnyPgColumn;
  readonly processingCompletedAt: AnyPgColumn;
  readonly processingState: AnyPgColumn;
  readonly rejectionReason: AnyPgColumn;
  readonly validatedEntityTag: AnyPgColumn;
  readonly validationCompletedAt: AnyPgColumn;
  readonly validatorVersion: AnyPgColumn;
  readonly widthPixels: AnyPgColumn;
}

// One CHECK ties each asset state to exactly the fields it requires. Every required field is
// tested IS NOT NULL, because a NULL comparison is UNKNOWN and a CHECK accepts UNKNOWN. The state is
// compared as text so a migration never uses an enum value added in the same transaction.
//
//   pending-validation  nothing recorded
//   rejected            validation reason only
//   validated           validation outcome, nothing processed
//   processed           validation outcome and processing completed
//   unprocessable       validation outcome, a rejection reason, and processing completed
export function assetValidationCoherence(c: AssetValidationColumns): SQL {
  const state = (name: string) => sql`${c.processingState}::text = ${name}`;
  const noOutcome = sql`${c.validatorVersion} IS NULL
    AND ${c.validatedEntityTag} IS NULL
    AND ${c.contentSha256} IS NULL
    AND ${c.detectedContentType} IS NULL
    AND ${c.widthPixels} IS NULL
    AND ${c.heightPixels} IS NULL`;
  const outcome = sql`${c.validatorVersion} IS NOT NULL
    AND length(btrim(${c.validatorVersion})) > 0
    AND ${c.validatedEntityTag} IS NOT NULL
    AND length(btrim(${c.validatedEntityTag})) > 0
    AND ${c.contentSha256} IS NOT NULL
    AND ${c.contentSha256} ~ '^[0-9a-f]{64}$'
    AND ${c.detectedContentType} IS NOT NULL
    AND ${c.widthPixels} IS NOT NULL
    AND ${c.widthPixels} > 0
    AND ${c.heightPixels} IS NOT NULL
    AND ${c.heightPixels} > 0`;
  return sql`(
    ${state("pending-validation")}
    AND ${c.validationCompletedAt} IS NULL
    AND ${noOutcome}
    AND ${c.rejectionReason} IS NULL
    AND ${c.processingCompletedAt} IS NULL
  ) OR (
    ${state("rejected")}
    AND ${c.validationCompletedAt} IS NOT NULL
    AND ${c.validatorVersion} IS NOT NULL
    AND length(btrim(${c.validatorVersion})) > 0
    AND ${c.rejectionReason} IS NOT NULL
    AND ${c.validatedEntityTag} IS NULL
    AND ${c.contentSha256} IS NULL
    AND ${c.detectedContentType} IS NULL
    AND ${c.widthPixels} IS NULL
    AND ${c.heightPixels} IS NULL
    AND ${c.processingCompletedAt} IS NULL
  ) OR (
    ${state("validated")}
    AND ${c.validationCompletedAt} IS NOT NULL
    AND ${outcome}
    AND ${c.rejectionReason} IS NULL
    AND ${c.processingCompletedAt} IS NULL
  ) OR (
    ${state("processed")}
    AND ${c.validationCompletedAt} IS NOT NULL
    AND ${outcome}
    AND ${c.rejectionReason} IS NULL
    AND ${c.processingCompletedAt} IS NOT NULL
  ) OR (
    ${state("unprocessable")}
    AND ${c.validationCompletedAt} IS NOT NULL
    AND ${outcome}
    AND ${c.rejectionReason} IS NOT NULL
    AND ${c.processingCompletedAt} IS NOT NULL
  )`;
}
