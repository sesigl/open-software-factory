import { scenario } from "@opensoftware/testkit";
import { IMPLEMENT, newRunOf, PLAN, RUN_BEFORE, started } from "./foreman.ts";

const LINK = "https://github.com/tester/web/pull/7";

scenario("SCN-FORE-089", async ({ sut, fakes, given, when, then }) => {
  let run: Awaited<ReturnType<typeof started>>;
  await given(
    'the server ran the README\'s "work.json" with "OSF_DATA" set to "$OUTPUT/foreman", the "plan" turn wrote "plan.md" and replied with the link "https://github.com/tester/web/pull/7", and the "implement" turn ended with "refusal"',
    async () => {
      run = await started(sut, fakes, {
        turns: [
          { when: PLAN, edits: { "plan.md": "the plan\n" }, reply: `Opened ${LINK}` },
          { when: RUN_BEFORE, reply: "done" },
          { when: IMPLEMENT, stopReason: "refusal" },
        ],
        env: { OSF_DATA: sut.files.path("$OUTPUT/foreman") },
      });
      await run.until(run.runId, "failed");
    },
  );

  let newId = "";
  await when('"github:ada" posts a retry of the run to "/v1/runs/<id>/retry"', async () => {
    newId = newRunOf(await run.retry(run.runId));
    await run.until(newId, "complete");
  });

  await then(
    'the "implement" turn of the new run ran in "$OUTPUT/foreman/runs/<new id>", which holds the "plan.md" of the run before',
    async () => {
      const folder = sut.files.path(`$OUTPUT/foreman/runs/${newId}`);
      expect(run.harness.sessions().map(({ cwd }) => cwd)[2]).toBe(folder);
      expect(await sut.files.read(`$OUTPUT/foreman/runs/${newId}/plan.md`)).toBe("the plan\n");
    },
  );

  await then('its prompt has the line "Pull request: https://github.com/tester/web/pull/7"', async () => {
    expect(run.prompts(IMPLEMENT)[1]).toContain(`\nPull request: ${LINK}\n`);
  });
});
