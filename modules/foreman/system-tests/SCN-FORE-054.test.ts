import { scenario } from "@opensoftware/testkit";
import { gatewayFactory, readmeWork, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-054", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a sandbox "node:24" for the agent "plan", a fake sandbox adapter as "docker" and a fake inference adapter as "litellm"',
    async () => {
      const factory = gatewayFactory(fakes).replace(
        "    prompt: ./agents/plan.md\n",
        "    prompt: ./agents/plan.md\n    sandbox:\n      template: node:24\n",
      );
      server = await servingGateway(sut, fakes, { factory, sandbox: {} });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
  });

  await then(
    'the spec of the "plan" stage\'s sandbox sets "OPENAI_BASE_URL", "OPENAI_API_KEY" and "OPENAI_MODEL" to the gateway\'s URL, the run\'s key and "routes/default"',
    async () => {
      const [plan] = server.sandbox?.created() ?? [];
      expect(server.inference?.keys()).toMatchObject([{ key: "sk-fake-1", run: runId }]);
      expect(plan?.spec.env).toMatchObject({
        OPENAI_BASE_URL: "http://127.0.0.1:4000/v1",
        OPENAI_API_KEY: "sk-fake-1",
        OPENAI_MODEL: "routes/default",
      });
    },
  );
});
