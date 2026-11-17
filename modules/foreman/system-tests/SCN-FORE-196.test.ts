import { scenario } from "@opensoftware/testkit";
import { FAILED_CHECKS, GATE, IMPLEMENT, readmeWork, reworkFactory, servingChecks } from "./foreman.ts";

scenario("SCN-FORE-196", async ({ sut, fakes, given, when, then }) => {
  let server: Awaited<ReturnType<typeof servingChecks>>;
  await given(
    '"foreman serve" runs the README\'s "checks/factory.yaml" with a gate before the stage "implement" and "rework: implement" on the stage "ship", with the fake GitHub and NATS, whose pull request "tester/web#1" has the check "verify" in the state "failure"',
    async () => {
      const factory = reworkFactory(fakes).replace(
        "  - stage: implement\n",
        "  - stage: implement\n    gate:\n      policy: ./policies/implement.rego\n      approvers: [maintainers]\n",
      );
      expect(factory).toContain("    gate:\n");
      server = await servingChecks(sut, fakes, {
        factory,
        check: "failure",
        nats: true,
        gatekeeper: true,
        first: (checkCommand) => [{ when: FAILED_CHECKS, commands: [checkCommand("success")], reply: "fixed" }],
      });
    },
  );
  await given(
    'the scripted "implement" turn replies with the link of that pull request, and its second turn sets the check "verify" to "success"',
    async () => {
      expect(server.pr.number).toBe(1);
    },
  );

  let runId = "";
  await when(
    'a program posts the README\'s "work.json" to "/v1/runs" with the API token and gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate "g0a1b2c3d4e5f6a7b"',
    async () => {
      runId = (await server.start(readmeWork(fakes))).data?.runId as string;
      await server.untilStage(runId, 1, "blocked");
      const events = await sut.events.watch(server.nats as NonNullable<typeof server.nats>, "osf.>");
      await events.publish("osf.gate.decided.v1", {
        specversion: "1.0",
        id: `${GATE}.decided`,
        source: "/osf/gatekeeper",
        type: "gate.decided@v1",
        time: "2026-01-01T00:00:00Z",
        subject: GATE,
        data: {
          gateId: GATE,
          workItemId: readmeWork(fakes).id,
          decision: "approved",
          decidedBy: { kind: "person", id: "slack:U0ADA" },
          decidedAt: "2026-01-01T00:00:00Z",
        },
      });
    },
  );

  await then(
    '"/v1/runs/<id>" shows the state "complete" with the stage "implement" "succeeded", its gate "g0a1b2c3d4e5f6a7b" and its "rework" for the stage "ship"',
    async () => {
      const view = await server.until(runId, "complete");
      expect(view.stages[1]).toMatchObject({ stage: "implement", state: "succeeded", gateId: GATE });
      expect(view.stages[1]?.rework?.failedAt).toBe("ship");
      expect(server.prompts(IMPLEMENT)).toHaveLength(2);
    },
  );

  await then('gatekeeper received one request, for the stage "implement"', async () => {
    // A second request would have been answered "pending" and held the stage that runs once more.
    const requests = server.gatekeeper?.received() ?? [];
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ path: "/v1/gates", body: { stage: "implement" } });
  });
});
