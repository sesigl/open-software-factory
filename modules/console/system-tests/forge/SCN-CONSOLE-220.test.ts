import { type BrowserPage, scenario } from "@opensoftware/testkit";
import { changesEnv, editProgram, factoryRepository, PEOPLE } from "../changes.ts";
import { serving } from "../console.ts";
import { signInEnv } from "../signin.ts";

scenario("SCN-CONSOLE-220", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  await given(
    'a console that signs in with OpenID Connect, an access file with "grace@acme.dev" as "factory-engineer", and a factory repository "tester/factory" whose main branch requires the check "factory"',
    async () => {
      setup = await signInEnv(sut, fakes, PEOPLE);
      const forge = await factoryRepository(fakes);
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], {
        ...setup.env,
        ...changesEnv(sut, forge),
        CONSOLE_FACTORY_COMMAND: await editProgram(sut),
        CONSOLE_REFRESH: "0",
      });
    },
  );

  await given('the provider signs in "grace@acme.dev"', async () => {
    setup.oidc.signIn({ email: "grace@acme.dev" });
  });

  let page: BrowserPage;
  await when(
    'the person signs in in Chromium, follows "Changes", chooses "Add an egress host", the agent "triage", types "api.linear.app" and presses "Propose change"',
    async () => {
      page = await sut.browser.open("/");
      await page.getByRole("link", { name: "Sign in" }).click();
      await page.getByRole("link", { name: "Changes" }).click();
      await page.getByRole("heading", { level: 1, name: "Changes" }).waitFor();
      await page.getByLabel("Change", { exact: true }).selectOption({ label: "Add an egress host" });
      await page.getByLabel("Agent", { exact: true }).selectOption({ label: "triage" });
      await page.getByLabel("Value", { exact: true }).fill("api.linear.app");
      await page.getByRole("button", { name: "Propose change" }).click();
      await page.getByRole("list", { name: "Changes" }).waitFor();
    },
  );

  await then(
    'the person sees "The agent triage may reach the host api.linear.app." as "Checking" on "/changes"',
    async () => {
      const row = page.getByRole("list", { name: "Changes" }).getByRole("listitem");
      expect(new URL(page.url()).pathname).toBe("/changes");
      expect(await row.getByText("The agent triage may reach the host api.linear.app.").isVisible()).toBe(true);
      expect(await row.getByText("Checking", { exact: true }).isVisible()).toBe(true);
    },
  );

  await then('the page passes the accessibility checks, and its screenshot is kept as "changes"', async () => {
    await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
    await sut.browser.screenshot(page, "changes");
  });
});
