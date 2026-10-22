import { scenario } from "@opensoftware/testkit";
import { putReport } from "./routes.ts";

scenario("SCN-TASK-036", async ({ sut, given, when, then }) => {
  await given('a report where "glm-5.3-flash" scores 0.9 at 1.99 USD per trial', async () => {
    await putReport(sut, [{ task: "web-1", model: "glm-5.3-flash", reward: 0.9, costUsd: 1.99 }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture route --tag front-end --alias coder --min-correctness 1.01 report.json"',
    async () => {
      run = await sut.cli([
        "route",
        "--tag",
        "front-end",
        "--alias",
        "coder",
        "--min-correctness",
        "1.01",
        "report.json",
      ]);
    },
  );

  await then("the command exits with code 2", async () => {
    expect(run.exitCode).toBe(2);
  });

  await then('the error output says "taskcapture: --min-correctness takes a share from 0 to 1, like 0.9"', async () => {
    expect(run.stderr).toBe("taskcapture: --min-correctness takes a share from 0 to 1, like 0.9\n");
  });
});
