import { scenario } from "@opensoftware/testkit";
import { putJob, readJson } from "./results.ts";

scenario("SCN-TASK-024", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "model-a" scored "web-1" and "web-2" and "model-b" scored "web-1" and ended "web-2" with the error "AgentTimeoutError"',
    async () => {
      await putJob(sut, "v1", [
        { task: "web-1", model: "model-a", reward: 1, costUsd: 1 },
        { task: "web-2", model: "model-a", reward: 1, costUsd: 1 },
        { task: "web-1", model: "model-b", reward: 1, costUsd: 1 },
        { task: "web-2", model: "model-b", costUsd: 1, error: "AgentTimeoutError" },
      ]);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1"', async () => {
    run = await sut.cli(["report", "v1"]);
  });

  await then(
    '"report.json" flags the cell "v1" and "model-b" as incomplete with 1 of 2 tasks scored and the missing task "web-2"',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const report = await readJson(sut, "$OUTPUT/report.json");
      const cell = report.cells.find((c: { model: string }) => c.model === "model-b");
      expect(cell).toMatchObject({ incomplete: true, scoredTasks: 1, tasks: 2, missingTasks: ["web-2"] });
      expect(report.cells.find((c: { model: string }) => c.model === "model-a").incomplete).toBe(false);
    },
  );

  await then(
    'the output says "v1 · model-b: correctness uses 1 of 2 tasks; rerun with: harbor job resume --job-path v1 --filter-error-type AgentTimeoutError"',
    async () => {
      expect(run.stdout).toContain(
        "v1 · model-b: correctness uses 1 of 2 tasks; rerun with: harbor job resume --job-path v1 --filter-error-type AgentTimeoutError",
      );
    },
  );
});
