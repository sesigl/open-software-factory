import { scenario } from "@opensoftware/testkit";
import { callFor, outputScores, runsFile, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-010", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the scorer file "scorers/priced.md" with the price 3 USD per million input tokens and 15 USD per million output tokens',
    async () => {
      await sut.files.put("$INPUT/scorers/priced.md", scorerFile({ price: { input: 3, output: 15 } }));
    },
  );

  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given(
    'a model gateway that answers the judge call for "run-01" with 1000 prompt tokens and 200 completion tokens',
    async () => {
      const usage = { prompt_tokens: 1000, completion_tokens: 200 };
      url = (await fakes.modelGateway([{ when: callFor("run-01"), reply: verdict("pass", "Fine."), usage }])).url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer scorers/priced.md runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "scorers/priced.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then('the score for "run-01" has the judge cost 0.006', async () => {
    expect(await outputScores(sut)).toMatchObject([
      { metadata: { "osf.run.id": "run-01", "osf.judge.cost.usd": 0.006 } },
    ]);
  });

  await then('the output contains "cost 0.006 USD"', async () => {
    expect(run.stdout).toContain("cost 0.006 USD");
  });
});
