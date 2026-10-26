import { scenario } from "@opensoftware/testkit";
import { factoryEnv, links, open, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-024", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    '"CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage", "CONSOLE_REPOSITORY_URL" is "https://github.com/acme/factory" and "CONSOLE_BRANCH" is "main"',
    async () => {
      env = {
        ...(await factoryEnv(sut)),
        CONSOLE_REPOSITORY_URL: "https://github.com/acme/factory/",
        CONSOLE_BRANCH: "main",
      };
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/factory/agents/triage"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], env);
    page = await open(sut, "/factory/agents/triage");
  });

  await then('the page shows the agent\'s prompt "./prompts/triage.md"', async () => {
    expect(page.status).toBe(200);
    expect(text(page.html)).toContain("harness claude-code model routes/triage prompt ./prompts/triage.md");
  });

  await then(
    'the page links "https://github.com/acme/factory/blob/main/factory.yaml" and says "Change it in Git, on the branch main"',
    async () => {
      expect(links(page.html)).toContainEqual({
        href: "https://github.com/acme/factory/blob/main/factory.yaml",
        text: "factory.yaml",
      });
      expect(text(page.html)).toContain("Read-only. Change it in Git, on the branch main: factory.yaml");
    },
  );

  await then("the page has no form and no input", async () => {
    expect(page.html).not.toMatch(/<(form|input|textarea|select|button)\b/);
  });
});
