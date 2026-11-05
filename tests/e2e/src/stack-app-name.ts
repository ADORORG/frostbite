import { parseEnv } from "node:util";

// The name the platform calls itself in what it sends (the sign-in email). The browser tests give it a fixture name ("Frostbite E2E") so a
// test can tell its own messages apart; the manual stack is a place to see the product as it will be, so it uses the settings file's
// `NEXT_PUBLIC_APP_NAME` (or the shell's) and keeps the fixture only when neither is set.
export function appNameFrom(
  fileText: string | null,
  shell: NodeJS.ProcessEnv,
): string | null {
  const fromShell = shell.NEXT_PUBLIC_APP_NAME?.trim();
  if (fromShell !== undefined && fromShell !== "") return fromShell;
  const fromFile =
    fileText === null ? undefined : parseEnv(fileText).NEXT_PUBLIC_APP_NAME;
  const name = fromFile?.trim();
  return name === undefined || name === "" ? null : name;
}
