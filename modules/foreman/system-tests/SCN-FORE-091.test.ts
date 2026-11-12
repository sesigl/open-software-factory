import { scenario } from "@opensoftware/testkit";
import { newRunOf, readmeWork, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-091", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given('a run of the README\'s factory whose gate before the stage "implement" was rejected', async () => {
    run = await waitingAtGate(sut, fakes);
    await run.decide("rejected");
    await run.until(run.runId, "failed");
  });

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
  });

  await then(
    'gatekeeper received a second request for the stage "implement" of the work item, whose change names the run "<new id>"',
    async () => {
      await run.until(newId, "blocked");
      const requests = run.gatekeeper?.received() ?? [];
      expect(requests).toHaveLength(2);
      expect(requests.map(({ body }) => (body as { change: { run: string } }).change.run)).toEqual([run.runId, newId]);
      expect(requests[1]?.body).toMatchObject({ workItem: readmeWork(fakes).id, stage: "implement" });
    },
  );

  await then('"/v1/runs/<new id>" shows the state "blocked" with the stage "implement" "blocked"', async () => {
    const view = await run.view(newId);
    expect(view.state).toBe("blocked");
    expect(view.stages.map(({ state }) => state)).toEqual(["succeeded", "blocked"]);
  });
});
