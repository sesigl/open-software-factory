import { scenario } from "@opensoftware/testkit";
import { readmeWork, type Sessions, servingGateway } from "./foreman.ts";

scenario("SCN-FORE-050", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingGateway>>;
  await given(
    '"foreman serve" runs the README\'s "gateway/factory.yaml" with a fake inference adapter as "litellm" whose gateway has the URL "http://127.0.0.1:4000/v1"',
    async () => {
      server = await servingGateway(sut, fakes, { inference: { url: "http://127.0.0.1:4000/v1" } });
    },
  );

  let runId = "";
  let sessions: Sessions = [];
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
    await server.until(runId, "complete");
    sessions = server.harness.sessions();
  });

  await then(
    'the "plan" session\'s agent got "OPENAI_BASE_URL" "http://127.0.0.1:4000/v1" and "ANTHROPIC_BASE_URL" "http://127.0.0.1:4000"',
    async () => {
      expect(sessions[0]?.env).toMatchObject({
        OPENAI_BASE_URL: "http://127.0.0.1:4000/v1",
        ANTHROPIC_BASE_URL: "http://127.0.0.1:4000",
      });
    },
  );

  await then('it got the run\'s key as "OPENAI_API_KEY" and as "ANTHROPIC_API_KEY"', async () => {
    const [key] = server.inference?.keys() ?? [];
    expect(key?.run).toBe(runId);
    expect(sessions[0]?.env).toMatchObject({ OPENAI_API_KEY: key?.key, ANTHROPIC_API_KEY: key?.key });
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.view(runId)).state).toBe("complete");
  });
});
