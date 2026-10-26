import { expect, test, type Page } from "@playwright/test";
import { readCapturedMail } from "@ador/mail";
import { platformSessionCookieName } from "@ador/shared/auth";

// Signing in with an emailed code against a real server and database. The server's mail is captured into a directory
// (`scripts/run-with-postgres.ts`), so the test reads the code from the file the app "sent", as a person would from an inbox. Each test
// has an address of its own, because accounts persist for the whole run.
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop only.");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const mailbox = () => {
  const directory = process.env.MAIL_CAPTURE_DIRECTORY;
  if (directory === undefined) throw new Error("The run has no mailbox.");
  return directory;
};
const addressFor = (name: string) =>
  `${name}-${Date.now().toString(36)}@example.test`;

// The newest code sent to the address, waiting for the file to appear.
async function codeSentTo(address: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(async () => {
      const mail = (await readCapturedMail(mailbox())).find(
        ({ to }) => to === address,
      );
      code = /sign-in code is (\d{6})/u.exec(mail?.text ?? "")?.[1];
      return code;
    })
    .toBeDefined();
  if (code === undefined) throw new Error("No code arrived.");
  return code;
}

// The page's own message; the framework has a live region with the same role.
const alertOf = (page: Page) => page.locator("p[role=alert]");

// The sign-in page opens on its first key (the wallet), so the email form is shown by choosing the Email key.
const chooseEmail = (page: Page) =>
  page.getByRole("tab", { name: /Email/u }).click();

async function askForCode(page: Page, address: string) {
  await chooseEmail(page);
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(
    page.getByText("If that address can receive mail"),
  ).toBeVisible();
}

test("a signed-out visitor to a protected page signs in with an emailed code and is brought back", async ({
  page,
}) => {
  const address = addressFor("return");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Faccount/u);
  await chooseEmail(page);
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible();

  await askForCode(page, address);
  const code = await codeSentTo(address);
  // A wrong code is refused with the same words whoever's it is, and the right one still works afterwards (five tries).
  await page.getByLabel("Code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(alertOf(page)).toContainText("not right, or it has expired");

  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/u);
  const cookies = await page.context().cookies();
  expect(cookies.some(({ name }) => name === platformSessionCookieName)).toBe(
    true,
  );
  await expect(page.getByText("Authenticated session")).toBeVisible();
});

test("asking again at once is refused and says when to try again; a code that signed someone in cannot be used again", async ({
  page,
}) => {
  const address = addressFor("again");
  await page.goto("/sign-in");
  await askForCode(page, address);
  await page.getByRole("button", { name: "Send a new code" }).click();
  await expect(alertOf(page)).toContainText("A code was sent recently");

  const code = await codeSentTo(address);
  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/u);

  // The same code, offered again by someone with no session, is spent: refused, and no session starts.
  const origin = new URL(page.url()).origin;
  const replay = await page.context().browser()?.newContext();
  if (replay === undefined) throw new Error("No second browser context.");
  const response = await replay.request.post(
    `${origin}/api/v1/email/sign-in/verify`,
    {
      data: { code, email: address },
      headers: { origin },
    },
  );
  expect(response.status()).toBe(401);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  await replay.close();
});
