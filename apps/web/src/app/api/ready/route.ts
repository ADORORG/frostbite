import { getReadiness } from "@/server/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Readiness for the hosting platform and monitors: 200 when the database and object storage answer, 503 when
// one does not. The body names each check and its outcome and nothing else. Liveness is separate: a service
// that is alive but not ready is taken out of rotation, not restarted.
export async function GET() {
  const readiness = await getReadiness();
  return Response.json(readiness, {
    headers: { "cache-control": "no-store" },
    status: readiness.status === "ready" ? 200 : 503,
  });
}
