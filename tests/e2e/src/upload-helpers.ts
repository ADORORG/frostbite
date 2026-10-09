import { useE2ESession, type E2ESessionContext } from "./session.ts";

export const processingTimeout = 90_000;

export async function signIn(
  page: { context(): E2ESessionContext },
  baseURL: string | undefined,
  actor: { readonly sessionToken: string },
): Promise<void> {
  if (baseURL === undefined) throw new Error("Expected configured base URL");
  await useE2ESession(page.context(), baseURL, actor.sessionToken);
}

interface FileInputPage {
  locator(selector: string): {
    setInputFiles(file: {
      buffer: Buffer;
      mimeType: string;
      name: string;
    }): Promise<void>;
  };
}

export function chooseImage(
  page: FileInputPage,
  name: string,
  mimeType: string,
  buffer: Buffer,
) {
  return page
    .locator('input[type="file"]')
    .setInputFiles({ buffer, mimeType, name });
}
