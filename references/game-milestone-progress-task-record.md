# Milestone progress and counted repeatable milestones (SDK-3)

Branch `feat/game-milestone-progress`, on top of `feat/game-player-id`. Owner decisions (2026-10-13, surveys):
progress counts live in the account state with a migration; the game sends the current total; repeatable milestones
count each earning through repeated `milestones.unlock`; the manifest sets a maximum per milestone; the page shows a
toast with the count and the count in the dock.

## Decisions taken on the documented defaults (review at merge)

- **Manifest rules:** `target` only on a milestone earned once (min 2), `maxCount` required on a repeatable one
  (min 2). A repeatable milestone cannot have a target (a total toward a goal and a counted earning are different
  things). Existing manifests without either hash as before.
- **A milestone with a target is earned by progress, not by `unlock`**: `unlock` for it is refused. Otherwise a game
  could skip its own target.
- **Counts and totals merge by the larger side**, so a replayed sync changes nothing. Two devices that each earned a
  repeatable milestone offline are counted once between them (a counter per device would fix it; not worth it yet).
  The page never calls a count a total of the player's play.
- **The account enforces the limits**, not the page: counts are cut to `maxCount` (1 for once), totals to the
  target, on the way in and on the way out (a manifest may lower a limit later), and a milestone whose total reaches
  its target is earned by the account, at the time it first saw it.
- **Additive protocol:** new `milestones.progress` and `milestones.counts`; `milestones.list` and the `unlock` answer
  keep their shape (`already-unlocked` is still the answer to a counted repeat). The host builds the list answer
  from named fields, because spreading the declaration would have put the new manifest fields into a strict answer.
- **No toast for progress** (only the dock shows `7 of 10`); a toast for each newly earned or counted milestone.

## What was built

- Shared: manifest `target`/`maxCount` with rules; `count` on a milestone record and `counters` in the state; the
  merge keeps the larger count and total.
- Database: `game_milestone_unlocks.count` and the new `game_milestone_counters` table (migration
  `game_milestone_progress`), with bounds.
- `@ador/game-saves`: `rules.ts` (`boundState`, `earnReached`), the service enforces them and refuses a total for an
  unknown or target-less milestone (`no-target`); the repository reads and writes both tables.
- SDK: protocol methods, policy `progressCallsPerMinute`, `host-milestones.ts` (handlers split out so `host.ts`
  stays under 300 lines; types moved to `host-types.ts`, re-exported from `host.ts`), local and synced backends keep
  counts and totals, client `progress` and `counts`.
- Page: count and total in the Milestones dock section, toast with the count, refresh on counting and progress.
- SDK explorer: `milestones.progress` and `milestones.counts` probes; `first-call` is now repeatable (max 5) and
  `ten-presses` has a target of 10.

## Evidence

- Unit and integration tests: shared (manifest rules, merge, bounds), game-saves (rules and service, and PostgreSQL:
  larger side wins, limits hold, reaching a target earns, replay changes nothing), game-sdk (host, local backend,
  client), feature-games (presenter, dock, toast, operation), explorer.
- 23 mutants of the guards (count cap, cut to target, earning at the target, earning once, refusing a total without a
  target or for an unknown id, bounding on the way out, merge by larger side for totals and counts, manifest rules,
  both repository writes, local cut and count limit, host refusals and rate limit, repeatable limit, presenter, toast
  count, progress refresh, operation mapping): all killed on the first run.
- Browser (real frame, real server): the explorer's repeatable milestone stops at five after seven presses; its
  target milestone shows `4 of 10` in the dock, is earned on the tenth press and stays at ten after another.

- Gates: format, lint (45 tasks, repository policy; two test files were split to stay within 300 lines), typecheck
  (45). Coverage: game-sdk 98.27/97.91/98.26/98.34, game-saves 98.41/97.29/100/98.24 (a first run failed the
  branch threshold at 89.18%; `rules.ts` got direct tests), feature-games 98.68/96.35/97.87/99.04, shared
  98.92/99.03/97.76/98.86, test-kit 96.88/91.48/96.61/97.23, database 96.13/95.83/93.87/96.02. Web unit 54 and
  integration 46 pass. Full e2e 366 passed, 62 skipped by design; the four games-list snapshots failed (the explorer
  now shows two milestones), were regenerated and re-run stable (16 passed).

## Known gaps

- The migration was applied to an empty test database only. Offline devices undercount (see above).
- The formal three-pass review was not run. FROST·BITE declares no targets or repeatable milestones yet.
