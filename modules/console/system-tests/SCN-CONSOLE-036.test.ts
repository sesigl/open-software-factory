import { scenario } from "@opensoftware/testkit";
import { factoryEnv, links, open, rows, serving } from "./console.ts";

scenario("SCN-CONSOLE-036", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given(
    '"CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage" on "claude-code" with the model "routes/triage" and the effort "high"',
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
    'the page shows the agent "triage" with the harness "claude-code", the model "routes/triage" and the effort "high"',
    async () => {
      expect(page.status).toBe(200);
      expect(rows(page)).toEqual([["triage", "claude-code", "routes/triage", "high"]]);
      expect(page.getByRole("heading", { level: 1 }).text).toBe("acme");
      expect(page.getByText("harness: claude-code: ^2").text).toBe("harness: claude-code: ^2");
    },
  );

  await then('the page links the agent\'s page "/factory/agents/triage"', async () => {
    expect(links(page)).toContainEqual({ href: "/factory/agents/triage", text: "triage" });
  });
});
