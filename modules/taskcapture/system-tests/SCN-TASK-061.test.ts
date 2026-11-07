import { scenario } from "@opensoftware/testkit";
import { picksAndFront, putJob } from "./results.ts";

scenario("SCN-TASK-061", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "model-a" scores 1.0 at 2.00 USD per trial, "model-b" 1.0 at 1.00 USD, "model-c" 1.0 at 3.00 USD and "model-d" 1.0 without a cost',
    async () => {
      await putJob(sut, "v1", [
        { task: "web-1", model: "model-a", reward: 1, costUsd: 2 },
        { task: "web-1", model: "model-b", reward: 1, costUsd: 1 },
        { task: "web-1", model: "model-c", reward: 1, costUsd: 3 },
        { task: "web-1", model: "model-d", reward: 1 },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1"', async () => {
    run = await sut.cli(["report", "v1"]);
  });

  await then('"report.json" names "model-b" the best, the lowest cost and the most efficient', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect((await picksAndFront(sut)).picks).toEqual(["model-b", "model-b", "model-b"]);
  });

  await then('"report.json" has the Pareto front "model-b"', async () => {
    expect((await picksAndFront(sut)).front).toEqual(["model-b"]);
  });
});
