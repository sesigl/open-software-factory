import { scenario } from "@opensoftware/testkit";
import { putReport } from "./routes.ts";

scenario("SCN-TASK-033", async ({ sut, given, when, then }) => {
  await given('a report where "glm-5.3-flash" scores 0.9 at 1.99 USD per trial', async () => {
    await putReport(sut, [{ task: "web-1", model: "glm-5.3-flash", reward: 0.9, costUsd: 1.99 }]);
  });

  let run: Awaited<ReturnType<typeof sut.cli>>;
  await when(
    'the user runs "taskcapture route --tag front-end --alias coder --min-correctness 0.95 report.json"',
    async () => {
      run = await sut.cli([
        "route",
        "--tag",
        "front-end",
        "--alias",
        "coder",
        "--min-correctness",
        "0.95",
        "report.json",
      ]);
    },
  );

  await then("the command exits with code 1", async () => {
    expect(run.exitCode).toBe(1);
  });

  await then(
    'the error output says "taskcapture: no model reaches correctness 95.0%; the best is v1 · glm-5.3-flash with 90.0%"',
    async () => {
      expect(run.stderr).toBe(
        "taskcapture: no model reaches correctness 95.0%; the best is v1 · glm-5.3-flash with 90.0%\n",
      );
    },
  );

  await then('the output folder has no file "litellm-config.yaml"', async () => {
    expect(await sut.files.list("$OUTPUT")).not.toContain("litellm-config.yaml");
  });
});
