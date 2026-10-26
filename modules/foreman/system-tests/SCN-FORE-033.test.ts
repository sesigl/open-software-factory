import { scenario } from "@opensoftware/testkit";
import { readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-033", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" and a scripted harness that ends every turn',
    async () => {
      server = await serving(sut, fakes, { factory: sandboxedFactory(fakes), sandbox: {} });
    },
  );

  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the spec of the "plan" stage\'s sandbox holds the secret "ANTHROPIC_API_KEY" from "ref:file/anthropic-api-key"',
    async () => {
      const [plan] = server.sandbox?.created() ?? [];
      expect(plan?.spec.secrets).toEqual({ ANTHROPIC_API_KEY: "ref:file/anthropic-api-key" });
    },
  );
});
