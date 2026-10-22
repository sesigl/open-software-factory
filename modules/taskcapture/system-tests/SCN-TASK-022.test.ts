import { scenario } from "@opensoftware/testkit";
import { putJob, readJson } from "./results.ts";

scenario("SCN-TASK-022", async ({ sut, given, when, then }) => {
  await given(
    'the job folders "v1" and "v2", each with the trials of the models "model-a" and "model-b" on the tasks "web-1" and "web-2"',
    async () => {
      for (const job of ["v1", "v2"])
        await putJob(sut, job, [
          { task: "web-1", model: "model-a", reward: 1, costUsd: 1 },
          { task: "web-2", model: "model-a", reward: 1, costUsd: 1.2 },
          { task: "web-1", model: "model-b", reward: job === "v1" ? 0 : 1, costUsd: 0.2 },
          { task: "web-2", model: "model-b", reward: 0, costUsd: 0.4 },
        ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1 v2"', async () => {
    run = await sut.cli(["report", "v1", "v2"]);
  });

  await then("the command exits with code 0", async () => {
    expect(run.exitCode, run.stderr).toBe(0);
  });

  await then('"report.json" has 4 cells, one for each configuration and model', async () => {
    const report = await readJson(sut, "$OUTPUT/report.json");
    expect(
      report.cells.map((c: { configuration: string; model: string }) => `${c.configuration}/${c.model}`).sort(),
    ).toEqual(["v1/model-a", "v1/model-b", "v2/model-a", "v2/model-b"]);
  });

  await then(
    '"report.json" shows the cell "v2" and "model-b" with correctness 0.5 and 0.3 USD per trial over 2 trials',
    async () => {
      const report = await readJson(sut, "$OUTPUT/report.json");
      const cell = report.cells.find(
        (c: { configuration: string; model: string }) => c.configuration === "v2" && c.model === "model-b",
      );
      expect(cell).toMatchObject({
        correctness: 0.5,
        costUsdPerTrial: 0.3,
        trials: 2,
        scoredTasks: 2,
        tasks: 2,
        incomplete: false,
      });
    },
  );
});
