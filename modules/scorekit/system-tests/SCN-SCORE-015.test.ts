import { scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

scenario("SCN-SCORE-015", async ({ sut, fakes, given, when, then }) => {
  await given('the scorer file "scorers/typo.md" with the front matter key "sampel"', async () => {
    await sut.files.put("$INPUT/scorers/typo.md", "---\npass: The run is fine.\nsampel: 0.2\n---\nJudge the run.\n");
  });

  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer scorers/typo.md runs.jsonl"', async () => {
    const gateway = await fakes.modelGateway([]);
    run = await sut.cli(["score", "--scorer", "scorers/typo.md", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output names the file "scorers/typo.md" and the unknown key "sampel"', async () => {
    expect(run.stderr).toContain('scorers/typo.md: unknown key "sampel"');
  });
});
