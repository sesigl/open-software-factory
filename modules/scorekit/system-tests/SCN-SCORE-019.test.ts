import { type ModelGateway, scenario } from "@opensoftware/testkit";
import { callFor, labelsFile, runIds, runsFile, verdict } from "./runs.ts";

scenario("SCN-SCORE-019", async ({ sut, fakes, given, when, then }) => {
  const ids = runIds(20);
  await given('the runs file "runs.jsonl" with the 20 runs "run-01" to "run-20"', async () => {
    await sut.files.put("$INPUT/runs.jsonl", runsFile(ids));
  });

  const labels = Object.fromEntries(ids.map((id, index) => [id, index < 10 ? "pass" : "fail"] as const));
  await given(
    'the labels file "labels.jsonl" that labels "run-01" to "run-10" "pass" and "run-11" to "run-20" "fail"',
    async () => {
      await sut.files.put("$INPUT/labels.jsonl", labelsFile(labels));
    },
  );

  let gateway: ModelGateway;
  await given('a model gateway whose judge agrees with the labels except for "run-10" and "run-11"', async () => {
    const flip = (label: "pass" | "fail") => (label === "pass" ? "fail" : "pass");
    gateway = await fakes.modelGateway(
      ids.map((id) => {
        const label = labels[id] as "pass" | "fail";
        const result = id === "run-10" || id === "run-11" ? flip(label) : label;
        return { when: callFor(id), reply: verdict(result, `Judged ${result}.`) };
      }),
    );
  });

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

  await then("the model gateway received 20 judge calls", async () => {
    expect(gateway.calls).toHaveLength(20);
  });

  await then('the output contains "agreement 18 of 20 (90.0%)"', async () => {
    expect(run.stdout).toContain("agreement 18 of 20 (90.0%)");
  });

  await then(
    '"calibration.json" has the agreement 0.9, the kappa 0.8 and the counts 9 true pass, 1 false pass, 9 true fail and 1 false fail',
    async () => {
      expect(JSON.parse(await sut.files.read("$OUTPUT/calibration.json"))).toMatchObject({
        agreement: 0.9,
        kappa: 0.8,
        counts: { truePass: 9, falsePass: 1, trueFail: 9, falseFail: 1 },
      });
    },
  );
});
