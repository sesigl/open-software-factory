import { scenario } from "@opensoftware/testkit";
import { putJob, WITH_WARNINGS } from "./results.ts";

scenario("SCN-TASK-064", async ({ sut, given, when, then }) => {
  await given(
    'the job folder "v1" where "model-a" scored "web-1" at 1.00 USD and "web-2" without a cost and "model-b" scored 0.75 on "web-1" at 0.50 USD and ended "web-2" with the error "AgentTimeoutError"',
    async () => {
      await putJob(sut, "v1", WITH_WARNINGS);
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when('the user runs "taskcapture report --markdown report.md v1"', async () => {
    run = await sut.cli(["report", "--markdown", "report.md", "v1"]);
  });

  const report = async () => (await sut.files.read("$INPUT/report.md")).split("\n");

  await then(
    '"report.md" has the heading "# Benchmark report", the line "2 tasks, 2 cells of configuration and model." and one table row per cell',
    async () => {
      expect(run.exitCode, run.stderr).toBe(0);
      expect((await report()).slice(0, 9)).toEqual([
        "# Benchmark report",
        "",
        "2 tasks, 2 cells of configuration and model.",
        "",
        "| Configuration | Model | Correctness | USD per trial | Tasks scored |",
        "| --- | --- | --- | --- | --- |",
        "| v1 | model-a | 100.0% | 1.00 | 2 of 2 |",
        "| v1 | model-b | 75.0% | 0.50 | 1 of 2 |",
        "",
      ]);
    },
  );

  await then('"report.md" names the best, the lowest-cost and the most efficient cell', async () => {
    expect((await report()).slice(9, 12)).toEqual([
      "Best: v1 · model-a  ",
      "Lowest cost: v1 · model-b  ",
      "Most efficient: v1 · model-b  ",
    ]);
  });

  await then(
    '"report.md" has the section "## Warnings" with one warning for "v1 · model-a" and one for "v1 · model-b"',
    async () => {
      expect((await report()).slice(12)).toEqual([
        "",
        "## Warnings",
        "",
        "- v1 · model-a: 1 of 2 trials have no cost",
        "- v1 · model-b: correctness uses 1 of 2 tasks; rerun with: harbor job resume --job-path v1 --filter-error-type AgentTimeoutError",
        "",
      ]);
    },
  );
});
