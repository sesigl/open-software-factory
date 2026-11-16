import { scenario } from "@opensoftware/testkit";
import { PLAN, readmeWork, sandboxedPlan, serving } from "./foreman.ts";

scenario("SCN-FORE-180", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the stage "plan" of the README\'s "sandboxed/factory.yaml" with "FOREMAN_HEARTBEAT_TIMEOUT_MS" set to "500" and a fake sandbox adapter whose copy out of a sandbox takes 800 milliseconds',
    async () => {
      server = await serving(sut, fakes, {
        factory: sandboxedPlan(fakes),
        sandbox: { takesMs: { copyOut: 800 } },
        env: { FOREMAN_HEARTBEAT_TIMEOUT_MS: "500" },
      });
    },
  );

  let runId: string;
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then('the harness received the prompt "Write a plan" only once', async () => {
    expect(server.prompts(PLAN)).toHaveLength(1);
  });
});
