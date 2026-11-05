import {
  creatorApplicationResponseSchema,
  type CreatorApplicationResponse,
} from "@frostbite/shared/creator-admission";

// Sends one of the creator admission routes (method and path come from the shared contract).
export async function sendCreatorAdmissionRequest(
  route: { readonly method: string; readonly path: string },
  body: object,
): Promise<CreatorApplicationResponse> {
  const response = await fetch(route.path, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    method: route.method,
  });
  // `unknown` is the honest type of a response body: it is untrusted until the shared schema accepts it.
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error("The request could not be completed.");
  return creatorApplicationResponseSchema.parse(payload);
}

export function AdmissionField({
  label,
  name,
  defaultValue = "",
  required = true,
}: {
  readonly defaultValue?: string;
  readonly label: string;
  readonly name: string;
  readonly required?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input defaultValue={defaultValue} name={name} required={required} />
    </label>
  );
}
