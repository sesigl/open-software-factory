import { scenario } from "@opensoftware/testkit";
import { factoryEnv, links, open, serving } from "./console.ts";

scenario("SCN-CONSOLE-027", async ({ sut, given, when, then }) => {
  let env: Record<string, string> = {};
  await given('"CONSOLE_LINKS" is "Grafana=https://grafana.acme.dev,Langfuse=https://langfuse.acme.dev"', async () => {
    env = {
      ...(await factoryEnv(sut)),
      CONSOLE_LINKS: "Grafana=https://grafana.acme.dev,Langfuse=https://langfuse.acme.dev",
    };
  });

  let page: Awaited<ReturnType<typeof open>>;
  await when('a person opens "/factory"', async () => {
    await serving(sut, ["http://127.0.0.1:1"], env);
    page = await open(sut, "/factory");
  });

  await then(
    'the page links "Grafana" to "https://grafana.acme.dev" and "Langfuse" to "https://langfuse.acme.dev"',
    async () => {
      expect(page.html).toContain(
        '<ul><li><a href="https://grafana.acme.dev">Grafana</a></li><li><a href="https://langfuse.acme.dev">Langfuse</a></li></ul>',
      );
    },
  );
});
