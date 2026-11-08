import { scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, runsFile, scorerFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-052", async ({ sut, fakes, given, when, then }) => {
  await given('the scorer file "local.md" in the current folder', async () => {
    await sut.files.put("$INPUT/local.md", scorerFile({}));
  });

  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let url = "";
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      url = (await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }])).url;
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "scorekit score --scorer local.md runs.jsonl"', async () => {
    run = await sut.cli(["score", "--scorer", "local.md", "runs.jsonl"], { env: { SCOREKIT_INFERENCE_URL: url } });
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then('"scores.jsonl" holds a score for "run-01" with the name "local"', async () => {
    expect(await outputScores(sut)).toMatchObject([{ name: "local", metadata: { "osf.run.id": "run-01" } }]);
  });
});
