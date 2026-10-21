import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

scenario("SCN-SCORE-030", async ({ sut, fakes, given, when, then }) => {
  await given('the scorer file "scorers/vague.md" without the key "pass"', async () => {
    await sut.files.put("$INPUT/scorers/vague.md", "---\nsample: 0.5\n---\nJudge the run.\n");
  });

  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer scorers/vague.md runs.jsonl"', async () => {
    const gateway = await fakes.modelGateway([]);
    run = await sut.cli(["score", "--scorer", "scorers/vague.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output names the file "scorers/vague.md" and the missing key "pass"', async () => {
    expect(run.stderr).toContain('scorers/vague.md: "pass" is required');
  });
});
