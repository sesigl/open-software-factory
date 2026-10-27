import { scenario } from "@opensoftware/testkit";
import { factoryEnv, links, open, rows, serving } from "./console.ts";

scenario("SCN-CONSOLE-023", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    '"CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage" on "claude-code" with the model "routes/triage"',
    async () => {
      env = await factoryEnv(sut);
    },
  );

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/factory"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], env);
    page = await open(sut, "/factory");
  });

  await then(
    'the page shows the agent "triage" with the harness "claude-code" and the model "routes/triage"',
    async () => {
      expect(page.status).toBe(200);
      expect(rows(page.html)).toEqual([["triage", "claude-code", "routes/triage"]]);
      expect(page.html).toContain("<h1>acme</h1>");
      expect(page.html).toContain("<pre>harness:\n  claude-code: ^2\n</pre>");
    },
  );

  await then('the page links the agent\'s page "/factory/agents/triage"', async () => {
    expect(links(page.html)).toContainEqual({ href: "/factory/agents/triage", text: "triage" });
  });
});
