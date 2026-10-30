import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, outputScores, runsFile, verdict } from "./runs.ts";

const MODEL = "deepseek/deepseek-v4.1-flash-1017";

scenario("SCN-SCORE-046", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the run "run-01"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(["run-01"]));
  });

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }]);
    },
  );

  await when(
    'the user runs "scorekit score --scorer redundant-tests --sample 1 --model deepseek/deepseek-v4.1-flash-1017 runs.jsonl"',
    async () => {
      const run = await sut.cli(
        ["score", "--scorer", "redundant-tests", "--sample", "1", "--model", MODEL, "runs.jsonl"],
        {
          env: { SCOREKIT_INFERENCE_URL: gateway.url },
        },
      );
      expect(run.exitCode, run.stdout + run.stderr).toBe(0);
    },
  );

  await then('the judge call asks the gateway for the model "deepseek/deepseek-v4.1-flash-1017"', async () => {
    expect(gateway.calls).toHaveLength(1);
    expect(JSON.parse((gateway.calls[0] as { body: string }).body).model).toBe(MODEL);
  });

  await then('the score for "run-01" carries the judge model "deepseek/deepseek-v4.1-flash-1017"', async () => {
    expect(await outputScores(sut)).toMatchObject([{ metadata: { "osf.run.id": "run-01", "osf.judge.model": MODEL } }]);
  });
});
