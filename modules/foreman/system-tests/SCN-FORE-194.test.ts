import { scenario } from "@opensoftware/testkit";
import { FAILED_CHECKS, IMPLEMENT, readmeFiles, readmeWork, SHIP, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-194", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with the stage "verify" before "ship" that has "wait: true", the checks ["verify"] and "rework: implement", with the fake GitHub, whose pull request "tester/web#1" has the check "verify" in the state "failure"',
    async () => {
      const factory = (readmeFiles(fakes)["checks/factory.yaml"] as string).replace(
        "  - stage: ship\n    checks: [verify]\n",
        "  - stage: verify\n    wait: true\n    checks: [verify]\n    rework: implement\n  - stage: ship\n",
      );
      expect(factory).toContain("    rework: implement\n  - stage: ship\n");
      server = await servingChecks(sut, fakes, {
        factory,
        check: "failure",
        first: () => [{ when: FAILED_CHECKS, reply: "fixed" }],
      });
    },
  );
  await given(
    'the scripted "implement" turn replies with the link of that pull request, and its second turn leaves the check as it is',
    async () => {
      expect(server.pr.number).toBe(1);
    },
  );

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    '"/v1/runs/<id>" shows the state "failed" with the stage "verify" "failed", its check "verify" "failure" and the reason "the check verify ended with failure"',
    async () => {
      const view = await server.until(runId, "failed");
      expect(view.stages.map((stage) => stage.state)).toEqual(["succeeded", "succeeded", "failed", "pending"]);
      expect(view.stages[2]).toMatchObject({
        stage: "verify",
        wait: true,
        checks: [{ name: "verify", state: "failure" }],
        reason: "the check verify ended with failure",
      });
      // A check the forge tells nothing more about is named with its state only.
      expect(view.stages[1]?.rework?.failedAt).toBe("verify");
      expect(view.stages[1]?.rework?.checks).toEqual([{ name: "verify", state: "failure" }]);
    },
  );

  await then(
    'the harness received the prompt of the stage "implement" twice, the second with the line "- verify: failure", and never the prompt "Merge the pull request"',
    async () => {
      // The run went back once: the second failure ended it, and no third "implement" turn came.
      const prompts = server.prompts(IMPLEMENT);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain(FAILED_CHECKS);
      expect(prompts[1]).toContain(`${FAILED_CHECKS} verify\n`);
      expect(prompts[1]?.endsWith("\n\n- verify: failure\n")).toBe(true);
      expect(server.prompts(SHIP)).toEqual([]);
    },
  );
});
