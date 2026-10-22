import { scenario } from "@opensoftware/testkit";
import { putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";

scenario("SCN-TASK-043", async ({ sut, given, when, then }) => {
  await given(
    'a suite with the tasks "web-1" and "web-2" and a Harbor where "model-a" solves both for 2.00 USD and "model-b" solves "web-1" for 0.50 USD',
    async () => {
      await putSuiteAndHarbor(sut, ["web-1", "web-2"], {
        trials: [
          { model: "model-a", task: "web-1", reward: 1, costUsd: 2 },
          { model: "model-a", task: "web-2", reward: 1, costUsd: 2 },
          { model: "model-b", task: "web-1", reward: 1, costUsd: 0.5 },
          { model: "model-b", task: "web-2", reward: 0, costUsd: 0.5 },
        ],
      });
    },
  );

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture run --suite suite --agent claude-code --model model-a --model model-b --configuration v1"',
    async () => {
      run = await runWithHarbor(sut, [
        "run",
        "--suite",
        "suite",
        "--agent",
        "claude-code",
        "--model",
        "model-a",
        "--model",
        "model-b",
        "--configuration",
        "v1",
      ]);
    },
  );

  await then('the output says "most efficient: v1 · model-b"', async () => {
    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toContain("most efficient: v1 · model-b");
  });

  await then('the output says "wrote $OUTPUT/report.json"', async () => {
    expect(run.stdout.trim().split("\n")).toContain(`wrote ${sut.files.path("$OUTPUT/report.json")}`);
  });
});
