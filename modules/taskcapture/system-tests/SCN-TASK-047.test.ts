import { scenario } from "@opensoftware/testkit";
import { putSuiteAndHarbor, runWithHarbor } from "./harbor.ts";

scenario("SCN-TASK-047", async ({ sut, given, when, then }) => {
  await given('a suite with the tasks "web-1" and "web-2" and a Harbor that exits with code 3', async () => {
    await putSuiteAndHarbor(sut, ["web-1", "web-2"], { exitCode: 3 });
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture run --suite suite --agent claude-code --model model-a --configuration v1"',
    async () => {
      run = await runWithHarbor(sut, [
        "run",
        "--suite",
        "suite",
        "--agent",
        "claude-code",
        "--model",
        "model-a",
        "--configuration",
        "v1",
      ]);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says "taskcapture: harbor run for the configuration v1 exited with code 3"',
    async () => {
      expect(run.stderr).toContain("taskcapture: harbor run for the configuration v1 exited with code 3");
    },
  );

  await then('the output folder has no file "report.json"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("report.json");
  });
});
