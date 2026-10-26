import { scenario } from "@opensoftware/testkit";
import { gatedFactory, waitingAtGate } from "./foreman.ts";

scenario("SCN-FORE-009", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof waitingAtGate>>;
  await given('a run of the README\'s factory waits at a gate before the stage "implement"', async () => {
    run = await waitingAtGate(sut, fakes);
  });

  await given('a new commit adds the stage "review" to "factory.yaml"', async () => {
    const reviewed = gatedFactory(fakes)
      .replace(
        "workflow:\n",
        "  review:\n    harness: acp\n    model: routes/default\n    prompt: ./agents/implement.md\nworkflow:\n",
      )
      .concat("  - stage: review\n");
    await sut.files.put("$INPUT/factory.yaml", reviewed);
    await sut.git.commit("a review stage");
  });

  await when('gatekeeper publishes "gate.decided@v1" with the decision "approved" for the gate', async () => {
    await run.decide("approved");
  });

  await then(
    'the run completes with the stages "plan" and "implement" and the first commit as its factory version',
    async () => {
      const view = await run.until(run.runId, "complete");
      expect(view.stages.map(({ stage }) => stage)).toEqual(["plan", "implement"]);
      expect(view.factoryVersion).toBe(run.commit);
    },
  );
});
