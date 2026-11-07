import { scenario } from "@opensoftware/testkit";
import { runsFile, scorerFile } from "./runs.ts";

scenario("SCN-SCORE-056", async ({ sut, fakes, given, when, then }) => {
  await given(
    'the scorer file "scorers/lowest.md" with the sampling rate 0, the transcript limit 200 characters and the price 0 USD for input and output tokens',
    async () => {
      await sut.files.put(
        "$INPUT/scorers/lowest.md",
        scorerFile({ sample: 0, max_chars: 200, price: { input: 0, output: 0 } }),
      );
    },
  );

  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given("a model gateway without a scripted answer", async () => {
    url = (await fakes.modelGateway([])).url;
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer scorers/lowest.md runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "scorers/lowest.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: url },
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "scored 0 of 1 runs with lowest: 0 pass, 0 fail"', async () => {
    expect(run.stdout).toBe("scored 0 of 1 runs with lowest: 0 pass, 0 fail\n");
  });
});
