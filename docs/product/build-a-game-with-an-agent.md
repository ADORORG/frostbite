# Building a game with an AI agent

The platform ships a skill, `build-a-game`, that teaches a coding agent (Claude Code, or any agent that reads `AGENTS.md`) how a game
here is made, tested and submitted. You describe the game; the agent builds it to the platform's rules and tells you what it ran.

## Install it

Pick the route that fits where you are. All three put the same folder in your project.

| You have                                    | Run                                                                                                                       | Needs                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| The SDK installed                           | `npx ador-game-skill install` (the command is the SDK's `bin` named `ador-game-skill`)                                    | The SDK package      |
| A public GitHub repository for the platform | `npx skills add <link to skills/build-a-game>`, add `-a claude-code` to choose the agent and `-g` for all projects        | Node; no npm publish |
| A checkout of the repository                | `node --experimental-strip-types packages/game-sdk/src/skill/bin.ts install --from skills/build-a-game` (no build needed) | The checkout         |

`npx skills` (plural) is the open skills installer. `npx skill` (singular) is a different tool that installs into another product's
folder; do not use it. `doctor` checks that the installed copy matches the SDK; `update` refreshes it; a copy you edited is kept
unless you pass `--force`.

The SDK route also writes a marked block into the project's `AGENTS.md`, so an agent that does not load skills is still told to
read `.claude/skills/build-a-game/SKILL.md`.

## What to say

Describe the game as you would to a person: what you do, how a run ends, how it is controlled, and the things you want players to
earn. The agent asks only what it cannot decide. Good first prompts:

- "Build a one-button game where you guide a snowball through gaps. I want 20 milestones for score and streaks."
- "Add a game like the platformer in `games/bro-maria`, but vertical."

## What you get back

A branch with the game, its manifest and tests, and a report of the commands the agent ran with their results, and what it could not
check (how it looks and sounds, touch on a real phone, other browsers). Open the game with `pnpm game:dev <id>` and play it before you
submit it. Nothing is pushed or deployed for you.

## Keeping the skill true

The skill is part of the repository, so it is reviewed like code. `pnpm repository:check` fails if a path or script it names no
longer exists, if it names the platform instead of looking the name up, or if a reference is not linked from `SKILL.md`. When the
platform adds a rule for games, add it to the skill in the same pull request.
