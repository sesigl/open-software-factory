import { scenario } from "@opensoftware/testkit";
import { openbaoFactory, PLAN, readmeWork, serving, withOpenBao } from "./foreman.ts";

scenario("SCN-FORE-164", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" whose agent "plan" declares the secrets "ref:env/SLACK_TOKEN" and "ref:openbao/forge-token", with a fake sandbox adapter as "docker", the built secrets adapter "openbao" and an OpenBao that holds no "forge-token"',
    async () => {
      const env = await withOpenBao(sut, fakes, false);
      server = await serving(sut, fakes, { factory: openbaoFactory(fakes), sandbox: {}, env });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" for the reason \'the secret "ref:openbao/forge-token" has no value; store it and run again\'',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map(({ stage, state, reason }) => ({ stage, state, reason }))).toEqual([
        {
          stage: "plan",
          state: "failed",
          reason: 'the secret "ref:openbao/forge-token" has no value; store it and run again',
        },
        { stage: "implement", state: "pending", reason: undefined },
      ]);
    },
  );

  await then("the sandbox adapter created no sandbox", async () => {
    expect(server.sandbox?.created()).toEqual([]);
  });

  await then('the harness never received the prompt "Write a plan"', async () => {
    expect(server.prompts(PLAN)).toEqual([]);
  });
});
