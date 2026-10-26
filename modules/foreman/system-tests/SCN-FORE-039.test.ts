import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-039", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given(
    'the README\'s "sandboxed/factory.yaml" with "kubernetes" in place of "docker" under "providers.sandbox"',
    async () => {
      factory = sandboxedFactory(fakes).replace('    docker: "^0"', '    kubernetes: "^0"');
      expect(factory).toContain('kubernetes: "^0"');
    },
  );

  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs it with "FOREMAN_SANDBOXES" naming a fake sandbox adapter as "kubernetes" only',
    async () => {
      server = await serving(sut, fakes, { factory, sandbox: {}, sandboxAs: "kubernetes" });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then("the fake sandbox adapter created 2 sandboxes", async () => {
    expect(server.sandbox?.created()).toHaveLength(2);
  });
});
