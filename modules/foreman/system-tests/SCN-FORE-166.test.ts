import { scenario } from "@opensoftware/testkit";
import { openbaoFactory, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-166", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" whose agent "plan" declares the secrets "ref:env/SLACK_TOKEN" and "ref:openbao/forge-token", with a fake sandbox adapter as "docker", the built secrets adapter "openbao" and OpenBao at "http://127.0.0.1:9", where nothing answers',
    async () => {
      const env = {
        FOREMAN_SECRETS: JSON.stringify({ openbao: sut.adapter("secrets/openbao") }),
        OSF_OPENBAO_ADDR: "http://127.0.0.1:9",
        OSF_OPENBAO_TOKEN: "osf-test-bao-token",
      };
      server = await serving(sut, fakes, { factory: openbaoFactory(fakes), sandbox: {}, env });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "plan" "failed" for the reason "the secrets adapter\'s exists failed: secrets-openbao: the store at http://127.0.0.1:9 does not answer"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages[0]).toMatchObject({
        stage: "plan",
        state: "failed",
        reason: "the secrets adapter's exists failed: secrets-openbao: the store at http://127.0.0.1:9 does not answer",
      });
    },
  );

  await then("the sandbox adapter created no sandbox", async () => {
    expect(server.sandbox?.created()).toEqual([]);
  });
});
