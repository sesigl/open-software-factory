import { scenario } from "@opensoftware/testkit";
import { FAILED_CHECKS, IMPLEMENT, PLAN, readmeWork, reworkFactory, servingChecks, WAIT_MS } from "./foreman.ts";

const CI = "https://ci.example/runs/1";

scenario("SCN-FORE-193", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  let events: Awaited<ReturnType<typeof sut.events.watch>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" whose stage "ship" has "rework: implement", with the fake GitHub and NATS, whose pull request "tester/web#1" has the check "verify" in the state "pending"',
    async () => {
      const factory = reworkFactory(fakes);
      expect(factory).toContain("  - stage: ship\n    checks: [verify]\n    rework: implement\n");
      server = await servingChecks(sut, fakes, {
        factory,
        check: "pending",
        nats: true,
        // The turn that gets the failed checks pushes a fix, and CI sets the check to "success".
        first: (checkCommand) => [{ when: FAILED_CHECKS, commands: [checkCommand("success")], reply: "fixed" }],
      });
      events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.run.>");
    },
  );
  await given(
    'the scripted "implement" turn replies with the link of that pull request, and its second turn sets the check "verify" to "success"',
    async () => {
      expect(server.pr.number).toBe(1);
      expect(server.checkCommand("success")).toContain(`/statuses/${server.pr.sha}`);
    },
  );

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token, and the fake GitHub sets the check "verify" to "failure" with the description "2 tests failed" and a link once the stage "ship" waits',
    async () => {
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      // A pending check of a stage that names its rework holds the stage, as without it.
      const waiting = await server.untilStage(runId, 2, "blocked");
      expect(waiting.stages[1]?.rework).toBeUndefined();
      await server.check("failure", "verify", { description: "2 tests failed", target_url: CI });
    },
  );

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stage "ship" "succeeded" and its check "verify" "success"',
    async () => {
      const view = await server.until(runId, "complete");
      expect(view.stages.map((stage) => stage.state)).toEqual(["succeeded", "succeeded", "succeeded"]);
      expect(view.stages[2]?.checks).toEqual([{ name: "verify", state: "success" }]);
    },
  );

  await then(
    'the stage "implement" shows its "rework" for the stage "ship" with the reason "the check verify ended with failure", the check "verify" "failure" with its description and link, and the session of its first turn',
    async () => {
      const [, implement, ship] = (await server.view(runId)).stages;
      expect(implement?.rework).toEqual({
        failedAt: "ship",
        reason: "the check verify ended with failure",
        checks: [{ name: "verify", state: "failure", description: "2 tests failed", url: CI }],
        sessionId: expect.any(String),
        at: expect.any(String),
      });
      // The stage ran once more in a new session; the stage that failed at its checks shows no reason any more.
      expect(implement?.sessionId).toBeDefined();
      expect(implement?.rework?.sessionId).not.toBe(implement?.sessionId);
      expect(ship?.reason).toBeUndefined();
      expect(ship?.rework).toBeUndefined();
    },
  );

  await then(
    'the harness received the prompt of the stage "plan" once and that of "implement" twice, whose second names the stage "ship", the check "verify", its state "failure", its description "2 tests failed" and its link',
    async () => {
      expect(server.prompts(PLAN)).toHaveLength(1);
      const prompts = server.prompts(IMPLEMENT);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).not.toContain(FAILED_CHECKS);
      expect(prompts[1]).toContain(
        `${FAILED_CHECKS} ship\n\nThe checks of the stage ship failed on the pull request, so the run came back to this stage, once. Fix the pull request; when its checks fail again, the run fails.\n\n- verify: failure: 2 tests failed (${CI})\n`,
      );
    },
  );

  await then(
    'the "run.completed@v1" names the outcome "succeeded" and the rework of the stage "implement" for the stage "ship" with the reason "the check verify ended with failure"',
    async () => {
      const [completed] = await events.received("run.completed@v1", { timeoutMs: WAIT_MS });
      expect(completed?.data).toMatchObject({
        outcome: "succeeded",
        reworks: [{ stage: "implement", failedAt: "ship", reason: "the check verify ended with failure" }],
      });
      expect(completed?.data).not.toHaveProperty("reason");
    },
  );
});
