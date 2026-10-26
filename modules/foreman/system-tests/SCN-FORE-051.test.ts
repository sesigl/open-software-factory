import { scenario } from "@opensoftware/testkit";
import { gatewayFactory, readmeWork, type Sessions, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-051", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with the model "routes/strong" for the agent "implement" and a fake inference adapter as "litellm"',
    async () => {
      const factory = gatewayFactory(fakes).replace(
        "    model: routes/default\n    prompt: ./agents/implement.md",
        "    model: routes/strong\n    prompt: ./agents/implement.md",
      );
      server = await servingGateway(sut, fakes, { factory });
    },
  );

  let sessions: Sessions = [];
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    const runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
    sessions = server.harness.sessions();
  });

  await then(
    'the "plan" session\'s agent got "routes/default" as "OPENAI_MODEL" and as "ANTHROPIC_MODEL"',
    async () => {
      expect(sessions[0]?.env).toMatchObject({ OPENAI_MODEL: "routes/default", ANTHROPIC_MODEL: "routes/default" });
    },
  );

  await then(
    'the "implement" session\'s agent got "routes/strong" as "OPENAI_MODEL" and as "ANTHROPIC_MODEL"',
    async () => {
      expect(sessions[1]?.env).toMatchObject({ OPENAI_MODEL: "routes/strong", ANTHROPIC_MODEL: "routes/strong" });
    },
  );
});
