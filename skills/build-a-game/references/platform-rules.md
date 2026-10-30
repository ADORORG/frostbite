# What the platform allows

## A game is

- **Client-only.** No server, no `fetch`, no browser storage, no cookies, no CDN scripts or fonts. Everything the game needs is
  bundled with it. It asks the platform page around it to remember things.
- **Built by the platform.** A pull request adds source. CI builds it into static files and serves them under the platform's own
  address in a frame the browser cuts off. No binary is committed. Every game is reviewed before it is merged.
- **Described by one manifest** that is checked when the platform starts: a mistake shows at once.

## What the browser enforces

The frame is `sandbox="allow-scripts"`, served with a policy that allows scripts and styles only from the game's own files and
forbids connections, nested frames and forms. A game cannot read cookies, storage or the platform page, and cannot reach a network.
Allowed: full screen, sound, keyboard and gamepad input. Not allowed: camera, microphone, location, files.

## The page

`index.html` has one `<script src="main.js">` and one stylesheet. No inline script, inline handler, frame, form, object or address
on another origin. Assets are named relative to the page (`assets/a.png`), never `/a.png`.

| Path         | Purpose                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------- |
| `index.html` | The page.                                                                                |
| `styles.css` | The only stylesheet.                                                                     |
| `assets/`    | Static files, copied as they are. A cover picture goes here.                             |
| `src/`       | Rules, session, screen, audio, `main.ts` (the bundle entry), `replay.ts` (the verifier). |
| `test/`      | Unit tests for the rules and an integration test that bundles the game and runs it.      |

## Cover

Optional `cover: { alt, image, video }` in the manifest: `image` is a file name in `assets/` (avif, jpg, png, svg or webp), `video`
a short silent clip (mp4 or webm) or `null`. Use 16:9. The page checks that the named files exist.

## Where progress lives

Signed out: in the player's browser, under keys for this game. Signed in: also on the player's account, merged across devices (newest
save wins; every milestone from either side is kept). The game does nothing for either: it calls `progress.save` and
`milestones.unlock` and the platform does the rest.

## Limits (platform policy, not game code)

64 KB of saved state; 60 saves and 60 unlocks a minute; a call unanswered in ten seconds fails with `unavailable`. Over a limit the
call is refused. Batch saves to about one a second.
