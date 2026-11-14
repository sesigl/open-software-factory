import { scenario } from "@opensoftware/testkit";
import { openbaoFactory, readmeWork, serving, withOpenBao } from "./foreman.ts";

scenario("SCN-FORE-165", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof serving>>;
  await given(
    '"foreman serve" runs the README\'s "sandboxed/factory.yaml" whose agent "plan" declares the secrets "ref:env/SLACK_TOKEN" and "ref:openbao/forge-token", with a fake sandbox adapter as "docker", the built secrets adapter "openbao" and an OpenBao that holds "forge-token"',
    async () => {
      const env = await withOpenBao(sut, fakes, true);
      server = await serving(sut, fakes, { factory: openbaoFactory(fakes), sandbox: {}, env });
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then('"/v1/runs/<id>" shows the state "complete"', async () => {
    expect((await server.until(runId, "complete")).state).toBe("complete");
  });

  await then(
    'the spec of the "plan" stage\'s sandbox holds "SLACK_TOKEN" from "ref:env/SLACK_TOKEN" and "FORGE_TOKEN" from "ref:openbao/forge-token"',
    async () => {
      const [plan] = server.sandbox?.created() ?? [];
      expect(plan?.spec.secrets).toEqual({
        ANTHROPIC_API_KEY: "ref:file/anthropic-api-key",
        SLACK_TOKEN: "ref:env/SLACK_TOKEN",
        FORGE_TOKEN: "ref:openbao/forge-token",
      });
    },
  );
});
