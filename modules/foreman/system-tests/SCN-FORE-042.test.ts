import { scenario } from "@opensoftware/testkit";
import { readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-042", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the fake GitHub, whose pull request "tester/web#1" has the check "verify" in the state "failure"',
    async () => {
      server = await servingChecks(sut, fakes, { check: "failure" });
    },
  );
  await given('the scripted "implement" turn replies with the link of that pull request', async () => {
    expect(server.pr.number).toBe(1);
  });

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "ship" "failed" and its check "verify" "failure"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map((stage) => stage.state)).toEqual(["succeeded", "succeeded", "failed"]);
      expect(view.stages[2]).toMatchObject({
        stage: "ship",
        checks: [{ name: "verify", state: "failure" }],
        reason: "the check verify ended with failure",
      });
    },
  );

  await then('the harness never received the prompt "Merge the pull request"', async () => {
    expect(server.prompts(SHIP)).toEqual([]);
  });
});
