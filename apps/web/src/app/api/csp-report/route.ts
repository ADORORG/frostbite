import { getRateLimitGate, tooManyRequests } from "@/server/rate-limit";
import { readCspReport } from "@/server/security/csp-report";

export const runtime = "nodejs";

// Browsers post here when a page breaks the Content Security Policy (or would, in report-only mode). The report
// is bounded, reduced to a few short fields and written to the log; nothing in it is trusted or stored. It is
// open to anyone, so it is limited by address like any other public endpoint.
export async function POST(request: Request) {
  const limited = await getRateLimitGate().byAddress({
    headers: request.headers,
    method: "POST",
    operationId: "cspReport",
    publicOperation: true,
  });
  if (limited !== null) return tooManyRequests(limited);
  const report = await readCspReport(request);
  if (report !== null) console.warn(`csp-report ${JSON.stringify(report)}`);
  return new Response(null, { status: 204 });
}
