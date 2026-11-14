import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { serving } from "./console.ts";
import { factoryOf, store, VALUE } from "./secrets.ts";
import { signInEnv } from "./signin.ts";

scenario("SCN-CONSOLE-189", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect, an access file with "ada@acme.dev" as "admin", and a factory whose agent "triage" declares "ref:openbao/linear-token" without a value in the store',
    async () => {
      setup = await signInEnv(sut, fakes);
      const { env } = await store(sut, fakes);
      const factory = await factoryOf(sut, {
        triage: { secrets: ["ref:openbao/linear-token"], egress: ["api.linear.app"] },
      });
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], {
        ...setup.env,
        ...env,
        ...factory,
        CONSOLE_REFRESH: "0",
      });
    },
  );

  await given('the provider signs in "ada@acme.dev"', async () => {
    setup.oidc.signIn({ email: "ada@acme.dev" });
  });

  let page: BrowserPage;
  await when(
    'the person signs in in Chromium, follows "Secrets", types a value for "linear-token" and presses "Store value"',
    async () => {
      page = await sut.browser.open("/");
      await page.getByRole("link", { name: "Sign in" }).click();
      await page.getByRole("link", { name: "Secrets" }).click();
      await page.getByRole("heading", { level: 1, name: "Secrets" }).waitFor();
      await page.getByLabel("Value", { exact: true }).fill(VALUE);
      await page.getByRole("button", { name: "Store value" }).click();
      await page.getByRole("link", { name: "Replace linear-token" }).waitFor();
    },
  );

  await then('the person sees "linear-token" as "Set" by "ada@acme.dev"', async () => {
    const row = page.getByRole("list", { name: "Secrets" }).getByRole("listitem").filter({ hasText: "linear-token" });
    expect(new URL(page.url()).pathname).toBe("/secrets");
    expect(await row.getByText("Set", { exact: true }).isVisible()).toBe(true);
    expect(await row.getByText(/set by ada@acme\.dev on /).isVisible()).toBe(true);
  });

  await then('the page passes the accessibility checks, and its screenshot is kept as "secrets"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "secrets");
  });
});
