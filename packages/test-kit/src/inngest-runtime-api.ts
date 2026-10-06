import { waitFor, type InngestRuntime } from "./inngest-runtime.ts";

interface EventsResponse {
  readonly data: readonly {
    readonly id: string;
    readonly internal_id: string;
  }[];
}
interface RunsResponse {
  readonly data: readonly { readonly status: string }[];
}

// Reads the runtime's own record of events and runs through its REST API (authorized by the
// signing key). The runs endpoint caches for ~15 s, so status polling is deliberately patient.
export function runtimeApi(runtime: InngestRuntime, signingKey: string) {
  const headers = { authorization: `Bearer ${signingKey}` };
  async function get<Body>(path: string): Promise<Body> {
    const response = await fetch(`${runtime.baseUrl}${path}`, { headers });
    if (!response.ok) throw new Error(`${path} answered ${response.status}`);
    return response.json();
  }
  // Inngest keeps every event record it receives but starts a single run per event id, so runs are
  // gathered across all records that share the id.
  async function runsFor(
    eventId: string,
  ): Promise<readonly { readonly status: string }[]> {
    const records = (await get<EventsResponse>("/v1/events")).data.filter(
      ({ id }) => id === eventId,
    );
    const runs = await Promise.all(
      records.map(
        async ({ internal_id }) =>
          (await get<RunsResponse>(`/v1/events/${internal_id}/runs`)).data,
      ),
    );
    return runs.flat();
  }
  return {
    async eventRecordCount(eventId: string): Promise<number> {
      return (await get<EventsResponse>("/v1/events")).data.filter(
        ({ id }) => id === eventId,
      ).length;
    },
    async runCount(eventId: string): Promise<number> {
      return (await runsFor(eventId)).length;
    },
    // Waits until the single run reaches exactly `wanted`. The status is only trusted for
    // `Completed`: a run reads `Failed` from its first failed attempt while retries are pending.
    async waitForStatus(eventId: string, wanted: string): Promise<string> {
      return waitFor(
        async () =>
          (await this.status(eventId)) === wanted ? wanted : undefined,
        60_000,
        `run status ${wanted} for ${eventId}`,
      );
    },
    async status(eventId: string): Promise<string | undefined> {
      return (await runsFor(eventId))[0]?.status;
    },
  };
}
