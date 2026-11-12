import { join } from "node:path";
import { stat } from "node:fs/promises";

import { vi } from "vitest";

export const gamesDirectory = join(import.meta.dirname, "../../../../games");

// The games the platform registers, as it registers them for a local run.
export async function registeredGames() {
  vi.resetModules();
  vi.stubEnv("APP_ENV", "local");
  vi.stubEnv("PUBLIC_BASE_URL", "https://platform.example.com");
  vi.stubEnv("NEXT_PUBLIC_APP_NAME", "Frostbite");
  vi.stubEnv("GAME_LAUNCHES", "");
  return (await import("@repo/configs/games")).games;
}

export const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );
