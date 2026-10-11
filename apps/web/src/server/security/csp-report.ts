import {
  cspReportMaxBytes,
  parseCspReport,
  type CspReport,
} from "@ador/shared/csp-report";

// Reads a violation report from a request, or null when it is too large, empty, or not a report.
export async function readCspReport(
  request: Request,
): Promise<CspReport | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > cspReportMaxBytes) return null;
  const body = await request.text().catch(() => "");
  if (body.length === 0 || body.length > cspReportMaxBytes) return null;
  return parseCspReport(body);
}
