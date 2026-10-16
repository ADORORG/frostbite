import {
  transactionSummarySchema,
  type TransactionSummary,
} from "@ador/shared/chain";

// A summary holds amounts as bigints, which JSON cannot carry. They are kept as decimal text under the same field names and
// read back through the summary's own schema, so what is stored is checked on the way out as much as on the way in.
export function encodeSummary(summary: TransactionSummary): unknown {
  return JSON.parse(
    JSON.stringify(summary, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
}

function revive(value: unknown, key = ""): unknown {
  if (key === "baseUnits" && typeof value === "string") return BigInt(value);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([name, entry]) => [name, revive(entry, name)]),
    );
  return value;
}

export function decodeSummary(stored: unknown): TransactionSummary {
  return transactionSummarySchema.parse(revive(stored));
}
