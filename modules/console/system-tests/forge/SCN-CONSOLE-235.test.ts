import { type BrowserPage, type Forge, scenario } from "@opensoftware/testkit";
import { changesEnv, factoryRepository, headOf, PEOPLE, postCheck } from "../changes.ts";
import { serving } from "../console.ts";
import { factoryYaml } from "../secrets.ts";
import { signInEnv } from "../signin.ts";
import { AGENTS, RELEASE_NOTES, switchProgram } from "../switches.ts";

scenario("SCN-CONSOLE-235", async ({ sut, fakes, given, when, then }) => {
  let setup: Awaited<ReturnType<typeof signInEnv>>;
  let forge: Forge;
  await given(
    'a console that signs in with OpenID Connect, an access file with "grace@acme.dev" as "factory-engineer", a factory repository "tester/factory" whose main branch requires the check "factory", and a factory whose agent "triage" uses the skill "release-notes" and whose agent "review" lacks what it needs',
    async () => {
      setup = await signInEnv(sut, fakes, PEOPLE);
      forge = await factoryRepository(fakes);
      await sut.files.put("$INPUT/factory.yaml", factoryYaml(AGENTS, "env"));
      // Without the reload: axe's rule meta-refresh flags it until live updates replace it (TODO.md, T-60).
      await serving(sut, [setup.env.CONSOLE_FOREMAN_URL as string], {
        ...setup.env,
        ...changesEnv(sut, forge),
        CONSOLE_FACTORY: sut.files.path("$INPUT/factory.yaml"),
        CONSOLE_FACTORY_COMMAND: await switchProgram(sut, [RELEASE_NOTES]),
        CONSOLE_REFRESH: "0",
      });
    },
  );

  await given('the provider signs in "grace@acme.dev"', async () => {
    setup.oidc.signIn({ email: "grace@acme.dev" });
  });

  let page: BrowserPage;
  await when(
    'the person signs in in Chromium, follows "Skills" and "release-notes", presses "Switch on for review" and "Propose change"',
    async () => {
      page = await sut.browser.open("/");
      await page.getByRole("link", { name: "Sign in" }).click();
      await page.getByRole("link", { name: "Skills" }).click();
      await page.getByRole("link", { name: "release-notes" }).click();
      await page.getByRole("button", { name: "Switch on for review" }).click();
      await page.getByRole("button", { name: "Propose change" }).click();
      await page.getByRole("list", { name: "Changes" }).waitFor();
    },
  );

  await then(
    'the person sees the change as "Checking" on "/changes", and "Switching on" and "Checking" beside "review" on "/skills/release-notes"',
    async () => {
      const change = page.getByRole("list", { name: "Changes" }).getByRole("listitem");
      expect(new URL(page.url()).pathname).toBe("/changes");
      expect(await change.getByText("Checking", { exact: true }).isVisible()).toBe(true);
      await page.goto(new URL("/skills/release-notes", page.url()).href);
      const review = page.getByRole("list", { name: "Agents" }).getByRole("listitem").filter({ hasText: "review" });
      expect(await review.getByText("Switching on", { exact: true }).isVisible()).toBe(true);
      expect(await review.getByText("Checking", { exact: true }).isVisible()).toBe(true);
    },
  );

  await then(
    'the skill\'s page passes the accessibility checks, and its screenshot is kept as "skill-switch"',
    async () => {
      await expect(sut.browser.expectAccessible(page)).resolves.toBeUndefined();
      await sut.browser.screenshot(page, "skill-switch");
    },
  );

  await when(
    'the check "factory" of the pull request passes, the forge merges it, and the person opens "/changes"',
    async () => {
      const [pull] = await forge.pullRequests("factory");
      const sha = (await headOf(forge, pull?.head ?? "")) as string;
      const pr = { repository: "factory", number: pull?.number ?? 0, url: pull?.url ?? "", sha };
      await postCheck({ forge, pr, head: pull?.head ?? "" }, "success");
      // Forgejo merges a pull request that waits for its checks in the background, once the status arrived.
      const state = async () => (await forge.pullRequests("factory"))[0]?.state;
      await expect.poll(state, { timeout: 30_000, interval: 200 }).toBe("closed");
      await page.goto(new URL("/changes", page.url()).href);
    },
  );

  await then('the person sees the change as "Live"', async () => {
    const change = page.getByRole("list", { name: "Changes" }).getByRole("listitem");
    expect(await change.getByText("Live", { exact: true }).isVisible()).toBe(true);
  });
});
