import * as React from "react";
import type { RunRecord } from "@ador/game-sdk/run-record";
import { useEffect, useReducer, useRef, useState } from "react";

import type { CabinetHost } from "../cabinet/host.ts";
import { markOf } from "../cabinet/marks.ts";
import { RecordView } from "../cabinet/record-view.tsx";
import { randomSeed } from "../cabinet/seed.ts";
import { usePlatformRun } from "../cabinet/use-platform-run.ts";
import { SnakeGrid } from "./grid.tsx";
import { directionOfKey } from "./keys.ts";
import { SnakePad } from "./pad.tsx";
import { createSnakeSession, type SnakeSession } from "./session.ts";
import { tickMs as defaultTickMs } from "./timing.ts";
import { targetLength } from "../verifier/snake.ts";
import type { Direction } from "../verifier/snake-board.ts";

type Phase = "ended" | "idle" | "playing";

const instruction = `Steer with the arrow keys, WASD or the pad. Grow the snake to ${String(targetLength)}; a mine, or your own tail, ends the run.`;

// The SAT SNAKE cabinet: a launcher on the page and, when opened, a snake played through the rules the platform replays. The
// timer is the only clock; each tick is one move, and the run is written into a record of the player's choices as it goes.
export function SatSnake({
  host,
  newSeed = randomSeed,
  tickMs = defaultTickMs,
}: {
  readonly host: CabinetHost;
  readonly newSeed?: () => number;
  readonly tickMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<SnakeSession | null>(null);
  const [record, setRecord] = useState<RunRecord | null>(null);
  const platformRun = usePlatformRun(host.runs);
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  const finish = (finished: SnakeSession) => {
    const closed = finished.record();
    setRecord(closed);
    setPhase("ended");
    setMessage(
      finished.state().alive ? "" : "The snake crashed. The run is over.",
    );
    platformRun.send(closed);
  };

  useEffect(() => {
    if (phase !== "playing" || session === null) return;
    const timer = setInterval(() => {
      session.tick();
      redraw();
      if (session.state().ended) finish(session);
    }, tickMs);
    return () => clearInterval(timer);
    // The timer belongs to the run; `finish` only reads the session and sets state.
  }, [phase, session, tickMs]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  const start = async () => {
    const { note, seed } = await platformRun.begin(newSeed, instruction);
    setSession(
      createSnakeSession({
        onEarned: (milestone) => host.milestone(markOf(milestone)),
        seed,
      }),
    );
    setRecord(null);
    setPhase("playing");
    setMessage(note);
  };
  const turn = (direction: Direction) => {
    if (session === null || phase !== "playing") return;
    const outcome = session.turn(direction);
    if (!outcome.ok) setMessage(outcome.reason);
    redraw();
  };
  const state = session?.state();

  return (
    <>
      <button
        aria-controls="sat-snake-panel"
        aria-expanded={open}
        className="if-launcher sn-launcher"
        onClick={() => (open ? close() : setOpen(true))}
        ref={launcher}
        type="button"
      >
        Sat snake
      </button>
      {open ? (
        <section
          aria-label="Sat snake cabinet"
          className="if-panel sn-panel"
          id="sat-snake-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") return close();
            const direction = directionOfKey(event.key);
            if (direction === undefined) return;
            event.preventDefault();
            turn(direction);
          }}
          ref={panel}
          role="dialog"
          tabIndex={-1}
        >
          <header className="if-header">
            <h2>Sat snake</h2>
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
                Grow the chain and dodge your tail and the mines. Every turn you
                make is written into a run record that the platform can replay,
                and the mines are all in plain view.
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
            <div className="if-play sn-play">
              <SnakeGrid state={state} />
              <div className="if-side">
                <dl className="if-stats">
                  <div>
                    <dt>Length</dt>
                    <dd>{state.snake.length}</dd>
                  </div>
                  <div>
                    <dt>Moves</dt>
                    <dd>{state.tick}</dd>
                  </div>
                </dl>
                <SnakePad onTurn={turn} />
                <button
                  className="if-button if-button--quiet"
                  onClick={() => session !== null && finish(session)}
                  type="button"
                >
                  End run
                </button>
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
