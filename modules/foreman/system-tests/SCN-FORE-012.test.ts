import { scenario } from "@opensoftware/testkit";
import { GATE, gatedFactory, IMPLEMENT, readmeWork, serving } from "./foreman.ts";

scenario("SCN-FORE-012", async ({ sut, fakes, given, when, then }) => {
  let factory = "";
  await given('the README\'s factory with a gate before the stage "implement"', async () => {
    factory = gatedFactory(fakes);
  });

  let server: Awaited<ReturnType<typeof serving>>;
  await given('gatekeeper answers a request with the gate "g0a1b2c3d4e5f6a7b"', async () => {
    server = await serving(sut, fakes, { factory, gatekeeper: true });
  });

  let runId = "";
  await when('a program posts the README\'s "work.json" to "/v1/runs" with the API token', async () => {
    runId = (await server.start(readmeWork(fakes))).data?.runId as string;
  });

  await then(
    'gatekeeper received a request for the stage "implement" of the work item with the summary "Export reports as CSV: start the stage implement"',
    async () => {
      await server.until(runId, "blocked");
      const [request] = server.gatekeeper?.received() ?? [];
      expect(request).toMatchObject({
        method: "POST",
        path: "/v1/gates",
        body: {
          workItem: readmeWork(fakes).id,
          stage: "implement",
          summary: "Export reports as CSV: start the stage implement",
          change: { factory: "hello", policy: "./policies/implement.rego", approvers: ["maintainers"] },
        },
      });
      expect(server.gatekeeper?.headers()[0]?.headers.authorization).toBe("Bearer gatekeeper-token");
    },
  );

  await then(
    '"/v1/runs/<id>" shows the state "blocked" with the stage "plan" "succeeded" and the stage "implement" "blocked"',
    async () => {
      const view = await server.view(runId);
      expect(view.stages.map(({ stage, state }) => ({ stage, state }))).toEqual([
        { stage: "plan", state: "succeeded" },
        { stage: "implement", state: "blocked" },
      ]);
      expect(view.stages[1]?.gateId).toBe(GATE);
    },
  );

  await then('the harness never received the prompt "Implement plan.md"', async () => {
    expect(server.prompts(IMPLEMENT)).toEqual([]);
  });
});
