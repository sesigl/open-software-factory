import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { runsFile } from "./runs.ts";

scenario("SCN-SCORE-050", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" and "run-02"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01", "run-02"]));
  });

  let gateway: ModelGateway;
  await given("a model gateway without a scripted answer", async () => {
    gateway = await fakes.modelGateway([]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer redundant-tests --sample 0 runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "redundant-tests", "--sample", "0", "runs.jsonl"], {
      env: { SCOREKIT_INFERENCE_URL: gateway.url },
    });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('the output is "scored 0 of 2 runs with redundant-tests: 0 pass, 0 fail"', async () => {
    expect(run.stdout).toBe("scored 0 of 2 runs with redundant-tests: 0 pass, 0 fail\n");
  });

  await then("the model gateway received no judge call", async () => {
    expect(gateway.calls).toHaveLength(0);
  });
});
