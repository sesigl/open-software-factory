import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { foreman, runOf, serving } from "./console.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-163", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect, an access file with "ada@acme.dev" as "admin" and a foreman with the run "Export reports as CSV"',
    async () => {
      setup = await signInEnv(sut, fakes);
      const api = await foreman(fakes, [runOf("Export reports as CSV")]);
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [api.url], { ...setup.env, CONSOLE_FOREMAN_URL: api.url, CONSOLE_REFRESH: "0" });
    },
  );

  await given('the provider signs in "ada@acme.dev"', async () => {
    setup.oidc.signIn({ email: "ada@acme.dev" });
  });

  let page: BrowserPage;
  await when('the person opens "/" in Chromium and presses "Sign in"', async () => {
    page = await sut.browser.open("/");
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByRole("heading", { level: 1, name: "Runs" }).waitFor();
  });

  await then(
    'the person sees the heading "Runs", the run "Export reports as CSV" and "ada@acme.dev · admin" in the navigation',
    async () => {
      expect(new URL(page.url()).pathname).toBe("/");
      expect(await page.getByRole("link", { name: "Export reports as CSV" }).isVisible()).toBe(true);
      expect(await page.getByRole("banner").getByText("ada@acme.dev · admin").isVisible()).toBe(true);
    },
  );

  await then('the page passes the accessibility checks, and its screenshot is kept as "runs"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "runs");
  });
});
