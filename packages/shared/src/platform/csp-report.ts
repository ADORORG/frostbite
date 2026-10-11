import { z } from "zod";

// The most of a report that is read: a real one is a few hundred bytes.
export const cspReportMaxBytes = 8_192;
const fieldMax = 300;

const text = z.string().transform((value) => value.slice(0, fieldMax));

// The fields of a report worth keeping, in the older (`report-uri`) shape and the newer Reporting API shape.
const legacy = z.object({
  "csp-report": z.object({
    "blocked-uri": text.optional(),
    "document-uri": text.optional(),
    "effective-directive": text.optional(),
    "violated-directive": text.optional(),
  }),
});
const modern = z.array(
  z.object({
    body: z.object({
      blockedURL: text.optional(),
      documentURL: text.optional(),
      effectiveDirective: text.optional(),
    }),
  }),
);

export interface CspReport {
  readonly blocked: string;
  readonly directive: string;
  readonly document: string;
}

// Reduces a report's text to its few short fields, or null when it is not JSON or not a report. Everything in
// it is browser-supplied, so only those fields are kept and the rest is dropped.
export function parseCspReport(body: string): CspReport | null {
  let document: unknown;
  try {
    // `unknown` is what parsing untrusted text yields; it is accepted only through the schemas below.
    document = JSON.parse(body);
  } catch {
    return null;
  }
  const old = legacy.safeParse(document);
  if (old.success) {
    const report = old.data["csp-report"];
    return {
      blocked: report["blocked-uri"] ?? "",
      directive:
        report["effective-directive"] ?? report["violated-directive"] ?? "",
      document: report["document-uri"] ?? "",
    };
  }
  const reports = modern.safeParse(document);
  const first = reports.success ? reports.data[0]?.body : undefined;
  return first === undefined
    ? null
    : {
        blocked: first.blockedURL ?? "",
        directive: first.effectiveDirective ?? "",
        document: first.documentURL ?? "",
      };
}
