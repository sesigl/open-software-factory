import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, PLAN, readmeFiles, readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-117", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the stage "verify" before "ship" that has "wait: true" and "evidence: required", with the fake GitHub, whose pull request "tester/web#1" has the check "proof" in the state "success"',
    async () => {
      const factory = (readmeFiles(fakes)["checks/factory.yaml"] as string).replace(
        "  - stage: ship\n    checks: [verify]\n",
        "  - stage: verify\n    wait: true\n    evidence: required\n  - stage: ship\n",
      );
      expect(factory).toContain("    wait: true\n");
      server = await servingChecks(sut, fakes, { factory });
      await server.check("success", "proof");
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
    '"/v1/runs/<id>" shows the state "complete" with the stage "verify" "succeeded", its check "proof" "success", marked as a stage that only waits and with no session',
    async () => {
      const view = await server.until(runId, "complete");
      expect(view.stages.map((stage) => [stage.stage, stage.state])).toEqual([
        ["plan", "succeeded"],
        ["implement", "succeeded"],
        ["verify", "succeeded"],
        ["ship", "succeeded"],
      ]);
      const verify = view.stages[2];
      expect(verify?.checks).toEqual([{ name: "proof", state: "success" }]);
      expect(verify?.wait).toBe(true);
      expect(verify?.sessionId).toBeUndefined();
      expect(view.stages[3]?.sessionId).toBeDefined();
    },
  );

  await then('the harness received the prompts of the stages "plan", "implement" and "ship" and no other', async () => {
    const prompts = server.prompts("");
    expect(prompts).toHaveLength(3);
    expect([PLAN, IMPLEMENT, SHIP].map((text) => prompts.filter((prompt) => prompt.includes(text)).length)).toEqual([
      1, 1, 1,
    ]);
  });
});
