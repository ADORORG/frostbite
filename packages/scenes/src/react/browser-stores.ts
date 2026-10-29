import {
  readDeviceSignals,
  type DeviceSignals,
  type Preference,
  type UserChoice,
} from "../engine/index.ts";

// What the browser owns, as external stores React can read without setting state in an effect. On the server nothing is known, so both
// read as "not asked yet", and the first render matches what the server sent.

// The device's requests for less motion or less data, as one string so the snapshot is stable between reads. "pending" before the browser
// has been asked.
export const devicePending = "pending";

export function deviceSnapshot(): string {
  const signals = readDeviceSignals({
    matchMedia: window.matchMedia.bind(window),
    navigator,
  });
  return `${signals.reducedMotion ? 1 : 0}${signals.saveData ? 1 : 0}${signals.lowPower ? 1 : 0}`;
}

export function deviceFrom(snapshot: string): DeviceSignals | null {
  if (snapshot === devicePending) return null;
  return {
    reducedMotion: snapshot[0] === "1",
    saveData: snapshot[1] === "1",
    lowPower: snapshot[2] === "1",
  };
}

// Reduced motion is the one signal that can change while the page is open.
export function subscribeToDevice(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The remembered choice, readable and writable, telling every reader when it changes (and when another tab changes it).
export function createChoiceStore(preference: Preference) {
  const listeners = new Set<() => void>();
  return {
    read: (): UserChoice | null => preference.read(),
    subscribe: (onChange: () => void): (() => void) => {
      listeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    write: (choice: UserChoice): void => {
      preference.write(choice);
      for (const listener of listeners) listener();
    },
  };
}
