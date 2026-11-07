import { scenario } from "@opensoftware/testkit";
import { putJob, WITH_WARNINGS } from "./results.ts";

scenario("SCN-TASK-065", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "model-a" scored "web-1" at 1.00 USD and "web-2" without a cost and "model-b" scored 0.75 on "web-1" at 0.50 USD and ended "web-2" with the error "AgentTimeoutError"',
    async () => {
      await putJob(sut, "v1", WITH_WARNINGS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1"', async () => {
    run = await sut.cli(["report", "v1"]);
  });

  const output = () => run.stdout.split("\n");

  await then(
    "the output has one line per cell with its correctness, its USD per trial and its scored tasks",
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect(output().slice(0, 2)).toEqual([
        "v1 · model-a: correctness 100.0%, 1.00 USD per trial, 2 of 2 tasks scored",
        "v1 · model-b: correctness 75.0%, 0.50 USD per trial, 1 of 2 tasks scored",
      ]);
    },
  );

  await then(
    'the output has one line per warning and then the line "best: v1 · model-a; lowest cost: v1 · model-b; most efficient: v1 · model-b"',
    async () => {
      expect(output().slice(2, 5)).toEqual([
        "v1 · model-a: 1 of 2 trials have no cost",
        "v1 · model-b: correctness uses 1 of 2 tasks; rerun with: harbor job resume --job-path v1 --filter-error-type AgentTimeoutError",
        "best: v1 · model-a; lowest cost: v1 · model-b; most efficient: v1 · model-b",
      ]);
    },
  );
});
