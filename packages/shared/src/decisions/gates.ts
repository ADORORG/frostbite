import { z } from "zod";

import { decisionGateIdSchema } from "@frostbite/shared/features";

const decisionIdSchema = z.string().regex(/^D\d{2}$/);
const decisionFieldSchema = z.string().regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);
const nonPlaceholderSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/^(?:_fill in_|tbd|todo)$/iu.test(value));
const repositoryPathSchema = nonPlaceholderSchema.refine(
  (value) =>
    !value.startsWith("/") &&
    !value.includes("\\") &&
    value
      .split("/")
      .every(
        (segment) => segment !== "" && segment !== "." && segment !== "..",
      ),
  { message: "Expected a repository-relative path without traversal." },
);
const requiredFieldsSchema = z
  .array(decisionFieldSchema)
  .min(1)
  .refine((fields) => new Set(fields).size === fields.length, {
    message: "Duplicate required decision field.",
  })
  .readonly();

const pendingDecisionSchema = z
  .object({
    deadline: nonPlaceholderSchema,
    id: decisionIdSchema,
    owner: nonPlaceholderSchema,
    requiredFields: requiredFieldsSchema,
    status: z.enum(["unresolved", "researching", "proposed", "superseded"]),
  })
  .strict()
  .readonly();

const acceptedDecisionSchema = z
  .object({
    acceptedAt: z.iso.date(),
    adr: z.string().regex(/^docs\/decisions\/ADR-\d{3}-[a-z0-9-]+\.md$/),
    deadline: nonPlaceholderSchema,
    evidence: z
      .array(repositoryPathSchema)
      .min(1)
      .refine((paths) => new Set(paths).size === paths.length, {
        message: "Duplicate evidence path.",
      })
      .readonly(),
    id: decisionIdSchema,
    owner: nonPlaceholderSchema,
    requiredFields: requiredFieldsSchema,
    selected: nonPlaceholderSchema,
    status: z.literal("accepted"),
    values: z.record(decisionFieldSchema, nonPlaceholderSchema),
  })
  .strict()
  .readonly()
  .superRefine((decision, context) => {
    const required = new Set(decision.requiredFields);
    const supplied = Object.keys(decision.values);
    const missing = decision.requiredFields.filter(
      (field) => !(field in decision.values),
    );
    const extra = supplied.filter((field) => !required.has(field));
    if (missing.length > 0 || extra.length > 0) {
      context.addIssue({
        code: "custom",
        message: `Decision fields do not match requirements; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`,
      });
    }
  });

export const decisionRecordSchema = z.discriminatedUnion("status", [
  pendingDecisionSchema,
  acceptedDecisionSchema,
]);

export const decisionGateSchema = z
  .object({
    id: decisionGateIdSchema,
    requiredDecisions: z
      .array(decisionIdSchema)
      .min(1)
      .refine((items) => new Set(items).size === items.length)
      .readonly(),
  })
  .strict()
  .readonly();

export const decisionCatalogSchema = z
  .object({
    decisions: z.array(decisionRecordSchema).readonly(),
    gates: z.array(decisionGateSchema).readonly(),
    version: z.literal(1),
  })
  .strict()
  .readonly()
  .superRefine((catalog, context) => {
    const decisionIds = new Set(catalog.decisions.map(({ id }) => id));
    const gateIds = new Set<string>();
    if (decisionIds.size !== catalog.decisions.length) {
      context.addIssue({ code: "custom", message: "Duplicate decision ID." });
    }
    for (const gate of catalog.gates) {
      if (gateIds.has(gate.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate gate ID: ${gate.id}.`,
        });
      }
      gateIds.add(gate.id);
      for (const decisionId of gate.requiredDecisions) {
        if (!decisionIds.has(decisionId)) {
          context.addIssue({
            code: "custom",
            message: `Gate ${gate.id} references missing decision ${decisionId}.`,
          });
        }
      }
    }
  });

export type DecisionCatalog = z.infer<typeof decisionCatalogSchema>;
export type DecisionGateId = z.infer<typeof decisionGateIdSchema>;

export function closedDecisionIds(
  catalog: DecisionCatalog,
  gateId: DecisionGateId,
): readonly string[] {
  const gate = catalog.gates.find(({ id }) => id === gateId);
  if (!gate) throw new Error(`Decision gate is not defined: ${gateId}.`);
  const statuses = new Map(
    catalog.decisions.map((decision) => [decision.id, decision.status]),
  );
  return gate.requiredDecisions.filter(
    (decisionId) => statuses.get(decisionId) !== "accepted",
  );
}

export function assertDecisionGateOpen(
  catalogInput: DecisionCatalog,
  gateId: DecisionGateId,
): void {
  const catalog = decisionCatalogSchema.parse(catalogInput);
  const closed = closedDecisionIds(catalog, gateId);
  if (closed.length > 0) {
    throw new Error(
      `Decision gate ${gateId} is closed by: ${closed.join(", ")}.`,
    );
  }
}
