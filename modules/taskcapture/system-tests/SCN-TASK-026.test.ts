import { scenario } from "@opensoftware/testkit";
import { putJob, readJson } from "./results.ts";

scenario("SCN-TASK-026", async ({ sut, given, when, then }) => {
  await given('the job folder "v1" where "model-a" ran "web-1" for 2.00 USD and "web-2" without a cost', async () => {
    await putJob(sut, "v1", [
      { task: "web-1", model: "model-a", reward: 1, costUsd: 2 },
      { task: "web-2", model: "model-a", reward: 0 },
    ]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1"', async () => {
    run = await sut.cli(["report", "v1"]);
  });

  await then(
    '"report.json" shows the cell "v1" and "model-a" with 2 USD per trial and 1 trial without a cost',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const report = await readJson(sut, "$OUTPUT/report.json");
      expect(report.cells[0]).toMatchObject({
        model: "model-a",
        costUsdPerTrial: 2,
        trialsWithoutCost: 1,
        correctness: 0.5,
      });
      expect(run.stdout).toContain("v1 · model-a: 1 of 2 trials have no cost");
    },
  );
});
