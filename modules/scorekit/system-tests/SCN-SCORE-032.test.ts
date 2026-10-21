import { scenario } from "@opensoftware/testkit";
import { runLine } from "./runs.ts";

scenario("SCN-SCORE-032", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" whose second line is "not json"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", `${runLine("run-01")}\nnot json\n`);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests runs.jsonl"', async () => {
    const gateway = await fakes.modelGateway([]);
    run = await sut.cli(["score", "--scorer", "redundant-tests", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the command exits with code 2", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(2);
  });

  await then('the error output contains "runs.jsonl:2: not a JSON line"', async () => {
    expect(run.stderr).toContain("runs.jsonl:2: not a JSON line");
  });
});
