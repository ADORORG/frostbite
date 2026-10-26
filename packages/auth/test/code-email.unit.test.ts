import { describe, expect, it } from "vitest";

import { renderCodeEmail } from "../src/contacts/code-email.ts";

const input = {
  appName: "Adorbitals",
  code: "493762",
  minutes: 10,
  to: "ada@example.com",
};

describe("the sign-in code email", () => {
  it("has a plain-text version that says the code, the lifetime, what to do if unasked, and what is never asked for", () => {
    const { text, subject, to } = renderCodeEmail(input);
    expect(subject).toBe("493762 is your Adorbitals sign-in code");
    expect(to).toBe("ada@example.com");
    // The phrase the browser tests and people read the code from.
    expect(text).toContain("Your Adorbitals sign-in code is 493762.");
    expect(text).toContain("works once and expires in 10 minutes");
    expect(text).toContain("nobody can sign in without the code");
    expect(text).toContain(
      "Adorbitals will never ask you for this code, a seed phrase or a private key.",
    );
    expect(text).toContain("someone entered this address");
  });

  it("has a styled version with the code in large type, spread by letter-spacing so it reads digit by digit but still copies as one number", () => {
    const { html } = renderCodeEmail(input);
    expect(html).toContain(">493762</td>");
    expect(html).not.toContain("4 9 3 7 6 2");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("font-size:38px");
    expect(html).toContain("Your sign-in code");
    expect(html).toContain("expires in 10 minutes");
    expect(html).toContain("&#9654; Player login");
    // The pre-header a mail list shows beside the subject.
    expect(html).toMatch(
      /display:none[^>]*>Your Adorbitals sign-in code is 493762/u,
    );
  });

  it("carries nothing a message should not: no script, no remote image, no link, no stylesheet to load", () => {
    const { html } = renderCodeEmail(input);
    expect(html).not.toMatch(/<script|<img|<a |<link|<iframe|@import|url\(/iu);
    expect(html).not.toMatch(/https?:\/\//u);
  });

  it("writes the app name and the code into the page as text, never as markup", () => {
    const { html, text } = renderCodeEmail({
      ...input,
      appName: '<b onclick="x()">A&B</b>',
      code: "1<2>3",
    });
    expect(html).not.toContain("<b onclick");
    expect(html).toContain(
      "&lt;b onclick=&quot;x()&quot;&gt;A&amp;B&lt;/b&gt;",
    );
    // In the large cell itself, not only in the pre-header and title that also repeat it.
    expect(html).toContain(">1&lt;2&gt;3</td>");
    // Plain text is not markup, so it is not escaped.
    expect(text).toContain('<b onclick="x()">A&B</b>');
  });

  it("gives the lifetime in the minutes it was given", () => {
    const { html, text } = renderCodeEmail({ ...input, minutes: 3 });
    expect(text).toContain("expires in 3 minutes");
    expect(html).toContain("expires in 3 minutes");
  });
});
