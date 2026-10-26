import { scenario } from "@opensoftware/testkit";
import { PLAN, readmeWork, sandboxedFactory, serving } from "./foreman.ts";

scenario("SCN-FORE-038", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" with a fake sandbox adapter as "docker" that knows only the template "alpine:3"',
    async () => {
      server = await serving(sut, fakes, { factory: sandboxedFactory(fakes), sandbox: { templates: ["alpine:3"] } });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" and the stage "implement" "pending"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "failed" },
        { stage: "implement", state: "pending" },
      ]);
    },
  );

  await then('the harness never received the prompt "Write a plan"', async () => {
    expect(server.prompts(PLAN)).toEqual([]);
  });
});
