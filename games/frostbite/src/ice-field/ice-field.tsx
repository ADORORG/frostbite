import * as React from "react";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { useEffect, useReducer, useRef, useState } from "react";

import { IceBoard } from "./ice-board.tsx";
import { IceControls } from "./ice-controls.tsx";
import type { CabinetHost } from "../cabinet/host.ts";
import { markOf } from "../cabinet/marks.ts";
import { RecordView } from "../cabinet/record-view.tsx";
import { randomSeed } from "../cabinet/seed.ts";
import { usePlatformRun } from "../cabinet/use-platform-run.ts";
import { neighbourMines } from "./neighbours.ts";
import { createIceFieldSession, type IceFieldSession } from "./session.ts";

export type IceFieldHost = CabinetHost;

type Phase = "ended" | "idle" | "playing";

// The ice-field cabinet: a launcher on the page and, when opened, a board played through the platform's own rules, with
// the run written into a record as it goes. It keeps its own icicles and glaciers (the core's), apart from the rest of
// the game, and reports the milestones it earns through the game's milestone bridge, which is the player's own claim today.
export function IceField({
  host,
  newSeed = randomSeed,
}: {
  readonly host: IceFieldHost;
  readonly newSeed?: () => number;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<IceFieldSession | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const platformRun = usePlatformRun(host.runs);
  // The session changes inside itself; the screen is drawn again after each input.
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  const start = async () => {
    // A run on the platform's seed when the platform gives one; otherwise the browser's own, reported as such.
    const { note, seed } = await platformRun.begin(
      newSeed,
      "Pick a tile. A mine ends the board.",
    );
    setSession(
      createIceFieldSession({
        onEarned: (milestone) => host.milestone(markOf(milestone)),
        seed,
      }),
    );
    setPhase("playing");
    setMessage(note);
  };
  const state = session?.state();
  const nextCost = session?.nextGlacierCost() ?? null;

  const pick = (tile: number) => {
    if (session === null) return;
    const outcome = session.pick(tile);
    const { board } = session.state();
    setMessage(
      !outcome.ok
        ? outcome.reason
        : board.busted
          ? "Mine! Settle the board to move on."
          : `Safe: ${String(neighbourMines(tile, board.mines))} mines next to it.`,
    );
    redraw();
  };
  const settle = () => {
    const outcome = session?.settle();
    if (outcome === undefined) return;
    const result = outcome.ok ? outcome.settled : undefined;
    setMessage(
      !outcome.ok
        ? outcome.reason
        : result?.result === "won"
          ? `Board won: +${String(result.gained)} icicles.`
          : result?.result === "busted"
            ? "Mine struck: nothing banked."
            : "Board skipped.",
    );
    redraw();
  };
  const build = () => {
    const outcome = session?.buildGlacier();
    if (outcome === undefined) return;
    setMessage(
      outcome.ok
        ? `Glacier tier ${String(session?.state().glacierTier)} built.`
        : outcome.reason,
    );
    redraw();
  };
  const end = () => {
    if (session === null) return;
    const finished = session.record();
    setRecord(finished);
    setPhase("ended");
    setMessage("");
    platformRun.send(finished);
  };

  return (
    <>
      <button
        aria-controls="ice-field-panel"
        aria-expanded={open}
        className="if-launcher"
        onClick={() => (open ? close() : setOpen(true))}
        ref={launcher}
        type="button"
      >
        Ice field
      </button>
      {open ? (
        <section
          aria-label="Ice field cabinet"
          className="if-panel"
          id="ice-field-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          ref={panel}
          role="dialog"
          tabIndex={-1}
        >
          <header className="if-header">
            <h2>Ice field</h2>
            <button
              className="if-button if-button--quiet"
              onClick={close}
              type="button"
            >
              Close
            </button>
          </header>
          {phase === "idle" ? (
            <div className="if-intro">
              <p>
                A field of frost tiles with hidden mines. Pick safe tiles,
                settle the board to bank icicles, and spend them on a glacier.
                Every step you take is written into a run record that the
                platform can replay.
              </p>
              <button
                className="if-button"
                onClick={() => void start()}
                type="button"
              >
                Start a run
              </button>
            </div>
          ) : null}
          {phase === "playing" && state !== undefined ? (
            <div className="if-play">
              <IceBoard disabled={false} onPick={pick} state={state} />
              <div className="if-side">
                <IceControls
                  canBuild={nextCost !== null && state.icicles >= nextCost}
                  nextCost={nextCost}
                  onBuild={build}
                  onEnd={end}
                  onSettle={settle}
                  state={state}
                />
                <p aria-live="polite" className="if-status" role="status">
                  {message}
                </p>
              </div>
            </div>
          ) : null}
          {phase === "ended" && record !== null ? (
            <RecordView
              onAgain={() => void start()}
              record={record}
              submit={platformRun.submitted}
            />
          ) : null}
          {phase === "playing" ? null : (
            <p aria-live="polite" className="if-status" role="status">
              {message}
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
