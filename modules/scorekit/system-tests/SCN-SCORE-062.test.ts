import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { ANY_CALL, jsonl, runIds, runsFile, scoreRecord, verdict } from "./runs.ts";

scenario("SCN-SCORE-062", async ({ sut, fakes, given, when, then }) => {
  await given('the runs file "runs.jsonl" with the runs "run-01" to "run-03"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(runIds(3)));
  });

  await given(
    'the labels file "labels.jsonl" with an ANNOTATION label of "redundant-tests" for "run-01" and "run-04", a score of "redundant-tests" with the source "API" for "run-02" and an ANNOTATION label of "scope-creep" for "run-03"',
    async () => {
      await sut.files.put(
        "$INPUT/labels.jsonl",
        jsonl([
          scoreRecord("run-01", 1, { source: "ANNOTATION" }),
          scoreRecord("run-04", 1, { source: "ANNOTATION" }),
          scoreRecord("run-02", 1, { source: "API" }),
          scoreRecord("run-03", 1, { name: "scope-creep", source: "ANNOTATION" }),
        ]),
      );
    },
  );

  let gateway: ModelGateway;
  await given(
    'a model gateway that answers every judge call with the result "pass" and the reason "Fine."',
    async () => {
      gateway = await fakes.modelGateway([{ when: ANY_CALL, reply: verdict("pass", "Fine.") }]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "scorekit calibrate --scorer redundant-tests --labels labels.jsonl runs.jsonl"',
    async () => {
      run = await sut.cli(["calibrate", "--scorer", "redundant-tests", "--labels", "labels.jsonl", "runs.jsonl"], {
        env: { SCOREKIT_INFERENCE_URL: gateway.url },
      });
    },
  );

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stdout + run.stderr).toBe(0);
  });

  await then("the model gateway received 1 judge call", async () => {
    expect(gateway.calls).toHaveLength(1);
  });

  await then('the output is "agreement 1 of 1 (100.0%)"', async () => {
    expect(run.stdout).toBe("agreement 1 of 1 (100.0%)\n");
  });

  await then('the error output is "scorekit: no run for the label of run-04"', async () => {
    expect(run.stderr).toBe("scorekit: no run for the label of run-04\n");
  });
});
