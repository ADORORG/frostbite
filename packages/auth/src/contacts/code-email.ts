import type { MailMessage } from "@ador/mail";

// The colours of the arcade design (`packages/ui/src/tokens.css`), written out because a mail client cannot read the site's stylesheet.
// Every colour is set explicitly on the element that uses it, so a client that darkens or lightens a message has nothing left to guess.
const colour = {
  canvas: "#0b0520",
  card: "#12082b",
  cyan: "#2be7ff",
  muted: "#b9aaec",
  recessed: "#06030f",
  red: "#ff3355",
  text: "#ede7ff",
  yellow: "#ffd23f",
};
// Faces every mail client has: the site's own fonts are not loaded in a message. Impact stands in for the display face and a monospace
// for the pixel one.
const display = "Impact, 'Arial Black', Haettenschweiler, sans-serif";
const mono = "'Courier New', Courier, monospace";
const body = "'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// The one-time sign-in code as a message: a plain-text version for clients that want one, and an HTML version in the platform's look. The HTML
// is a single self-contained table with inline styles: no image to load (so nothing to track and nothing blocked), no link to follow
// (so nothing to imitate), no script. The code is the largest thing in it, and it says what the platform will never ask for.
export function renderCodeEmail(input: {
  readonly appName: string;
  readonly code: string;
  readonly minutes: number;
  readonly to: string;
}): MailMessage {
  const { appName, code, minutes } = input;
  const name = escapeHtml(appName);
  const shown = escapeHtml(code);
  const lifetime = `It works once and expires in ${String(minutes)} minutes.`;
  const never = `${appName} will never ask you for this code, a seed phrase or a private key.`;
  const text = [
    `Your ${appName} sign-in code is ${code}.`,
    "",
    `${lifetime} Enter it on the sign-in page.`,
    "",
    `If you did not ask for it, ignore this message: nobody can sign in without the code. ${never}`,
    "",
    `You are receiving this because someone entered this address on the ${appName} sign-in page.`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${escapeHtml(`${code} is your ${appName} sign-in code`)}</title></head>
<body style="margin:0;padding:0;background:${colour.canvas};" bgcolor="${colour.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${colour.canvas};">Your ${name} sign-in code is ${escapeHtml(code)}. It expires in ${String(minutes)} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colour.canvas}" style="background:${colour.canvas};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 16px;font-family:${mono};font-size:12px;letter-spacing:4px;text-transform:uppercase;color:${colour.cyan};">&#9679;&nbsp;${name}</td></tr>
<tr><td bgcolor="${colour.card}" style="background:${colour.card};border:3px solid ${colour.text};border-right:9px solid ${colour.red};border-bottom:9px solid ${colour.red};padding:32px 28px;font-family:${body};color:${colour.text};">
<div style="font-family:${mono};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${colour.yellow};">&#9654; Player login</div>
<h1 style="margin:12px 0 8px;font-family:${display};font-weight:400;font-size:34px;line-height:1.05;letter-spacing:1px;text-transform:uppercase;color:${colour.text};">Your sign-in code</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:${colour.muted};">Enter this code on the ${name} sign-in page to finish signing in.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${colour.recessed}" style="background:${colour.recessed};border:2px solid ${colour.cyan};padding:22px 8px;font-family:${mono};font-size:38px;font-weight:700;letter-spacing:8px;white-space:nowrap;color:${colour.cyan};">${shown}</td></tr></table>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${colour.text};"><strong style="color:${colour.yellow};">${escapeHtml(lifetime)}</strong> Ask for a new one if it runs out.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;"><tr><td style="border-top:1px dashed #3a2870;padding-top:18px;font-size:13px;line-height:1.6;color:${colour.muted};">Did not ask for this? Ignore it: nobody can sign in without the code.<br><strong style="color:${colour.text};">${escapeHtml(never)}</strong></td></tr></table>
</td></tr>
<tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.6;color:${colour.muted};font-family:${body};">You are receiving this because someone entered this address on the ${name} sign-in page.</td></tr>
</table></td></tr></table></body></html>`;
  return {
    html,
    subject: `${code} is your ${appName} sign-in code`,
    text,
    to: input.to,
  };
}
