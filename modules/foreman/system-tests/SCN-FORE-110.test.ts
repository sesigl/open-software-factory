import { scenario } from "@opensoftware/testkit";
import { ADA, failed, reviewAdded } from "./foreman.ts";

scenario("SCN-FORE-110", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof failed>>;
  await given('the server ran the README\'s "work.json" and the "implement" turn ended with "refusal"', async () => {
    run = await failed(sut, fakes);
  });

  await given(
    'a new commit adds the stage "review" to "factory.yaml", so the stage names in order are no longer those of the run',
    async () => {
      await reviewAdded(sut, fakes);
    },
  );

  let answer: Awaited<ReturnType<typeof run.retry>>;
  await when('"github:ada" posts a retry of the run from the stage "implement"', async () => {
    answer = await run.retry(run.runId, { by: ADA, from: "implement" });
  });

  await then(
    'the answer has the status 409 and a problem that says the factory\'s stages changed and the new run starts at the stage "plan"',
    async () => {
      expect(answer.response.status).toBe(409);
      expect(answer.error).toEqual({
        title: "The run does not run again",
        status: 409,
        detail: `from: the factory's stages changed since ${run.runId}, so the new run starts at the stage plan`,
      });
    },
  );

  await then('"/v1/runs" lists one run', async () => {
    expect((await run.list()).data?.runs.map(({ runId }) => runId)).toEqual([run.runId]);
  });
});
