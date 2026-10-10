import { useCallback, useState } from "react";

export interface Action<Failure> {
  // Runs `work`, resolving true when it finished and false when it failed (the failure is in `notice`).
  readonly act: (work: () => Promise<void>) => Promise<boolean>;
  readonly busy: boolean;
  readonly dismissNotice: () => void;
  // The last failed action, until it is dismissed or the next action starts.
  readonly notice: Failure | null;
}

// One action at a time with its own busy flag and failure notice: the shape every mutation shares. A
// caught value is `unknown`; the feature's `describe` narrows it into its own failure words.
export function useAction<Failure>(
  describe: (error: unknown) => Failure,
): Action<Failure> {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Failure | null>(null);
  const act = useCallback(
    async (work: () => Promise<void>): Promise<boolean> => {
      setBusy(true);
      setNotice(null);
      try {
        await work();
        return true;
      } catch (error) {
        setNotice(describe(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [describe],
  );
  return { act, busy, dismissNotice: () => setNotice(null), notice };
}
