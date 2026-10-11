# Local test sign-in picker

Branch `feat/dev-sign-in-picker`, stacked on `feat/w4-07-alpha-acceptance`.

Why: the manual stack required pasting a session cookie into the browser console, because real
wallet sign-in is not enabled (W2-10B). The user asked for a click-to-sign-in flow instead.

Built: `tests/e2e/src/sign-in-picker.ts` (page, sign-in, sign-out), `src/stack-proxy.ts` (front door on
the stack port; the web server moved to a free internal port), stack actors gained `id` and `landing`,
`cookieSnippet` removed. Nothing in the web app changed.

Safety: it lives in the test stack only, so a deployed build cannot contain it. Cross-origin POSTs are
refused, forms are capped at 4 KiB, output is HTML-escaped, tokens never appear on the page.

Evidence: typecheck, lint, unit, integration, coverage (90.56% branches overall), 8 mutations all
killed, and a real Chromium run against `pnpm stack`: the picker rendered, and clicking Reviewer landed
signed in on `/admin/collection-reviews`.
