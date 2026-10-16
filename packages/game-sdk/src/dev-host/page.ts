// The local test page: a frame for the game beside a panel of what the platform would do. Plain HTML with one script file, the
// way a game's own page is: nothing inline, nothing from another address.
export const devPageHtml = (title: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title.replace(/[<&>"]/gu, "")} · local test host</title>
    <link rel="stylesheet" href="/host.css" />
  </head>
  <body>
    <header>
      <h1>Local test host</h1>
      <p id="dev-note">
        This page stands in for the platform while you build. The wallet, the sign-in and the claims here are made up, and nothing
        is sent anywhere. The platform's own rules decide what players get.
      </p>
    </header>
    <main>
      <section aria-label="Your game" id="dev-stage"></section>
      <section aria-label="What the platform would do" id="dev-panel"></section>
    </main>
    <script src="/host.js"></script>
  </body>
</html>
`;

export const devPageCss = `
body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #10131a; color: #e8ecf4; }
header { padding: 0.75rem 1rem; border-bottom: 1px solid #2a3142; }
h1, h2 { margin: 0; font-size: 1rem; }
header p { margin: 0.25rem 0 0; color: #aab3c5; max-width: 60rem; }
main { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 1rem; padding: 1rem; }
@media (max-width: 52rem) { main { grid-template-columns: 1fr; } }
iframe { width: 100%; height: 70vh; min-height: 24rem; border: 1px solid #2a3142; background: #000; }
#dev-panel { display: grid; gap: 0.75rem; align-content: start; }
#dev-panel section { border: 1px solid #2a3142; padding: 0.5rem 0.75rem; }
#dev-panel h2 { margin-bottom: 0.25rem; }
#dev-panel button, #dev-panel select { font: inherit; margin: 0.125rem 0.25rem 0.125rem 0; }
#dev-log { margin: 0; padding-left: 1.25rem; max-height: 18rem; overflow: auto; font: 12px/1.4 ui-monospace, monospace; }
#dev-toast:not(:empty) { padding: 0.25rem 0.5rem; border: 1px solid #f5c542; }
`;
