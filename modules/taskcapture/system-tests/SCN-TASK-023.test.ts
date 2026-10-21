import { scenario } from "@opensoftware/testkit";
import { putJob, readJson, THREE_MODELS } from "./results.ts";

scenario("SCN-TASK-023", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "gpt-5.6-sol" scores 1.0 at 6.23 USD per trial, "glm-5.3-flash" 0.9 at 1.99 USD and "llama-9-tiny" 0.2 at 1.50 USD',
    async () => {
      await putJob(sut, "v1", THREE_MODELS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report v1"', async () => {
    run = await sut.cli(["report", "v1"]);
  });

  await then(
    '"report.json" names "gpt-5.6-sol" the best, "llama-9-tiny" the lowest cost and "glm-5.3-flash" the most efficient',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      const report = await readJson(sut, "$OUTPUT/report.json");
      expect(report.best).toEqual({ configuration: "v1", model: "gpt-5.6-sol" });
      expect(report.lowestCost).toEqual({ configuration: "v1", model: "llama-9-tiny" });
      expect(report.mostEfficient).toEqual({ configuration: "v1", model: "glm-5.3-flash" });
    },
  );

  await then('"report.json" has the Pareto front "llama-9-tiny", "glm-5.3-flash" and "gpt-5.6-sol"', async () => {
    const report = await readJson(sut, "$OUTPUT/report.json");
    expect(report.paretoFront.map((c: { model: string }) => c.model)).toEqual([
      "llama-9-tiny",
      "glm-5.3-flash",
      "gpt-5.6-sol",
    ]);
  });
});
