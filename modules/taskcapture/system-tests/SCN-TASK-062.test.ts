import { scenario } from "@opensoftware/testkit";
import { picksAndFront, putJob } from "./results.ts";

scenario("SCN-TASK-062", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "model-a" scores 0.5 at 1.00 USD per trial, "model-b" 1.0 at 1.00 USD and "model-c" 0.25 at 1.00 USD',
    async () => {
      await putJob(sut, "v1", [
        { task: "web-1", model: "model-a", reward: 0.5, costUsd: 1 },
        { task: "web-1", model: "model-b", reward: 1, costUsd: 1 },
        { task: "web-1", model: "model-c", reward: 0.25, costUsd: 1 },
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
