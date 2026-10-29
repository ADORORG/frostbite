import type { UserChoice } from "./policy.ts";

export const preferenceKey = "scenes:animation";

// The part of `localStorage` used. It can be missing (a private window, blocked site data) or throw, and the page must work without it.
export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Preference {
  readonly read: () => UserChoice | null;
  readonly write: (choice: UserChoice) => void;
}

// The person's remembered choice about animation. Anything but a value written here reads as no choice.
export function createPreference(
  storage: PreferenceStorage | null,
): Preference {
  return {
    read: () => {
      try {
        const stored = storage?.getItem(preferenceKey);
        return stored === "on" || stored === "off" ? stored : null;
      } catch {
        return null;
      }
    },
    write: (choice) => {
      try {
        storage?.setItem(preferenceKey, choice);
      } catch {
        // The choice still holds for this visit; it is just not remembered.
      }
    },
  };
}
