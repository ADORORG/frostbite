# responder-kit

The three ways a call in these contracts answers (`Answers::forwarded`, `answer`, `number`), written
once. A contract implements `Answers` with an empty `impl`.

- **Dependencies:** `alkanes-runtime`, `alkanes-support` (wasm32 only in practice).
- **Invariant:** every answer returns the incoming alkanes first, so the auth token presented with a
  call always comes back.
- **Tests:** exercised through the harness (`../harness`); it has no logic of its own to measure.
- **Owner:** contract engineering. See `../README.md`.
