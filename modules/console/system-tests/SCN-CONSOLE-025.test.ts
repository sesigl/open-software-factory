import { scenario } from "@opensoftware/testkit";
import { factoryEnv, open, serving, text } from "./console.ts";

scenario("SCN-CONSOLE-025", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('"CONSOLE_FACTORY" names a "factory.yaml" with the agent "triage"', async () => {
    env = await factoryEnv(sut);
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/factory/agents/deploy"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], env);
    page = await open(sut, "/factory/agents/deploy");
  });

  await then('the page answers 404 and says "no agent deploy in factory.yaml"', async () => {
    expect(page.status).toBe(404);
    expect(text(page.html)).toContain("Not found no agent deploy in factory.yaml");
  });
});
