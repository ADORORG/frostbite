import type { FeeSpeed } from "@ador/shared/chain";
import type {
  GameAdminAction,
  GameAdminStep,
  GameAdminTransaction,
  ListGameAdminStepsResponse,
  ListGameAdminTemplatesResponse,
} from "@ador/shared/games";
import { walletRefusedCopy } from "@ador/wallet/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { GameAdminApi } from "../client/api.ts";
import {
  actionLabel,
  isSettledStep,
  recordRefusalCopy,
  startRefusalCopy,
  submitRefusalCopy,
} from "../domain/copy.ts";
import { failureCopy } from "../domain/failure-copy.ts";
import type { Starting } from "./starting.ts";

// What staff's wallet is asked to sign, and what it gives back. Where no wallet can sign steps there is none, and the page lets
// staff sign elsewhere and paste the result.
export type StepSigner = (
  transaction: GameAdminTransaction,
) => Promise<GameAdminTransaction | null>;

// How often a step that is not over is looked at.
export const defaultStepPollMs = 4_000;

export interface StartContext {
  readonly authTokenOutput?: string | undefined;
  readonly feeSpeed?: FeeSpeed | undefined;
  readonly wallet: string;
}

// What the page knows besides the log: for a game, whether it has its contract and whether the templates are ready; for the
// templates, which are published and where.
export type Overview =
  | ({ readonly kind: "game" } & Pick<
      ListGameAdminStepsResponse,
      "contract" | "drawingCeiling" | "templatesReady"
    >)
  | ({ readonly kind: "templates" } & Pick<
      ListGameAdminTemplatesResponse,
      "publishable" | "published"
    >);

// The log of one game's steps (or, with no game, of the steps that publish templates): loaded, started, reviewed and signed (or
// sent signed), and followed until each is over. The platform decides what each state means; this only shows it.
export function useAdminSteps(options: {
  readonly api: GameAdminApi;
  // The game the steps are about; null for the steps that publish templates.
  readonly gameId: string | null;
  readonly pollMs?: number;
  readonly sign?: StepSigner;
}) {
  const { api, gameId, sign } = options;
  const pollMs = options.pollMs ?? defaultStepPollMs;
  const [steps, setSteps] = useState<readonly GameAdminStep[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // An action that was asked for and has not yet become a step to review: what it is, and why it did not, if it did not.
  const [starting, setStarting] = useState<Starting | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);

  const upsert = useCallback((step: GameAdminStep) => {
    setSteps((held) =>
      held.some(({ id }) => id === step.id)
        ? held.map((entry) => (entry.id === step.id ? step : entry))
        : [...held, step],
    );
  }, []);

  // Asks for the log and the overview: run on arrival and whenever a step ends, since a step ending changes both.
  const fetchState = useCallback(
    (): Promise<{
      readonly overview: Overview;
      readonly steps: readonly GameAdminStep[];
    }> =>
      gameId === null
        ? api.templates().then(({ publishable, published, steps: held }) => ({
            overview: { kind: "templates", publishable, published },
            steps: held,
          }))
        : api
            .list(gameId)
            .then(
              ({ contract, drawingCeiling, steps: held, templatesReady }) => ({
                overview: {
                  contract,
                  drawingCeiling,
                  kind: "game",
                  templatesReady,
                },
                steps: held,
              }),
            ),
    [api, gameId],
  );
  const apply = useCallback(
    (state: {
      readonly overview: Overview;
      readonly steps: readonly GameAdminStep[];
    }) => {
      setOverview(state.overview);
      state.steps.forEach(upsert);
    },
    [upsert],
  );

  useEffect(() => {
    let current = true;
    fetchState().then(
      (state) => {
        if (current) apply(state);
      },
      (error: unknown) => {
        if (current) setMessage(failureCopy(error, "load"));
      },
    );
    return () => {
      current = false;
    };
  }, [apply, fetchState]);

  const watching = useMemo(
    () =>
      steps
        .filter(({ state }) => !isSettledStep(state))
        .map(({ id }) => id)
        .join(","),
    [steps],
  );
  useEffect(() => {
    if (watching === "") return;
    const timer = setInterval(() => {
      for (const stepId of watching.split(","))
        api.refresh(stepId).then(
          (answer) => {
            if (answer.status !== "ok") return;
            upsert(answer.step);
            if (isSettledStep(answer.step.state))
              fetchState().then(apply, () => undefined);
          },
          () => undefined,
        );
    }, pollMs);
    return () => clearInterval(timer);
  }, [api, apply, fetchState, pollMs, upsert, watching]);

  const start = useCallback(
    async (action: GameAdminAction, context: StartContext) => {
      const label = actionLabel(action);
      setMessage(null);
      setStarting({ failure: null, label });
      try {
        const answer = await api.start({
          action,
          ...(context.authTokenOutput === undefined ||
          context.authTokenOutput === ""
            ? {}
            : { authTokenOutput: context.authTokenOutput }),
          ...(context.feeSpeed === undefined
            ? {}
            : { feeSpeed: context.feeSpeed }),
          gameId,
          wallet: context.wallet,
        });
        if (answer.status === "started") {
          upsert(answer.step);
          setActiveId(answer.step.id);
          setStarting(null);
        } else {
          setStarting({
            failure: [startRefusalCopy[answer.reason], answer.detail]
              .filter((part) => part !== undefined)
              .join(" "),
            label,
          });
        }
      } catch (error) {
        setStarting({ failure: failureCopy(error, "start"), label });
      }
    },
    [api, gameId, upsert],
  );

  const active = steps.find(({ id }) => id === activeId) ?? null;
  const send = useCallback(
    async (signed: GameAdminTransaction | null) => {
      if (active === null) return;
      if (signed === null) return setMessage("Nothing was signed.");
      try {
        const answer = await api.submit({ signed, stepId: active.id });
        if (answer.status === "submitted") upsert(answer.step);
        else setMessage(submitRefusalCopy[answer.reason]);
      } catch (error) {
        setMessage(failureCopy(error, "send"));
      }
    },
    [active, api, upsert],
  );

  // Staff enter where the contract this step made is. The platform checks it; what it accepts is the step, now complete, and the
  // game's record is read again, since it now has its contract.
  const record = useCallback(
    async (address: string) => {
      if (active === null) return;
      setWorking(true);
      setMessage(null);
      try {
        const answer = await api.record({ address, stepId: active.id });
        if (answer.status === "recorded") {
          upsert(answer.step);
          apply(await fetchState());
        } else setMessage(recordRefusalCopy[answer.reason]);
      } catch (error) {
        setMessage(failureCopy(error, "record"));
      } finally {
        setWorking(false);
      }
    },
    [active, api, apply, fetchState, upsert],
  );

  const signWithWallet = useCallback(async () => {
    const transaction = active?.toSign ?? null;
    if (transaction === null || sign === undefined) return;
    setWorking(true);
    setMessage(null);
    let signed: GameAdminTransaction | null;
    try {
      signed = await sign(transaction);
    } catch (error) {
      // The wallet was closed or declined, or what it answered could not be used: nothing was sent, and the step can be signed again.
      // The cause is kept for the console and told on the page, so a wallet that signed but answered in a shape the platform cannot
      // use is not reported as a refusal.
      console.error("Signing a game administration step failed.", error);
      setWorking(false);
      return setMessage(walletRefusedCopy(error));
    }
    try {
      await send(signed);
    } finally {
      setWorking(false);
    }
  }, [active, send, sign]);

  // Staff signed elsewhere and pasted the signed payload: it joins the transaction that was shown.
  const sendPasted = useCallback(
    async (payload: string) => {
      const transaction = active?.toSign ?? null;
      if (transaction === null) return;
      if (payload.trim() === "")
        return setMessage("Paste the signed transaction first.");
      setWorking(true);
      setMessage(null);
      try {
        await send({ ...transaction, payload: payload.trim() });
      } finally {
        setWorking(false);
      }
    },
    [active, send],
  );

  return {
    active,
    canSign: sign !== undefined,
    dismiss: useCallback(() => {
      setActiveId(null);
      setStarting(null);
    }, []),
    message,
    overview,
    record,
    reopen: useCallback((stepId: string) => setActiveId(stepId), []),
    sendPasted,
    sign: signWithWallet,
    start,
    starting,
    steps,
    working,
  };
}

export type AdminSteps = ReturnType<typeof useAdminSteps>;
